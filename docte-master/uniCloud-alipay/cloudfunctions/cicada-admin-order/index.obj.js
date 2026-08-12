const db = uniCloud.database()
const dbCmd = db.command
const crypto = require('crypto')
const { createAdminAuthError, toAdminErrorResponse, isAdminTokenExpired } = loadAdminAuthModule()
const expressProvider = loadExpressProvider()
const { findTrackingConflict, getReturnShipmentBlockReason } = require('./logistics-policy')
const { buildLogisticsReadiness } = require('./logistics-readiness')
const { reconcileTrackCache } = require('./logistics-policy')
const {
  MANUAL_CONFIRMABLE_PAYMENT_STATUSES,
  assertManualPaymentConfirmationAllowed,
  getPaymentConfirmationStatusUpdate,
  resolveManualPaymentMethod
} = require('./payment-confirmation-policy')
const { getInvoiceRequestBlockReason, INVOICE_ITEM_NAME, INVOICE_TAX_CATEGORY } = loadInvoicePolicyModule()
const warrantyPolicy = loadWarrantyPolicyModule()
// Each row may call the provider and subscription API; keep one request safely below cloud-function limits.
const LOGISTICS_IMPORT_MAX_ROWS = 50
const { getChunkedEnvValue, normalizePem, verifyWechatPaySignature } = loadWechatPayCryptoModule()
const {
  SUBSCRIPTION_CONFIG_SCENES,
  getSubscriptionTemplateKey,
  buildSubscriptionData
} = loadSubscriptionMessageModule()
const WECHAT_PAY_API_BASE = 'https://api.mch.weixin.qq.com'

function loadExpressProvider() {
  try {
    return require('cicada-express-provider')
  } catch (packageError) {
    return require('../common/cicada-express-provider')
  }
}

function loadAdminAuthModule() {
  try {
    return require('cicada-admin-auth')
  } catch (packageError) {
    return require('../common/cicada-admin-auth')
  }
}

function loadSubscriptionMessageModule() {
  try {
    return require('cicada-subscription-message')
  } catch (packageError) {
    return require('../common/cicada-subscription-message')
  }
}

function loadWechatPayCryptoModule() {
  try {
    return require('cicada-wechat-pay-crypto')
  } catch (packageError) {
    return require('../common/cicada-wechat-pay-crypto')
  }
}

function createWorkflowFallback() {
  const ORDER_STATUS = ['pending', 'sent', 'received', 'inspecting', 'fixing', 'shipped', 'completed', 'cancelled']
  const ORDER_STATUS_LABELS = {
    pending: '已提交',
    sent: '运输中',
    received: '已签收',
    inspecting: '检测中',
    fixing: '处理中',
    shipped: '已回寄',
    completed: '已完成',
    cancelled: '已取消'
  }
  const ORDER_STATUS_TRANSITIONS = {
    pending: ['sent', 'received', 'cancelled'],
    sent: ['received', 'cancelled'],
    received: ['inspecting', 'fixing', 'shipped', 'cancelled'],
    inspecting: ['fixing', 'shipped', 'cancelled'],
    fixing: ['shipped', 'completed', 'cancelled'],
    shipped: ['completed'],
    completed: [],
    cancelled: []
  }
  const ROLE_LABELS = {
    superadmin: '超级管理员',
    admin: '管理员',
    engineer: '工程师',
    finance: '财务',
    support: '客服'
  }
  const ALL_ROLES = Object.keys(ROLE_LABELS)
  const PERMISSIONS = {
    view_order: ALL_ROLES,
    create_order: ['admin', 'engineer', 'support'],
    export_order: ALL_ROLES,
    get_stats: ALL_ROLES,
    get_workflow_config: ALL_ROLES,
    delete_order: ['admin'],
    update_status: ['admin', 'engineer'],
    import_logistics: ['admin', 'engineer'],
    issue_quote: ['admin', 'engineer'],
    confirm_payment: ['admin', 'finance'],
    update_invoice: ['admin', 'finance'],
    view_payment_proof: ['admin', 'finance'],
    manage_inventory: ['admin', 'engineer'],
    view_settlement: ['admin', 'finance'],
    update_remarks: ['admin', 'engineer', 'support'],
    add_timeline: ['admin', 'engineer', 'support'],
    manage_staff: ['admin'],
    manage_settings: ['admin'],
    manage_kb: ['admin', 'engineer'],
    view_audit_log: ['admin', 'finance']
  }
  const normalizeRole = role => String(role || '').trim()
  const isKnownRole = role => ALL_ROLES.includes(normalizeRole(role))
  const getRoleLabel = role => ROLE_LABELS[normalizeRole(role)] || normalizeRole(role) || '未知角色'
  const hasRolePermission = (role = '', action = '') => {
    const normalizedRole = normalizeRole(role)
    if (normalizedRole === 'superadmin' || normalizedRole === 'admin') return true
    return (PERMISSIONS[action] || []).includes(normalizedRole)
  }
  const assertRolePermission = (user = {}, action = '') => {
    const role = normalizeRole(user.role)
    if (!hasRolePermission(role, action)) throw new Error(`${getRoleLabel(role)}无权限执行该操作`)
    return true
  }
  const isKnownOrderStatus = status => ORDER_STATUS.includes(String(status || '').trim())
  const getOrderStatusLabel = status => ORDER_STATUS_LABELS[String(status || '').trim()] || String(status || '').trim() || '未知状态'
  const getAllowedStatusTransitions = status => ORDER_STATUS_TRANSITIONS[String(status || '').trim()] || []
  const canTransitionOrderStatus = (fromStatus = '', toStatus = '') => {
    const from = String(fromStatus || '').trim()
    const to = String(toStatus || '').trim()
    if (!isKnownOrderStatus(from) || !isKnownOrderStatus(to)) return false
    return from === to || getAllowedStatusTransitions(from).includes(to)
  }
  const getRepairStartBlockReason = (order = {}) => {
    const quoteStatus = String(order.quote_status || order.quoteStatus || '').trim()
    const authorizationStatus = String(order.authorization_status || order.authorizationStatus || '').trim()
    const paymentStatus = String(order.payment_status || order.paymentStatus || '').trim()
    const chargeType = String(order.charge_type || order.chargeType || '').trim()
    const isFreeCharge = order.charge_type === 'free' || chargeType === 'free'
    const warrantyStatus = String(order.warranty_status || order.warrantyStatus || '').trim()
    const total = Number(order.total_price || order.totalPrice || 0) || 0
    if (quoteStatus !== 'confirmed') return '维修前必须先确认维修方案'
    if (authorizationStatus !== 'confirmed') return '维修前必须取得客户授权'
    if (total > 0 && paymentStatus !== 'paid') return '收费维修必须先确认款项到账'
    if (total <= 0 && (
      paymentStatus !== 'not_required'
      || !isFreeCharge
      || order.in_warranty !== true
      || !['in_warranty', 'extended'].includes(warrantyStatus)
    )) return '零元维修必须先完成质保免收费核验'
    return ''
  }
  const assertOrderStatusTransition = (fromStatus = '', toStatus = '') => {
    const from = String(fromStatus || '').trim()
    const to = String(toStatus || '').trim()
    if (!isKnownOrderStatus(to)) throw new Error('工单状态不正确')
    if (!isKnownOrderStatus(from)) throw new Error('当前工单状态不正确')
    if (!canTransitionOrderStatus(from, to)) throw new Error(`${getOrderStatusLabel(from)}工单不能改为${getOrderStatusLabel(to)}`)
    return true
  }
  const getWorkflowConfigForRole = (role = '') => {
    const normalizedRole = normalizeRole(role)
    return {
      role: normalizedRole,
      roleLabel: getRoleLabel(normalizedRole),
      roles: ALL_ROLES.map(item => ({ role: item, label: ROLE_LABELS[item] })),
      statuses: ORDER_STATUS.map(status => ({ status, label: ORDER_STATUS_LABELS[status] })),
      transitions: ORDER_STATUS_TRANSITIONS,
      permissions: Object.fromEntries(Object.keys(PERMISSIONS).map(action => [action, hasRolePermission(normalizedRole, action)]))
    }
  }
  return {
    ORDER_STATUS,
    assertOrderStatusTransition,
    assertRolePermission,
    getOrderStatusLabel,
    getWorkflowConfigForRole,
    hasRolePermission,
    isKnownRole,
    canTransitionOrderStatus,
    getRepairStartBlockReason
  }
}

function loadWorkflowModule() {
  try {
    return require('cicada-order-workflow')
  } catch (error) {
    try {
      return require('../common/cicada-order-workflow')
    } catch (localError) {
      return createWorkflowFallback()
    }
  }
}

const {
  ORDER_STATUS,
  assertOrderStatusTransition,
  assertRolePermission,
  getOrderStatusLabel,
  getWorkflowConfigForRole,
  hasRolePermission,
  isKnownRole,
  canTransitionOrderStatus,
  getRepairStartBlockReason
} = loadWorkflowModule()

async function verifyAdminToken(token) {
  if (!token) throw createAdminAuthError('鉴权失败：非管理人员禁止访问该接口')
  const res = await db.collection('cicada_users').where({ token }).limit(1).get()
  const user = res.data[0]
  if (!user || user.disabled || !isKnownRole(user.role)) {
    throw createAdminAuthError('鉴权失败：非管理人员禁止访问该接口')
  }
  if (isAdminTokenExpired(user.token_expire)) throw createAdminAuthError('鉴权失败：Token已过期')
  return user
}

async function verifyEngineer(engineer_id) {
  if (!engineer_id) throw new Error('缺少工程师ID')
  const res = await db.collection('cicada_users')
    .where({ _id: engineer_id, role: 'engineer', disabled: dbCmd.neq(true) })
    .limit(1)
    .get()
  if (!res.data.length) throw new Error('工程师不存在或已禁用')
}

function normalizePage(page, pageSize) {
  const current = Math.max(Number(page) || 1, 1)
  const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
  return { page: current, pageSize: size }
}

const ADMIN_ORDER_LIST_BATCH_SIZE = 200
const ADMIN_ORDER_FILTER_SCAN_LIMIT = Number(process.env.ADMIN_ORDER_FILTER_SCAN_LIMIT || 2000)
const SLA_STATUS_CONFIG = {
  pending: { thresholdHours: 24, title: '待签收', action: '确认客户寄入物流或催寄' },
  sent: { thresholdHours: 24, title: '运输中', action: '跟进物流签收' },
  received: { thresholdHours: 24, title: '已签收', action: '安排检测并出报价' },
  inspecting: { thresholdHours: 48, title: '检测中', action: '推进检测结论' },
  fixing: { thresholdHours: 72, title: '处理中', action: '推进维修或回寄' },
  shipped: { thresholdHours: 72, title: '已回寄', action: '确认客户收货并结单' }
}

function getSlaInfo(order = {}, now = Date.now()) {
  const status = normalizeText(order.status)
  const config = SLA_STATUS_CONFIG[status]
  const since = Number(order.status_enter_time || order.status_update_time || order.update_time || order.create_time || 0) || 0
  if (!config || !since || ['completed', 'cancelled'].includes(status)) {
    return {
      tracked: Boolean(config),
      status,
      level: 'normal',
      overdue: false,
      dwell_hours: since ? Math.max(0, Math.floor((now - since) / 36e5)) : 0,
      threshold_hours: config ? config.thresholdHours : 0,
      since,
      title: config ? config.title : '',
      action: config ? config.action : ''
    }
  }

  const dwellHours = Math.max(0, Math.floor((now - since) / 36e5))
  let level = 'normal'
  if (dwellHours >= config.thresholdHours * 2) level = 'critical'
  else if (dwellHours >= config.thresholdHours) level = 'warning'

  return {
    tracked: true,
    status,
    level,
    overdue: level !== 'normal',
    dwell_hours: dwellHours,
    threshold_hours: config.thresholdHours,
    since,
    title: config.title,
    action: config.action
  }
}

function matchesSlaFilter(order = {}, slaLevel = '') {
  const level = normalizeText(slaLevel)
  if (!level) return true
  const info = order.sla_info || getSlaInfo(order)
  if (level === 'tracked') return Boolean(info.tracked)
  if (level === 'overdue') return Boolean(info.overdue)
  return info.level === level
}

function getDirectTodoMatchCond(todoType = '') {
  const type = normalizeText(todoType)
  if (!type) return {}
  if (type === 'inbound') return { status: dbCmd.in(['pending', 'sent']) }
  if (type === 'payment') return { payment_status: 'uploaded', total_price: dbCmd.gt(0) }
  // 待回寄包含“已签收拒修”和“处理中待发货”两类，无法用单个 AND 条件等价表达，走 JS 精确筛选。
  if (type === 'return') return null
  return null
}

function getTodoCountMatchCond(todoType = '') {
  const directCond = getDirectTodoMatchCond(todoType)
  if (directCond) return directCond
  const type = normalizeText(todoType)
  if (type === 'quote') {
    return {
      status: dbCmd.in(['received', 'inspecting', 'fixing']),
      quote_status: dbCmd.in(['pending', 'draft'])
    }
  }
  if (type === 'invoice') {
    return {
      'invoice_info.need_invoice': true,
      'invoice_info.status': dbCmd.in(['待开票', '开具中', '未发票'])
    }
  }
  if (type === 'exception') return { admin_exception: true }
  return { status: dbCmd.neq('cancelled') }
}

function buildDirectAdminOrderMatchCond({ status = '', todoType = '' } = {}) {
  const todoCond = getDirectTodoMatchCond(todoType)
  if (todoCond === null) return null
  const matchCond = { ...todoCond }
  if (status) matchCond.status = status
  return matchCond
}

function collectDeviceModelsFromOrders(orders = []) {
  return [...new Set(orders
    .flatMap(order => (order.itemsList || []).map(item => normalizeText(item.product_model)))
    .filter(Boolean))]
    .sort()
}

async function fetchAdminOrderPage(matchCond, pagination) {
  const offset = (pagination.page - 1) * pagination.pageSize
  const activeMatchCond = withActiveOrderFilter(matchCond)
  const [countRes, pageRes] = await Promise.all([
    db.collection('cicada_orders').where(activeMatchCond).count(),
    db.collection('cicada_orders')
      .aggregate()
      .match(activeMatchCond)
      .sort({ create_time: -1 })
      .skip(offset)
      .limit(pagination.pageSize)
      .lookup({
        from: 'cicada_order_items',
        localField: '_id',
        foreignField: 'order_id',
        as: 'itemsList'
      })
      .end()
  ])
  return { total: countRes.total || 0, rawOrders: pageRes.data || [] }
}

// sharedUrlMap 传入时用共享映射（列表场景，整页一次换链接，避免 N+1）；
// 不传时退回单订单自取（详情等单条场景）。
async function enrichAdminOrderForList(order = {}, currentAdmin = {}, sharedUrlMap = null) {
  // sharedUrlMap 同时覆盖订单级支付凭证与 item 级媒体（购买凭证/故障图/视频）的 cloud:// → 临时链接
  const itemsList = sharedUrlMap
    ? applyItemMediaUrlMap(order.itemsList || [], sharedUrlMap)
    : (order.itemsList || [])
  const itemDetail = (itemsList.length > 0) ? itemsList[0] : {}
  const orderWithProofs = sharedUrlMap
    ? { ...order, payment_proofs: applyProofUrlMap(order.payment_proofs || order.paymentProofs || [], sharedUrlMap) }
    : await enrichPaymentProofs(order)

  return stripPaymentProofsIfForbidden({
    ...orderWithProofs,
    product_name: itemDetail.product_name || '',
    product_model: itemDetail.product_model || '',
    fault_desc: itemDetail.fault_desc || '',
    media_urls: itemDetail.media_urls || [],
    sn: itemDetail.sn || '',
    buy_date: itemDetail.buy_date || '',
    fix_solution: itemDetail.fix_solution || '',
    itemsList,
    sla_info: getSlaInfo(order)
  }, currentAdmin)
}

// 手机号脱敏：138****8888，与 cicada-admin-customer 的 maskPhone 规则保持一致
function maskPhone(phone) {
  const p = normalizeText(phone)
  if (!p) return ''
  if (/^\d{11}$/.test(p)) return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  if (p.length >= 7) return p.slice(0, 3) + '****' + p.slice(-2)
  return '****'
}

// 批量解析工单关联的 CRM 客户（优先 customer_id，回退 user_id），附加客户摘要供列表展示
// 安全：CRM 主手机号属客户档案敏感信息，仅 admin/superadmin 可见完整号（与 CRM view_phone 对齐），
// 其余角色（engineer/finance/support）一律脱敏，避免工单列表旁路 CRM 脱敏策略。
async function attachCustomerSummaries(orders = [], currentAdmin = {}) {
  if (!Array.isArray(orders) || !orders.length) return
  const canViewFullPhone = ['admin', 'superadmin'].includes(
    String(currentAdmin && currentAdmin.role || '').toLowerCase()
  )
  const customerIds = [...new Set(orders.map(o => normalizeText(o.customer_id)).filter(Boolean))]
  const userIds = [...new Set(orders.filter(o => !normalizeText(o.customer_id)).map(o => normalizeText(o.user_id)).filter(Boolean))]
  const byId = {}
  const byUser = {}
  try {
    if (customerIds.length) {
      const res = await db.collection('cicada_customers').where({ _id: dbCmd.in(customerIds) }).get()
      ;(res.data || []).forEach(c => { byId[c._id] = c })
    }
    if (userIds.length) {
      const res = await db.collection('cicada_customers').where({ user_id: dbCmd.in(userIds) }).get()
      ;(res.data || []).forEach(c => { if (c.user_id) byUser[c.user_id] = c })
    }
  } catch (e) {
    // 客户解析失败不阻断工单列表
  }
  orders.forEach(o => {
    const c = byId[normalizeText(o.customer_id)] || byUser[normalizeText(o.user_id)] || null
    // 下单时写入的 customer_type 快照优先；无快照时再回退 CRM 档案类型
    const orderType = normalizeText(o.customer_type)
    if (!c) {
      o.customer_type = orderType
      return
    }
    const displayPhone = canViewFullPhone ? (c.phone || '') : maskPhone(c.phone)
    const crmType = normalizeText(c.customer_type)
    o.customer = {
      id: c._id,
      name: c.name || '',
      contact: c.contact || '',
      phone: displayPhone,
      address: c.address || '',
      biz_user: c.biz_user || '',
      customer_type: crmType,
      tags: Array.isArray(c.tags) ? c.tags : []
    }
    o.customer_name = c.name || ''
    o.customer_phone = displayPhone
    o.customer_type = orderType || crmType
  })
}

async function enrichAdminOrdersForList(rawOrders = [], currentAdmin = {}) {
  // 一次性收集本页所有订单凭证的 fileID，合并成一次 getTempFileURL 调用，
  // 再把结果映射分发给每条订单，替代原来每单一次的 N+1 临时链接换取。
  const allProofFileIds = []
  rawOrders.forEach(order => {
    collectProofCloudFileIds(order.payment_proofs || order.paymentProofs || [])
      .forEach(id => allProofFileIds.push(id))
    // item 级媒体（购买凭证/故障图/视频）的 cloud:// 也一并纳入同一批换链接
    collectItemMediaCloudFileIds(order.itemsList || [])
      .forEach(id => allProofFileIds.push(id))
  })
  const sharedUrlMap = await fetchTempUrlMap(allProofFileIds)

  const enriched = await Promise.all(rawOrders.map(order => enrichAdminOrderForList(order, currentAdmin, sharedUrlMap)))
  await attachCustomerSummaries(enriched, currentAdmin)
  return enriched
}

async function countOrdersByMatch(matchCond, todoType = '') {
  try {
    if (normalizeText(todoType) === 'return') {
      const orders = await fetchOrderBatches({
        status: dbCmd.in(['received', 'inspecting', 'fixing'])
      }, { maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT })
      return orders.filter(order => matchesTodoType(order, todoType)).length
    }
    const res = await db.collection('cicada_orders').where(withActiveOrderFilter(matchCond)).count()
    return res.total || 0
  } catch (e) {
    const orders = await fetchOrderBatches({ status: dbCmd.neq('cancelled') }, { maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT })
    return orders.filter(order => matchesTodoType(order, todoType)).length
  }
}

let wechatAccessTokenCache = { token: '', expireAt: 0 }

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return String(value).trim()
  }
  return ''
}

function getSubscriptionTemplateId(scene = '') {
  const key = getSubscriptionTemplateKey(scene)
  return getEnvValue(`WX_SUBSCRIBE_TEMPLATE_${key}`, `WECHAT_SUBSCRIBE_TEMPLATE_${key}`)
}

function getWechatAppConfig() {
  const appId = getEnvValue('WX_APPID', 'WECHAT_APPID')
  const secret = getEnvValue('WX_SECRET', 'WECHAT_SECRET')
  if (!appId || !secret) throw new Error('未配置 WX_APPID/WX_SECRET')
  return { appId, secret }
}

// ============== 微信支付 v3 退款（与 cicada-client-order 的签名实现一致）==============
function normalizeWxPrivateKey(value = '') {
  return String(value || '').trim().replace(/\\n/g, '\n')
}

function getWechatPayPrivateKey() {
  const base64Key = getChunkedEnvValue(process.env, [
    'WX_PAY_PRIVATE_KEY_BASE64',
    'WXPAY_PRIVATE_KEY_BASE64',
    'WECHAT_PAY_PRIVATE_KEY_BASE64'
  ])
  if (base64Key) return Buffer.from(base64Key, 'base64').toString('utf8')
  return normalizeWxPrivateKey(getEnvValue('WX_PAY_PRIVATE_KEY', 'WXPAY_PRIVATE_KEY', 'WECHAT_PAY_PRIVATE_KEY'))
}

function getWechatPayPublicKeyConfig() {
  const base64 = getChunkedEnvValue(process.env, [
    'WX_PAY_PUBLIC_KEY_BASE64',
    'WXPAY_PUBLIC_KEY_BASE64',
    'WECHAT_PAY_PUBLIC_KEY_BASE64'
  ])
  const publicKey = base64
    ? Buffer.from(base64, 'base64').toString('utf8')
    : normalizePem(getEnvValue('WX_PAY_PUBLIC_KEY', 'WXPAY_PUBLIC_KEY', 'WECHAT_PAY_PUBLIC_KEY'))
  const publicKeyId = getEnvValue('WX_PAY_PUBLIC_KEY_ID', 'WXPAY_PUBLIC_KEY_ID', 'WECHAT_PAY_PUBLIC_KEY_ID')
  const missing = []
  if (!publicKeyId) missing.push('WX_PAY_PUBLIC_KEY_ID')
  if (!publicKey) missing.push('WX_PAY_PUBLIC_KEY 或 WX_PAY_PUBLIC_KEY_BASE64')
  if (missing.length) throw new Error(`微信支付公钥模式暂未配置：${missing.join('、')}`)
  return { publicKey, publicKeyId }
}

function getWechatPayConfig() {
  const verifyConfig = getWechatPayPublicKeyConfig()
  const config = {
    appId: getEnvValue('WX_PAY_APPID', 'WXPAY_APPID', 'WECHAT_PAY_APPID', 'WX_APPID'),
    mchId: getEnvValue('WX_PAY_MCH_ID', 'WXPAY_MCH_ID', 'WECHAT_PAY_MCH_ID'),
    serialNo: getEnvValue('WX_PAY_SERIAL_NO', 'WXPAY_SERIAL_NO', 'WECHAT_PAY_SERIAL_NO'),
    notifyUrl: getEnvValue('WX_PAY_REFUND_NOTIFY_URL', 'WXPAY_REFUND_NOTIFY_URL', 'WECHAT_PAY_REFUND_NOTIFY_URL'),
    privateKey: getWechatPayPrivateKey(),
    ...verifyConfig
  }
  const missing = []
  if (!config.mchId) missing.push('WX_PAY_MCH_ID')
  if (!config.serialNo) missing.push('WX_PAY_SERIAL_NO')
  if (!config.privateKey) missing.push('WX_PAY_PRIVATE_KEY 或 WX_PAY_PRIVATE_KEY_BASE64')
  if (missing.length) throw new Error(`微信支付暂未配置：${missing.join('、')}`)
  return config
}

function wxRandomNonce(size = 16) {
  return crypto.randomBytes(size).toString('hex')
}

function buildWechatPayAuthorization(method, url, body, config) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const nonce = wxRandomNonce()
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(message)
  signer.end()
  const signature = signer.sign(config.privateKey, 'base64')
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.serialNo}"`
}

async function requestWechatPay(method, url, body, config) {
  const bodyText = body ? JSON.stringify(body) : ''
  const res = await uniCloud.httpclient.request(`${WECHAT_PAY_API_BASE}${url}`, {
    method,
    data: bodyText || undefined,
    dataType: 'text',
    headers: {
      Authorization: buildWechatPayAuthorization(method, url, bodyText, config),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  })
  const rawBody = Buffer.isBuffer(res.data) ? res.data.toString('utf8') : String(res.data || '')
  let responseData = {}
  try {
    responseData = rawBody ? JSON.parse(rawBody) : {}
  } catch (error) {
    throw new Error('微信支付返回了无法解析的响应')
  }
  if (res.status < 200 || res.status >= 300) {
    const message = responseData && (responseData.message || responseData.code) ? `${responseData.message || responseData.code}` : `微信退款请求失败(${res.status})`
    throw new Error(message)
  }
  verifyWechatPaySignature({
    headers: res.headers || {},
    rawBody,
    publicKey: config.publicKey,
    publicKeyId: config.publicKeyId
  })
  return responseData
}

function getOrderPaidAmountFen(order = {}) {
  const yuan = Number(order.total_price || order.totalPrice || 0) || 0
  return Math.round(yuan * 100)
}

function genRefundNo(order = {}, refundFen = 0) {
  const base = String(order.order_no || order._id || `DR${Date.now()}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24)
  return `${base}R${Math.max(Number(refundFen) || 0, 0)}`
}

async function getWechatAccessToken() {
  if (wechatAccessTokenCache.token && Date.now() < wechatAccessTokenCache.expireAt) {
    return wechatAccessTokenCache.token
  }
  const config = getWechatAppConfig()
  const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.secret)}`
  const res = await uniCloud.httpclient.request(tokenUrl, {
    method: 'GET',
    dataType: 'json'
  })
  if (!res.data || !res.data.access_token) {
    throw new Error(res.data && res.data.errmsg ? res.data.errmsg : '获取微信access_token失败')
  }
  wechatAccessTokenCache = {
    token: res.data.access_token,
    expireAt: Date.now() + Math.max(Number(res.data.expires_in || 7200) - 300, 60) * 1000
  }
  return wechatAccessTokenCache.token
}

async function sendWechatSubscribeMessage(payload = {}) {
  const accessToken = await getWechatAccessToken()
  const res = await uniCloud.httpclient.request(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    dataType: 'json',
    data: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json'
    }
  })
  const data = res.data || {}
  if (data.errcode && data.errcode !== 0) {
    throw new Error(data.errmsg || `订阅消息发送失败(${data.errcode})`)
  }
  return data
}

async function enrichSubscriptionOrder(order = {}) {
  const hasDevice = normalizeText(order.product_model || order.device_model || order.product_name || order.device_name)
  const hasSerial = normalizeText(order.sn || order.serial_no || order.device_sn)
  if (hasDevice && hasSerial) return order
  const orderKeys = [...new Set([order._id, order.order_no].filter(Boolean))]
  if (!orderKeys.length) return order
  try {
    const itemRes = await db.collection('cicada_order_items')
      .where({ order_id: dbCmd.in(orderKeys) })
      .limit(1)
      .get()
    const item = itemRes.data && itemRes.data[0]
    if (!item) return order
    return {
      ...order,
      product_name: order.product_name || item.product_name || '',
      product_model: order.product_model || item.product_model || '',
      sn: order.sn || item.sn || '',
      fix_solution: order.fix_solution || item.fix_solution || ''
    }
  } catch (e) {
    return order
  }
}

async function logSubscriptionMessage(payload = {}) {
  await db.collection('cicada_subscription_logs').add({
    ...payload,
    create_time: Date.now()
  }).catch(error => {
    console.error('写工单审计日志失败:', error && error.message)
  })
}

async function sendOrderSubscription(order = {}, scene = '', remark = '') {
  const templateId = getSubscriptionTemplateId(scene)
  if (scene === 'payment_rejected') {
    console.log('付款驳回，复用待支付提醒模板', order.order_no || order._id || '')
  }
  const logBase = {
    order_id: order._id || '',
    order_no: order.order_no || '',
    user_id: order.user_id || '',
    scene,
    template_id: templateId,
    status: 'pending'
  }
  if (!templateId) {
    await logSubscriptionMessage({ ...logBase, status: 'skipped', fail_reason: '未配置订阅消息模板ID' })
    return
  }
  try {
    const userRes = await db.collection('cicada_users').doc(order.user_id).get()
    const user = userRes.data && userRes.data[0]
    if (!user || !user.openid) {
      await logSubscriptionMessage({ ...logBase, status: 'skipped', fail_reason: '用户缺少openid' })
      return
    }
    const messageOrder = await enrichSubscriptionOrder(order)
    await sendWechatSubscribeMessage({
      touser: user.openid,
      template_id: templateId,
      page: `pages/index/index?module=track&orderId=${encodeURIComponent(order.order_no || order._id || '')}`,
      data: buildSubscriptionData(messageOrder, scene, remark)
    })
    await logSubscriptionMessage({ ...logBase, openid: user.openid, status: 'sent' })
  } catch (e) {
    await logSubscriptionMessage({ ...logBase, status: 'failed', fail_reason: e.message || String(e) })
  }
}

function requireAdminPermission(ctx, action) {
  const user = ctx.currentAdminUser || {}
  assertRolePermission(user, action)
  return user
}

function getActorInfo(user = {}) {
  return {
    actor_id: user._id || '',
    actor_role: user.role || '',
    actor_name: user.nickname || user.name || user.username || user.mobile || user.phone || ''
  }
}

async function logOrderEvent({
  order = {},
  source = 'admin',
  action = '',
  actor = {},
  before = {},
  after = {}
} = {}) {
  if (!order._id && !order.order_no) return
  await db.collection('cicada_order_events').add({
    order_id: order._id || '',
    order_no: order.order_no || '',
    source,
    action,
    ...getActorInfo(actor),
    before,
    after,
    create_time: Date.now()
  }).catch(() => {})
}

function stripPaymentProofsIfForbidden(order = {}, user = {}) {
  if (hasRolePermission(user.role, 'view_payment_proof')) return order
  return {
    ...order,
    payment_proofs: [],
    paymentProofs: []
  }
}

function parseHttpBody(ctx) {
  const httpInfo = ctx.getHttpInfo && ctx.getHttpInfo()
  if (!httpInfo || !httpInfo.body) return null
  return JSON.parse(httpInfo.body)
}

function pickParam(ctx, params) {
  if (params && Object.keys(params).length) return params
  return parseHttpBody(ctx) || {}
}

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim()
}

function loadWarrantyPolicyModule() {
  try {
    return require('cicada-warranty-policy')
  } catch (packageError) {
    return require('../common/cicada-warranty-policy')
  }
}

function loadInvoicePolicyModule() {
  try {
    return require('cicada-invoice-policy')
  } catch (packageError) {
    return require('../common/cicada-invoice-policy')
  }
}

async function findInvoiceNumberConflict(invoiceNo, excludeOrderId = '') {
  const normalizedInvoiceNo = normalizeText(invoiceNo)
  if (!normalizedInvoiceNo) return null
  const where = { 'invoice_info.invoice_no': normalizedInvoiceNo }
  if (excludeOrderId) where._id = dbCmd.neq(excludeOrderId)
  const result = await db.collection('cicada_orders')
    .where(where)
    .field({ _id: true, order_no: true })
    .limit(1)
    .get()
  return result.data && result.data[0] ? result.data[0] : null
}

function withActiveOrderFilter(matchCond = {}) {
  return { ...matchCond, is_deleted: dbCmd.neq(true) }
}

function isDeletedOrder(order = {}) {
  return order.is_deleted === true
}

function getBatchDeleteBlockReason(order = {}) {
  if (isDeletedOrder(order)) return '工单已删除'
  if (!['pending', 'cancelled'].includes(normalizeText(order.status))) {
    return '仅已提交或已取消的工单可以删除'
  }

  const paymentStatus = normalizeText(order.payment_status || order.paymentStatus)
  const paymentProofs = order.payment_proofs || order.paymentProofs || []
  if (['uploaded', 'paid', 'refunded'].includes(paymentStatus)
    || normalizeText(order.wechat_pay_transaction_id)
    || (Array.isArray(paymentProofs) && paymentProofs.length)) {
    return '工单已有付款或付款凭证记录'
  }

  if (['processing', 'refunded'].includes(normalizeText(order.refund_status))) {
    return '工单已有退款记录'
  }

  const invoice = order.invoice_info || {}
  if (invoice.need_invoice === true
    || normalizeText(invoice.invoice_no || invoice.invoiceNo)
    || normalizeText(invoice.file_url || invoice.fileUrl || invoice.invoice_url || invoice.invoiceUrl)
    || ['开具中', '已开具', '已寄出', '已签收'].includes(normalizeText(invoice.status))) {
    return '工单已有开票申请或发票记录'
  }

  if (order.inventory_deducted === true || normalizeText(order.inventory_status)) {
    return '工单已有库存处理记录'
  }

  if (['issued', 'confirmed'].includes(normalizeText(order.quote_status)) || Number(order.total_price || 0) > 0) {
    return '工单已有正式报价记录'
  }

  return ''
}

function normalizeCustomerType(value, fallback = '') {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new Error('客户类型格式不正确')
  }
  const customerType = normalizeText(value)
  if (!customerType) return fallback
  if (customerType.length > 40) throw new Error('客户类型不能超过40个字符')
  return customerType
}

function getOrderShipInfo(order = {}, segment = 'out') {
  const info = segment === 'back' ? (order.ship_back_info || {}) : (order.ship_out_info || {})
  return {
    company: normalizeText(info.logistics_company || info.logisticsCompany || info.return_company || info.returnCompany),
    trackingNo: normalizeText(info.logistics_no || info.logisticsNo || info.tracking_no || info.trackingNo || info.return_no || info.returnNo),
    phone: normalizeText(info.phone || info.mobile || info.receiver_phone || info.receiverPhone || info.recipient_phone)
  }
}

async function subscribeOrderLogistics(order = {}, segment = 'back') {
  const info = getOrderShipInfo(order, segment)
  if (!info.company || !info.trackingNo) return
  try {
    const result = await expressProvider.subscribe(info)
    if (!result.configured) return
    const existing = (order.track_cache && order.track_cache[segment]) || {}
    const trackCache = {
      ...(order.track_cache || {}),
      [segment]: {
        ...existing,
        provider: 'kuaidi100',
        trackingNo: info.trackingNo,
        companyCode: result.company && result.company.code,
        subscriptionStatus: result.success ? 'subscribed' : 'failed',
        subscriptionMessage: result.message || '',
        subscribedAt: Date.now()
      }
    }
    await db.collection('cicada_orders').doc(order._id).update({ track_cache: trackCache })
  } catch (error) {
    console.warn('kuaidi100 subscribe failed:', error)
  }
}

// 回寄单号录入源头防错：标准化 + 通用格式校验 + 按公司前缀提示。
// 返回 { ok, value, reason }，reason 用于拦截时写入错误清单。
function validateTrackingNo(rawNo, company = '') {
  // 仅去空格、保留原大小写：客户端查询按精确匹配且不改大小写，强制大写会查不到
  const value = normalizeText(rawNo).replace(/\s/g, '')
  if (!value) return { ok: false, value, reason: '缺少回寄运单号' }
  if (!/^[A-Za-z0-9-]{6,40}$/.test(value)) {
    return { ok: false, value, reason: '运单号格式不正确（仅允许字母、数字、横杠，6-40 位）' }
  }
  // 顺丰单号通常为 SF 开头 + 12-15 位数字，做轻量一致性提示（不强制拦截其它格式）
  const c = normalizeText(company)
  if (/顺丰|SF/i.test(c) && !/^SF/i.test(value)) {
    return { ok: false, value, reason: '顺丰运单号应以 SF 开头，请核对单号与快递公司是否匹配' }
  }
  return { ok: true, value, reason: '' }
}

function buildStatusTimestampUpdate(order = {}, nextStatus = '', now = Date.now()) {
  const currentStatus = normalizeText(order.status)
  const next = normalizeText(nextStatus)
  const update = { status_update_time: now }
  if (currentStatus !== next) update.status_enter_time = now
  return update
}

function getStatusTransitionPrerequisiteError(order = {}, nextStatus = '') {
  const currentStatus = normalizeText(order.status)
  const next = normalizeText(nextStatus)
  if (next === 'fixing' && ['received', 'inspecting'].includes(currentStatus)) {
    const repairStartBlockReason = getRepairStartBlockReason(order)
    if (repairStartBlockReason) return repairStartBlockReason
  }
  if (next === 'received' && ['pending', 'sent'].includes(currentStatus)) {
    const inbound = getOrderShipInfo(order, 'out')
    const arrivalState = normalizeText(order.arrival_confirm_status)
    if (!inbound.trackingNo) return '请先录入寄入物流单号，再确认设备入库'
    if (arrivalState === 'pending') return '请先完成设备入库确认，不能直接修改为已签收'
  }
  if (next === 'shipped' && ['received', 'inspecting', 'fixing'].includes(currentStatus)) {
    const returned = getOrderShipInfo(order, 'back')
    if (!returned.trackingNo) return '请先录入回寄物流单号，再标记为已回寄'
    const shipmentBlockReason = getReturnShipmentPolicyBlockReason(order)
    if (shipmentBlockReason) return shipmentBlockReason
  }
  return ''
}

async function validateTrackingNoBeforeSave(order, rawNo, company, segment = 'back') {
  const localCheck = validateTrackingNo(rawNo, company)
  if (!localCheck.ok) return localCheck
  const conflictFields = [
    { field: 'ship_out_info.logistics_no', segment: 'out' },
    { field: 'ship_out_info.logisticsNo', segment: 'out' },
    { field: 'ship_out_info.tracking_no', segment: 'out' },
    { field: 'ship_out_info.trackingNo', segment: 'out' },
    { field: 'ship_back_info.logistics_no', segment: 'back' },
    { field: 'ship_back_info.logisticsNo', segment: 'back' },
    { field: 'ship_back_info.tracking_no', segment: 'back' },
    { field: 'ship_back_info.trackingNo', segment: 'back' },
    { field: 'ship_back_info.return_no', segment: 'back' },
    { field: 'ship_back_info.returnNo', segment: 'back' }
  ]
  const conflictRes = await db.collection('cicada_orders').where(dbCmd.or(
    conflictFields.map(item => ({ [item.field]: localCheck.value, is_deleted: dbCmd.neq(true) }))
  )).limit(20).get()
  const conflict = findTrackingConflict(conflictRes.data, localCheck.value, order._id, segment)
  if (conflict) {
    return {
      ok: false,
      value: localCheck.value,
      reason: '该运单号已绑定工单 ' + (conflict.order_no || conflict._id || '-') + '，请勿重复使用'
    }
  }

  const phone = getOrderShipInfo(order, segment).phone
  const validation = await expressProvider.verifyWaybill({
    company,
    trackingNo: localCheck.value,
    phone
  })
  if (!validation.ok) {
    return {
      ok: false,
      value: localCheck.value,
      reason: validation.message || '物流单号实时校验未通过',
      validation
    }
  }
  return {
    ok: true,
    value: localCheck.value,
    reason: '',
    warning: validation.warning || '',
    validation
  }
}

function attachVerifiedTrackCache(updateData, order, segment, trackCheck) {
  const validation = trackCheck && trackCheck.validation
  if (!validation || !validation.verified || !validation.cache) return updateData
  const existing = (order.track_cache && order.track_cache[segment]) || {}
  return {
    ...updateData,
    track_cache: {
      ...(order.track_cache || {}),
      [segment]: {
        ...existing,
        ...validation.cache,
        waybillVerifiedAt: Date.now()
      }
    }
  }
}

// 回寄业务策略集中在此。付款核销与实物维修流程独立，未付款不阻止后台回寄。
function getReturnShipmentPolicyBlockReason(order = {}) {
  if (normalizeText(order.status) === 'received'
    && order.needs_return !== true
    && normalizeText(order.archive_status) !== 'pending_return'
    && normalizeText(order.quote_status) !== 'rejected') {
    return '普通已签收工单需先进入检测或处理，只有拒修工单可以直接回寄'
  }
  return getReturnShipmentBlockReason(order)
}

// SN 规范化键：大写、去除所有空格与横杠，用于容错检索匹配。
// 口径必须与 cicada-client-order / cicada-admin-customer 中的同名函数保持一致。
function normalizeSn(value) {
  return normalizeText(value).toUpperCase().replace(/[\s-]+/g, '')
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => normalizeText(item)).filter(Boolean)
}

function extractValidPhone(value) {
  const digits = normalizeText(value).replace(/\D/g, '')
  return /^1\d{10}$/.test(digits) ? digits : ''
}

function genOrderNo() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return 'DR' + datePart + crypto.randomBytes(4).toString('hex').toUpperCase()
}

function sanitizeManualShipInfo(info = {}) {
  const source = info && typeof info === 'object' ? info : {}
  const region = source.region
  return {
    name: normalizeText(source.name).slice(0, 40),
    phone: extractValidPhone(source.phone) || normalizeText(source.phone).replace(/\D/g, '').slice(0, 20),
    unit: normalizeText(source.unit).slice(0, 80),
    region: Array.isArray(region) ? region.map(item => normalizeText(item).slice(0, 40)).filter(Boolean).slice(0, 4) : [],
    detail: normalizeText(source.detail).slice(0, 200),
    logistics_company: normalizeText(source.logistics_company || source.logisticsCompany).slice(0, 40),
    logistics_no: normalizeText(source.logistics_no || source.logisticsNo || source.trackingNo).replace(/\s/g, '').slice(0, 40),
    received_at: normalizeText(source.received_at || source.receivedAt || source.receive_date || source.receiveDate).slice(0, 20)
  }
}

function sanitizeManualOrderItem(item = {}) {
  const data = {
    product_name: normalizeText(item.product_name || item.productName).slice(0, 80),
    product_category: normalizeText(item.product_category || item.productCategory).slice(0, 80),
    product_model: normalizeText(item.product_model || item.productModel || item.model).slice(0, 80),
    sn: normalizeText(item.sn || item.serial).slice(0, 80),
    buy_date: normalizeText(item.buy_date || item.buyDate).slice(0, 20),
    warranty_start_date: normalizeText(item.warranty_start_date || item.warrantyStartDate).slice(0, 20),
    invoice_received_date: normalizeText(item.invoice_received_date || item.invoiceReceivedDate).slice(0, 20),
    manufacture_date: normalizeText(item.manufacture_date || item.manufactureDate).slice(0, 20),
    warranty_months: warrantyPolicy.DEFAULT_PRODUCT_WARRANTY_MONTHS,
    warranty_expire: normalizeText(item.warranty_expire || item.warrantyExpire).slice(0, 20),
    fault_desc: normalizeText(item.fault_desc || item.faultDesc).slice(0, 2000),
    media_urls: normalizeArray(item.media_urls || item.mediaUrls).slice(0, 12),
    voucher_urls: normalizeArray(item.voucher_urls || item.voucherUrls).slice(0, 12),
    image_urls: normalizeArray(item.image_urls || item.imageUrls).slice(0, 12),
    video_urls: normalizeArray(item.video_urls || item.videoUrls).slice(0, 6)
  }
  data.sn_normalized = normalizeSn(data.sn)
  return data
}

async function ensureManualOrderCustomer(customer = {}, shipOutInfo = {}, shipBackInfo = {}) {
  const rawCustomer = customer && typeof customer === 'object' ? customer : {}
  const customerId = normalizeText(rawCustomer.customer_id || rawCustomer._id)
  const phone = extractValidPhone(rawCustomer.phone || shipOutInfo.phone || shipBackInfo.phone)
  const customerType = normalizeCustomerType(rawCustomer.customer_type || rawCustomer.customerType, 'clinic')

  if (customerId) {
    const res = await db.collection('cicada_customers').doc(customerId).get()
    const existing = res.data && res.data[0]
    if (!existing || existing.status === 'cancelled') throw new Error('客户档案不存在或已注销')
    const updateData = { update_time: Date.now() }
    if (phone && !normalizeText(existing.phone)) updateData.phone = phone
    if (normalizeText(rawCustomer.contact) && !normalizeText(existing.contact)) updateData.contact = normalizeText(rawCustomer.contact).slice(0, 40)
    if (normalizeText(rawCustomer.address || shipBackInfo.detail) && !normalizeText(existing.address)) updateData.address = normalizeText(rawCustomer.address || shipBackInfo.detail).slice(0, 200)
    if (normalizeText(rawCustomer.biz_user || rawCustomer.bizUser) && !normalizeText(existing.biz_user)) updateData.biz_user = normalizeText(rawCustomer.biz_user || rawCustomer.bizUser).slice(0, 40)
    if (Object.keys(updateData).length > 1) {
      await db.collection('cicada_customers').doc(customerId).update(updateData).catch(() => {})
    }
    return {
      customer_id: customerId,
      user_id: existing.user_id || '',
      customer_type: existing.customer_type || customerType,
      customer: existing
    }
  }

  if (phone) {
    const found = await db.collection('cicada_customers')
      .where({ phone, status: dbCmd.neq('cancelled') })
      .limit(1)
      .get()
    const existing = found.data && found.data[0]
    if (existing) {
      const updateData = { update_time: Date.now() }
      if (normalizeText(rawCustomer.name) && !normalizeText(existing.name)) updateData.name = normalizeText(rawCustomer.name).slice(0, 80)
      if (normalizeText(rawCustomer.contact) && !normalizeText(existing.contact)) updateData.contact = normalizeText(rawCustomer.contact).slice(0, 40)
      if (normalizeText(rawCustomer.address || shipBackInfo.detail) && !normalizeText(existing.address)) updateData.address = normalizeText(rawCustomer.address || shipBackInfo.detail).slice(0, 200)
      if (normalizeText(rawCustomer.biz_user || rawCustomer.bizUser) && !normalizeText(existing.biz_user)) updateData.biz_user = normalizeText(rawCustomer.biz_user || rawCustomer.bizUser).slice(0, 40)
      if (Object.keys(updateData).length > 1) {
        await db.collection('cicada_customers').doc(existing._id).update(updateData).catch(() => {})
      }
      return {
        customer_id: existing._id,
        user_id: existing.user_id || '',
        customer_type: existing.customer_type || customerType,
        customer: existing
      }
    }
  }

  const name = normalizeText(rawCustomer.name || rawCustomer.clinic_name || rawCustomer.clinicName || shipBackInfo.unit || shipOutInfo.unit || shipOutInfo.name)
  if (!name) throw new Error('客户名称不能为空')
  const now = Date.now()
  const doc = {
    name: name.slice(0, 80),
    contact: normalizeText(rawCustomer.contact || shipOutInfo.name || shipBackInfo.name).slice(0, 40),
    phone,
    customer_type: customerType,
    source: 'offline',
    address: normalizeText(rawCustomer.address || shipBackInfo.detail || shipOutInfo.detail).slice(0, 200),
    dealer_id: normalizeText(rawCustomer.dealer_id).slice(0, 80),
    biz_user: normalizeText(rawCustomer.biz_user || rawCustomer.bizUser).slice(0, 40),
    tags: Array.isArray(rawCustomer.tags) ? rawCustomer.tags.map(item => normalizeText(item)).filter(Boolean) : [],
    remark: normalizeText(rawCustomer.remark).slice(0, 500),
    user_id: '',
    openid: '',
    status: 'active',
    create_time: now,
    update_time: now
  }
  const res = await db.collection('cicada_customers').add(doc)
  return {
    customer_id: res.id,
    user_id: '',
    customer_type: customerType,
    customer: { ...doc, _id: res.id },
    created: true
  }
}

async function upsertManualCustomerDevices(customerInfo = {}, items = [], orderMeta = {}) {
  if (!customerInfo.customer_id || !Array.isArray(items) || !items.length) return
  const now = Date.now()
  for (const item of items) {
    const sn = normalizeText(item && item.sn)
    if (!sn) continue
    const snKey = normalizeSn(sn)
    try {
      let existRes = await db.collection('cicada_user_devices')
        .where({ sn_normalized: snKey })
        .limit(1)
        .get()
      if (!existRes.data || !existRes.data.length) {
        existRes = await db.collection('cicada_user_devices').where({ sn }).limit(1).get()
      }
      const existing = existRes.data && existRes.data[0]
      const baseFields = {
        user_id: customerInfo.user_id || (existing && existing.user_id) || '',
        product_category: item.product_category || (existing && existing.product_category) || '',
        product_name: item.product_name || (existing && existing.product_name) || '已登记设备',
        model: item.product_model || (existing && existing.model) || '',
        sn,
        sn_normalized: snKey,
        buy_date: item.buy_date || (existing && existing.buy_date) || '',
        warranty_start_date: item.warranty_start_date || (existing && existing.warranty_start_date) || '',
        invoice_received_date: item.invoice_received_date || (existing && existing.invoice_received_date) || '',
        manufacture_date: item.manufacture_date || (existing && existing.manufacture_date) || '',
        last_order_no: orderMeta.order_no || (existing && existing.last_order_no) || '',
        last_order_id: orderMeta.order_id || (existing && existing.last_order_id) || '',
        last_repair_status: orderMeta.status || (existing && existing.last_repair_status) || '',
        last_repair_time: now,
        update_time: now
      }
      if (!existing || !normalizeText(existing.customer_id) || normalizeText(existing.customer_id) === customerInfo.customer_id) {
        baseFields.customer_id = customerInfo.customer_id
      }
      if (item.warranty_start_date) baseFields.warranty_start_date = item.warranty_start_date
      if (item.invoice_received_date) baseFields.invoice_received_date = item.invoice_received_date
      if (item.manufacture_date) baseFields.manufacture_date = item.manufacture_date
      if (item.warranty_months > 0) baseFields.warranty_months = item.warranty_months
      if (item.warranty_expire) baseFields.warranty_expire = item.warranty_expire
      if (existing) {
        await db.collection('cicada_user_devices').doc(existing._id).update({
          ...baseFields,
          repair_count: Number(existing.repair_count || 0) + 1
        })
      } else {
        await db.collection('cicada_user_devices').add({
          ...baseFields,
          repair_count: 1,
          source: 'admin_manual_order',
          create_time: now
        })
      }
    } catch (e) {
      console.warn('代客建单设备沉淀失败:', e && e.message)
    }
  }
}

async function applyRepairWarrantyExtension(order = {}, now = Date.now()) {
  const itemKeys = [order._id, order.order_no].filter(Boolean)
  if (!itemKeys.length) return
  const itemsRes = await db.collection('cicada_order_items').where({ order_id: dbCmd.in(itemKeys) }).get()
  const items = itemsRes.data || []
  for (const item of items) {
    const sn = normalizeText(item && item.sn)
    if (!sn) continue
    const extension = warrantyPolicy.buildRepairWarrantyExtension(order, [item], now)
    if (!extension) continue
    const snKey = normalizeSn(sn)
    let deviceRes = await db.collection('cicada_user_devices').where({ sn_normalized: snKey }).limit(1).get()
    if (!deviceRes.data || !deviceRes.data.length) {
      deviceRes = await db.collection('cicada_user_devices').where({ sn }).limit(1).get()
    }
    const device = deviceRes.data && deviceRes.data[0]
    if (!device) continue
    const extensions = warrantyPolicy.appendWarrantyExtension(device.ext_warranty, extension)
    if (extensions.length !== (Array.isArray(device.ext_warranty) ? device.ext_warranty.length : 0)) {
      await db.collection('cicada_user_devices').doc(device._id).update({ ext_warranty: extensions, update_time: now })
    }
  }
}

function computeWarrantyState(source = {}) {
  return warrantyPolicy.computeWarrantyState(source)
}

// 重算工单级在保结论：逐个 SN 优先查已建档设备，否则用工单项购机日期推算。
// 返回 { in_warranty, warranty_status, charge_type }
async function computeOrderWarrantyFromItems(items = []) {
  let anyInWarranty = false
  let anyEvaluated = false
  let anyPendingReview = false
  let anyFree = false
  let anyPaid = false
  const evaluatedItems = []
  for (const item of items) {
    const sn = normalizeText(item && item.sn)
    let device = null
    if (sn) {
      try {
        const snKey = normalizeSn(sn)
        let res = await db.collection('cicada_user_devices').where({ sn_normalized: snKey }).limit(1).get()
        if (!res.data || !res.data.length) {
          res = await db.collection('cicada_user_devices').where({ sn }).limit(1).get()
        }
        device = res.data && res.data[0]
      } catch (e) { device = null }
    }
    const hasItemWarranty = Boolean(normalizeText(item && item.warranty_expire))
      || Boolean(normalizeText(item && (item.warranty_start_date || item.invoice_received_date || item.manufacture_date || item.buy_date)))
    const source = hasItemWarranty ? {
      ...(device || {}),
      buy_date: item && item.buy_date,
      warranty_start_date: item && item.warranty_start_date,
      invoice_received_date: item && item.invoice_received_date,
      manufacture_date: item && item.manufacture_date,
      warranty_months: item && item.warranty_months,
      warranty_expire: item && item.warranty_expire,
      repair_warranty_match: normalizeText(item && item.coverage_reason) === 'repair_warranty'
    } : {
      ...(device || {}),
      repair_warranty_match: normalizeText(item && item.coverage_reason) === 'repair_warranty'
    }
    const warrantyState = computeWarrantyState(source)
    if (warrantyState.warranty_status === 'unknown') continue
    if (item) item.warranty_status = warrantyState.warranty_status
    anyEvaluated = true
    if (warrantyState.in_warranty) anyInWarranty = true
    const coverageResult = normalizeText(item && item.coverage_result)
    const coverageReason = normalizeText(item && item.coverage_reason)
    const isExplicitFree = coverageResult === 'free' && warrantyPolicy.isFreeCoverageReason(coverageReason)
    const isExplicitPaid = ['paid', 'partial', 'not_covered'].includes(coverageResult)
    const isPendingCoverage = warrantyState.in_warranty && !coverageResult
    if (isPendingCoverage || coverageResult === 'pending') anyPendingReview = true
    if (isExplicitFree) anyFree = true
    if (isExplicitPaid || (!warrantyState.in_warranty && coverageResult !== 'free')) anyPaid = true
    evaluatedItems.push({
      warranty_status: warrantyState.warranty_status,
      coverage_result: coverageResult,
      free: isExplicitFree && warrantyState.in_warranty
    })
  }
  if (!anyEvaluated) return { in_warranty: false, warranty_status: 'unknown', charge_type: 'pending' }
  const allExplicitFree = evaluatedItems.length > 0 && evaluatedItems.every(item => item.free)
  return {
    in_warranty: anyInWarranty,
    warranty_status: anyInWarranty ? 'in_warranty' : 'expired',
    charge_type: allExplicitFree ? 'free' : (anyPendingReview && !anyPaid && !anyFree ? 'pending' : 'paid')
  }
}

async function isOrderWarrantyFreeConfirmed(order = {}) {
  const itemKeys = [order._id, order.order_no].filter(Boolean)
  if (!itemKeys.length) return false
  const res = await db.collection('cicada_order_items').where({ order_id: dbCmd.in(itemKeys) }).get()
  const items = res.data || []
  const warranty = await computeOrderWarrantyFromItems(items)
  return isWarrantyFreeItemSet(items, warranty)
}

function isWarrantyFreeItemSet(items = [], warranty = {}) {
  if (!(warranty.charge_type === 'free'
    && Boolean(warranty.in_warranty)
    && ['in_warranty', 'extended'].includes(normalizeText(warranty.warranty_status)))) {
    return false
  }
  if (!Array.isArray(items) || !items.length) return false
  return items.every(item =>
    normalizeText(item && item.coverage_result) === 'free'
    && warrantyPolicy.isFreeCoverageReason(item && item.coverage_reason)
    && ['in_warranty', 'extended'].includes(normalizeText(item && item.warranty_status))
  )
}

function normalizeInvoiceStatusFilter(value = '') {
  const text = normalizeText(value)
  if (!text) return ''
  const map = {
    未发票: '待开票',
    已发票: '已开具',
    已寄出: '已寄出',
    已签收: '已签收'
  }
  return map[text] || text
}

function matchesTodoType(order = {}, todoType = '') {
  const type = normalizeText(todoType)
  if (!type) return true
  const status = order.status || ''
  const invoiceInfo = order.invoice_info || {}
  const quoteStatus = order.quote_status || 'pending'
  const paymentStatus = order.payment_status || 'pending'
  const totalPrice = Number(order.total_price || 0)

  if (type === 'inbound') return ['pending', 'sent'].includes(status)
  if (type === 'quote') return ['received', 'inspecting', 'fixing'].includes(status) && ['pending', 'draft'].includes(quoteStatus)
  if (type === 'payment') return totalPrice > 0 && paymentStatus === 'uploaded'
  if (type === 'invoice') return Boolean(invoiceInfo.need_invoice) && ['待开票', '开具中', '未发票'].includes(invoiceInfo.status || '待开票')
  if (type === 'return') {
    if (status === 'received') {
      return order.needs_return === true
        || order.archive_status === 'pending_return'
        || quoteStatus === 'rejected'
    }
    return ['fixing', 'inspecting'].includes(status)
      && ['issued', 'confirmed', 'rejected'].includes(quoteStatus)
  }
  if (type === 'exception') return status !== 'cancelled' && Boolean(order.admin_exception || order.exception_reason)
  return true
}

function normalizeImportRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((row = {}, index) => ({
    rowIndex: index + 2,
    order_no: normalizeText(row.order_no || row.orderNo || row['工单编号'] || row['工单号']),
    logistics_company: normalizeText(row.logistics_company || row.logisticsCompany || row.return_company || row['回寄物流公司'] || row['物流公司']),
    logistics_no: normalizeText(row.logistics_no || row.logisticsNo || row.return_no || row.tracking_no || row.trackingNo || row['回寄运单号'] || row['运单号'] || row['快递单号']),
    shipped_at: normalizeText(row.shipped_at || row.shippedAt || row['发货日期']),
    remark: normalizeText(row.remark || row['备注'])
  }))
}

function buildShipBackInfo(order, item, now) {
  const shipBack = order.ship_back_info || {}
  const next = {
    ...shipBack,
    logistics_company: item.logistics_company,
    logistics_no: item.logistics_no,
    shipped_at: item.shipped_at || now
  }
  if (item.remark) next.remark = item.remark
  return next
}

function normalizeShippingList(shippingList) {
  if (!Array.isArray(shippingList)) return []
  return shippingList.map((item = {}) => ({
    orderNo: normalizeText(item.orderNo || item.order_no || item['工单编号'] || item['工单号']),
    returnCompany: normalizeText(item.returnCompany || item.return_company || item.logistics_company || item['回寄物流公司'] || item['物流公司']),
    returnNo: normalizeText(item.returnNo || item.return_no || item.logistics_no || item.trackingNo || item['回寄运单号'] || item['运单号'] || item['快递单号'])
  }))
}

function buildReturnShippingInfo(order, item, now) {
  const shipBack = order.ship_back_info || {}
  return {
    ...shipBack,
    returnCompany: item.returnCompany,
    returnNo: item.returnNo,
    return_company: item.returnCompany,
    return_no: item.returnNo,
    logistics_company: item.returnCompany,
    logistics_no: item.returnNo,
    shipped_at: now
  }
}

function buildArchiveStatusUpdate(order = {}, nextStatus = '') {
  const isRejectReturn = order.needs_return === true
    || order.archive_status === 'pending_return'
    || order.archive_status === 'returned'
    || order.quote_status === 'rejected'
  if (!isRejectReturn) return {}
  if (nextStatus === 'shipped') return { needs_return: false, archive_status: 'returned' }
  if (nextStatus === 'completed') return { needs_return: false, archive_status: 'archived' }
  return {}
}

function normalizeLogisticsImportRows(rows, type = 'return') {
  if (!Array.isArray(rows)) return []
  return rows
    .map((item = {}) => ({
      orderNo: normalizeText(item.orderNo || item.order_no || item['工单编号'] || item['工单号']),
      logisticsCompany: normalizeText(item.logisticsCompany || item.logistics_company || item.returnCompany || item.return_company || item['物流公司'] || item['回寄物流公司'] || item['寄入物流公司']),
      logisticsNo: normalizeText(item.logisticsNo || item.logistics_no || item.returnNo || item.return_no || item.trackingNo || item.tracking_no || item['物流单号'] || item['运单号'] || item['快递单号'] || item['回寄运单号'] || item['寄入物流单号']),
      eventTime: normalizeText(item.eventTime || item.event_time || item.shipped_at || item.received_at || item['发货时间'] || item['签收时间'] || item['时间']),
      remark: normalizeText(item.remark || item['备注']),
      type
    }))
    .filter(item => item.orderNo || item.logisticsCompany || item.logisticsNo)
}

function buildShipOutImportInfo(order, item, eventTime) {
  const shipOut = order.ship_out_info || {}
  return {
    ...shipOut,
    logisticsCompany: item.logisticsCompany,
    logisticsNo: item.logisticsNo,
    logistics_company: item.logisticsCompany,
    logistics_no: item.logisticsNo,
    received_at: eventTime
  }
}

function buildShipBackImportInfo(order, item, eventTime) {
  const shipBack = order.ship_back_info || {}
  return {
    ...shipBack,
    returnCompany: item.logisticsCompany,
    returnNo: item.logisticsNo,
    return_company: item.logisticsCompany,
    return_no: item.logisticsNo,
    logistics_company: item.logisticsCompany,
    logistics_no: item.logisticsNo,
    shipped_at: eventTime
  }
}

function getOrderStatusRank(status = '') {
  const ranks = {
    pending: 1,
    sent: 2,
    received: 3,
    inspecting: 4,
    fixing: 5,
    shipped: 6,
    completed: 7,
    cancelled: 99
  }
  return ranks[status] || 0
}

function buildLogisticsImportUpdate(order, item, type, now, importDate = '') {
  const eventTime = item.eventTime || importDate || now
  const isInbound = type === 'inbound'
  const targetStatus = isInbound ? 'received' : 'shipped'
  const currentRank = getOrderStatusRank(order.status)
  const targetRank = getOrderStatusRank(targetStatus)
  const nextStatus = currentRank > targetRank ? order.status : targetStatus
  const company = item.logisticsCompany || '物流'
  const timelineTitle = isInbound ? '客户寄入已签收' : '回寄发货'
  const timelineDesc = `${company} ${item.logisticsNo}`
  const timeline = Array.isArray(order.timeline) ? order.timeline : []
  const shouldAppendTimeline = order.status !== nextStatus || !timeline.some(node => node && node.title === timelineTitle && String(node.desc || '').includes(item.logisticsNo))

  const updateData = {
    status: nextStatus,
    ...buildStatusTimestampUpdate(order, nextStatus, now),
    update_time: now
  }

  if (isInbound) {
    updateData.ship_out_info = buildShipOutImportInfo(order, item, eventTime)
  } else {
    updateData.ship_back_info = buildShipBackImportInfo(order, item, eventTime)
    Object.assign(updateData, buildArchiveStatusUpdate(order, 'shipped'))
  }

  if (shouldAppendTimeline) {
    updateData.timeline = [
      ...timeline,
      {
        title: timelineTitle,
        desc: timelineDesc,
        time: now,
        done: true
      }
    ]
  }

  return updateData
}

async function findOrderByNo(orderNo) {
  const orderNoRes = await db.collection('cicada_orders')
    .where(withActiveOrderFilter({ order_no: orderNo }))
    .limit(1)
    .get()
  if (orderNoRes.data && orderNoRes.data[0]) return orderNoRes.data[0]

  try {
    const idRes = await db.collection('cicada_orders').doc(orderNo).get()
    const order = idRes.data && idRes.data[0] ? idRes.data[0] : null
    return order && !isDeletedOrder(order) ? order : null
  } catch (e) {
    return null
  }
}

const INVOICE_STATUS = ['无需开票', '待开票', '开具中', '已开具', '已寄出', '已签收']
const QUOTE_STATUS = ['pending', 'draft', 'issued', 'confirmed', 'rejected']
const PAYMENT_STATUS = ['pending', 'uploaded', 'paid', 'rejected', 'not_required']
const DEFAULT_PAYMENT_DEADLINE_DAYS = 7

function normalizeInvoiceStatusValue(status = '') {
  const value = normalizeText(status)
  const map = {
    未发票: '待开票',
    已发票: '已开具'
  }
  return map[value] || value
}

function normalizeQuoteItems(items) {
  if (!Array.isArray(items)) return []
  return items.map((item = {}) => {
    const name = normalizeText(item.name || item.title || item.projectName)
    const desc = normalizeText(item.desc || item.description || item.remark)
    const partsFee = Math.max(Number(item.partsFee ?? item.parts_fee ?? item.partFee ?? item.part_fee ?? item.materialFee ?? item.material_fee ?? 0) || 0, 0)
    const laborFee = Math.max(Number(item.laborFee ?? item.labor_fee ?? item.workFee ?? item.work_fee ?? item.serviceFee ?? item.service_fee ?? 0) || 0, 0)
    return {
      name: name || '维修费用',
      desc,
      parts_fee: partsFee,
      labor_fee: laborFee
    }
  }).filter(item => item.name || item.desc || item.parts_fee > 0 || item.labor_fee > 0)
}

function normalizeQuoteAmount(value) {
  return Math.max(Number(value || 0) || 0, 0)
}

function normalizeQuoteDetailRows(rows, type = 'services') {
  if (!Array.isArray(rows)) return []
  return rows.map((item = {}) => {
    const unitPrice = normalizeQuoteAmount(item.unitPrice ?? item.unit_price ?? item.price ?? item.projectPrice ?? item.project_price ?? item.sale_price)
    const quantity = Math.max(Number(item.quantity ?? item.qty ?? item.count ?? 1) || 1, 0)
    const amount = normalizeQuoteAmount(item.amount ?? item.total ?? unitPrice * quantity)
    const base = {
      name: normalizeText(item.name || item.title || item.projectName || item.project_name || item.part_name),
      unit_price: unitPrice,
      quantity,
      amount,
      remark: normalizeText(item.remark || item.desc || item.description)
    }
    if (type === 'parts') {
      return {
        ...base,
        part_id: normalizeText(item.part_id || item.partId || item._id),
        part_code: normalizeText(item.part_code || item.partCode || item.code || item.no),
        model: normalizeText(item.model || item.part_model || item.partModel),
        device_sn: normalizeText(item.device_sn || item.deviceSn),
        warranty_eligible: item.warranty_eligible === true || item.warrantyEligible === true,
        name: base.name || '配件费用'
      }
    }
    if (type === 'services') {
      return {
        ...base,
        service_id: normalizeText(item.service_id || item.serviceId || item._id),
        product_category: normalizeText(item.product_category || item.productCategory || item.category),
        name: base.name || '服务费用'
      }
    }
    return {
      ...base,
      name: base.name || '其他费用'
    }
  }).filter(item => item.name || item.amount > 0)
}

function sumQuoteRows(rows = []) {
  return rows.reduce((sum, item) => sum + normalizeQuoteAmount(item.amount), 0)
}

function buildQuoteDetailFromLegacy(quoteItems = [], remark = '') {
  const parts = []
  const services = []
  quoteItems.forEach((item = {}) => {
    if (normalizeQuoteAmount(item.parts_fee) > 0) {
      parts.push({
        name: item.name || '配件费用',
        model: '',
        unit_price: normalizeQuoteAmount(item.parts_fee),
        quantity: 1,
        amount: normalizeQuoteAmount(item.parts_fee),
        remark: item.desc || ''
      })
    }
    if (normalizeQuoteAmount(item.labor_fee) > 0) {
      services.push({
        name: item.name || '服务费用',
        product_category: '',
        unit_price: normalizeQuoteAmount(item.labor_fee),
        quantity: 1,
        amount: normalizeQuoteAmount(item.labor_fee),
        remark: item.desc || ''
      })
    }
  })
  const partsTotal = sumQuoteRows(parts)
  const servicesTotal = sumQuoteRows(services)
  const others = []
  const othersTotal = 0
  const autoTotal = partsTotal + servicesTotal + othersTotal
  return {
    parts,
    services,
    others,
    parts_total: partsTotal,
    services_total: servicesTotal,
    others_total: othersTotal,
    auto_total: autoTotal,
    final_price: autoTotal,
    remark
  }
}

function normalizeQuoteDetail(quote = {}, quoteItems = []) {
  const source = quote.quote_detail || quote.quoteDetail || quote
  const remark = normalizeText(quote.remark || quote.quote_remark || quote.quoteRemark || source.remark)
  const hasStructuredRows = Array.isArray(source.parts) || Array.isArray(source.services) || Array.isArray(source.others)
  if (!hasStructuredRows) return buildQuoteDetailFromLegacy(quoteItems, remark)

  const parts = normalizeQuoteDetailRows(source.parts, 'parts')
  const services = normalizeQuoteDetailRows(source.services, 'services')
  const others = normalizeQuoteDetailRows(source.others, 'others')
  const partsTotal = sumQuoteRows(parts)
  const servicesTotal = sumQuoteRows(services)
  const othersTotal = sumQuoteRows(others)
  const autoTotal = partsTotal + servicesTotal + othersTotal
  const finalPrice = normalizeQuoteAmount(source.final_price ?? source.finalPrice ?? quote.final_price ?? quote.finalPrice ?? autoTotal)
  return {
    parts,
    services,
    others,
    parts_total: partsTotal,
    services_total: servicesTotal,
    others_total: othersTotal,
    auto_total: autoTotal,
    final_price: finalPrice,
    remark
  }
}

function buildLegacyQuoteItemsFromDetail(detail = {}, fallbackItems = []) {
  const items = []
  ;(detail.parts || []).forEach(item => {
    items.push({
      name: item.name || '配件费用',
      desc: item.remark || [item.part_code, item.model].filter(Boolean).join(' / '),
      parts_fee: normalizeQuoteAmount(item.amount),
      labor_fee: 0
    })
  })
  ;(detail.services || []).forEach(item => {
    items.push({
      name: item.name || '服务费用',
      desc: item.remark || item.product_category || '',
      parts_fee: 0,
      labor_fee: normalizeQuoteAmount(item.amount)
    })
  })
  ;(detail.others || []).forEach(item => {
    items.push({
      name: item.name || '其他费用',
      desc: item.remark || '',
      parts_fee: 0,
      labor_fee: normalizeQuoteAmount(item.amount)
    })
  })
  return items.length ? items : fallbackItems
}

function normalizePartInput(part = {}) {
  return {
    part_code: normalizeText(part.part_code || part.partCode || part.code),
    part_name: normalizeText(part.part_name || part.partName || part.name),
    model: normalizeText(part.model || part.part_model || part.partModel),
    compatible_models: Array.isArray(part.compatible_models)
      ? part.compatible_models.map(normalizeText).filter(Boolean)
      : normalizeText(part.compatibleModels || part.compatible_models).split(/[,，、\n]/).map(normalizeText).filter(Boolean),
    purchase_cost: normalizeQuoteAmount(part.purchase_cost ?? part.purchaseCost),
    sale_price: normalizeQuoteAmount(part.sale_price ?? part.salePrice ?? part.unit_price ?? part.unitPrice),
    stock: Math.max(Number(part.stock ?? 0) || 0, 0),
    warning_threshold: Math.max(Number(part.warning_threshold ?? part.warningThreshold ?? 0) || 0, 0),
    enabled: normalizeBooleanValue(part.enabled, true),
    remark: normalizeText(part.remark)
  }
}

function canViewNotificationGroup(user = {}, roles = []) {
  return user.role === 'superadmin' || roles.includes(user.role)
}

function buildOrderNotificationSamples(orders = [], description) {
  return orders.slice(0, 5).map(order => ({
    id: order._id || '',
    title: `工单 ${order.order_no || order._id || '-'}`,
    desc: description(order)
  }))
}

async function collectLogisticsExceptions(sourceOrders = null) {
  const now = Date.now()
  const H = 60 * 60 * 1000
  const NO_PICKUP_MS = 48 * H
  const STALLED_MS = 72 * H
  const orders = Array.isArray(sourceOrders)
    ? sourceOrders.filter(order => ['pending', 'sent', 'shipped'].includes(order.status))
    : await fetchOrderBatches({ status: dbCmd.in(['pending', 'sent', 'shipped']) })
  const exceptions = []
  for (const order of orders) {
    const out = order.ship_out_info || {}
    const back = order.ship_back_info || {}
    const outTrack = (order.track_cache && order.track_cache.out) || {}
    const backTrack = (order.track_cache && order.track_cache.back) || {}
    const outNo = normalizeText(out.logistics_no || out.logisticsNo)
    const backNo = normalizeText(back.logistics_no || back.logisticsNo || back.return_no || back.returnNo)
    const updatedAt = Number(order.update_time) || Number(order.create_time) || 0
    const base = { orderNo: order.order_no || '', orderId: order._id }
    const pushException = (segment, track, fallback) => {
      const state = normalizeText(track.state)
      if (!['2', '4', '6', '14'].includes(state)) return false
      exceptions.push({
        ...base,
        segment,
        type: 'provider_exception',
        hours: 0,
        company: fallback.company,
        trackingNo: fallback.trackingNo,
        reason: track.status || track.message || '快递100返回物流异常，请及时核实'
      })
      return true
    }
    if (outNo && ['pending', 'sent'].includes(order.status) && !pushException('out', outTrack, { company: normalizeText(out.logistics_company || out.logisticsCompany), trackingNo: outNo })) {
      const lastTrackAt = Date.parse(outTrack.lastTrackAt || '') || 0
      const since = now - (lastTrackAt || Number(out.shipped_at || out.shippedAt) || Number(order.create_time) || 0)
      if (order.status === 'pending' && since > NO_PICKUP_MS) {
        exceptions.push({ ...base, segment: 'out', type: 'no_pickup', hours: Math.floor(since / H), company: normalizeText(out.logistics_company || out.logisticsCompany), trackingNo: outNo, reason: '客户寄出超 48h 未签收，建议催寄/核实' })
      } else if (normalizeText(outTrack.state) !== '3' && order.status === 'sent' && since > STALLED_MS) {
        exceptions.push({ ...base, segment: 'out', type: 'stalled', hours: Math.floor(since / H), company: normalizeText(out.logistics_company || out.logisticsCompany), trackingNo: outNo, reason: '客户寄出运输停滞超 72h，建议联系快递核实' })
      }
    }
    if (backNo && order.status === 'shipped' && !pushException('back', backTrack, { company: normalizeText(back.logistics_company || back.logisticsCompany || back.returnCompany), trackingNo: backNo })) {
      const lastTrackAt = Date.parse(backTrack.lastTrackAt || '') || updatedAt
      if (normalizeText(backTrack.state) !== '3' && lastTrackAt && now - lastTrackAt > STALLED_MS) {
        exceptions.push({ ...base, segment: 'back', type: 'stalled', hours: Math.floor((now - lastTrackAt) / H), company: normalizeText(back.logistics_company || back.logisticsCompany || back.returnCompany), trackingNo: backNo, reason: '回寄运输停滞超 72h，建议联系快递核实' })
      }
    }
  }
  return exceptions.sort((a, b) => b.hours - a.hours)
}

function normalizeBooleanValue(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue
  if (typeof value === 'boolean') return value
  const text = normalizeText(value).toLowerCase()
  if (['true', '1', 'yes', 'y', '启用', '是', '正常'].includes(text)) return true
  if (['false', '0', 'no', 'n', '禁用', '否', '停用'].includes(text)) return false
  return Boolean(value)
}

const PART_IMPORT_NUMBER_FIELDS = [
  { label: '采购成本', keys: ['purchase_cost', 'purchaseCost'], integer: false },
  { label: '销售单价', keys: ['sale_price', 'salePrice', 'unit_price', 'unitPrice'], integer: false },
  { label: '当前库存', keys: ['stock'], integer: true },
  { label: '预警阈值', keys: ['warning_threshold', 'warningThreshold'], integer: true }
]

function pickRawPartField(part = {}, keys = []) {
  for (const key of keys) {
    if (part[key] !== undefined && part[key] !== null && normalizeText(part[key]) !== '') return part[key]
  }
  return ''
}

function getInvalidPartNumberFields(part = {}) {
  return PART_IMPORT_NUMBER_FIELDS.filter(field => {
    const value = pickRawPartField(part, field.keys)
    if (value === '') return false
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue) || numberValue < 0) return true
    return field.integer && !Number.isInteger(numberValue)
  }).map(field => field.label)
}

// canViewCost：采购成本属敏感商业数据，仅 admin/superadmin/finance 可见；engineer 等角色不下发成本字段
function mapPartForClient(part = {}, canViewCost = true) {
  const stock = Number(part.stock || 0) || 0
  const warningThreshold = Number(part.warning_threshold || 0) || 0
  const mapped = {
    ...part,
    partCode: part.part_code || '',
    partName: part.part_name || '',
    compatibleModels: part.compatible_models || [],
    purchaseCost: Number(part.purchase_cost || 0),
    salePrice: Number(part.sale_price || 0),
    warningThreshold,
    lowStock: warningThreshold > 0 && stock <= warningThreshold
  }
  if (!canViewCost) {
    delete mapped.purchase_cost
    delete mapped.purchaseCost
  }
  return mapped
}

// 是否允许查看配件采购成本
function canViewPartCost(admin = {}) {
  return ['superadmin', 'admin', 'finance'].includes(String(admin && admin.role || '').toLowerCase())
}

function getQuoteInventoryLines(order = {}) {
  const detail = order.quote_detail || order.quoteDetail || {}
  const parts = Array.isArray(detail.parts) ? detail.parts : []
  const merged = new Map()
  parts.forEach((item = {}) => {
    const partId = normalizeText(item.part_id || item.partId)
    const partCode = normalizeText(item.part_code || item.partCode)
    if (!partId && !partCode) return
    const key = partId || `code:${partCode}`
    const prev = merged.get(key) || {
      part_id: partId,
      part_code: partCode,
      part_name: normalizeText(item.name || item.part_name || item.partName),
      model: normalizeText(item.model),
      quantity: 0
    }
    prev.quantity += Math.max(Number(item.quantity || 0) || 0, 0)
    merged.set(key, prev)
  })
  return [...merged.values()].filter(item => item.quantity > 0)
}

// 报价里是否填写了配件（无论是否绑定库存），用于区分"无配件"与"有配件但未绑库存"
function quoteHasAnyParts(order = {}) {
  const detail = order.quote_detail || order.quoteDetail || {}
  const parts = Array.isArray(detail.parts) ? detail.parts : []
  return parts.some(item => {
    const name = normalizeText(item && (item.name || item.part_name || item.partName))
    const qty = Math.max(Number(item && item.quantity || 0) || 0, 0)
    return name && qty > 0
  })
}

async function findInventoryPart(line = {}) {
  if (line.part_id) {
    const res = await db.collection('cicada_parts').doc(line.part_id).get()
    if (res.data && res.data[0]) return res.data[0]
  }
  if (line.part_code) {
    const res = await db.collection('cicada_parts')
      .where({ part_code: line.part_code })
      .limit(1)
      .get()
    if (res.data && res.data[0]) return res.data[0]
  }
  return null
}

async function outboundOrderInventory(order = {}, actor = {}, now = Date.now(), { required = false } = {}) {
  if (order.inventory_deducted) {
    return { skipped: true, reason: '该工单已完成配件出库', flows: [] }
  }
  const lines = getQuoteInventoryLines(order)
  if (!lines.length) {
    // 区分"报价无配件"与"报价含配件但未绑定库存"——后者属需人工核对的告警，不能静默跳过
    if (quoteHasAnyParts(order)) {
      const warning = '报价包含配件但未绑定库存配件，库存未自动扣减，请在库存管理中核对领用'
      if (required) throw new Error(warning)
      return { skipped: true, warning: true, reason: warning, flows: [] }
    }
    return { skipped: true, reason: '报价未绑定库存配件', flows: [] }
  }

  const resolved = []
  for (const line of lines) {
    const part = await findInventoryPart(line)
    if (!part || part.enabled === false) {
      throw new Error(`配件 ${line.part_code || line.part_name || line.part_id} 不存在或已禁用`)
    }
    const stock = Number(part.stock || 0) || 0
    if (stock < line.quantity) {
      throw new Error(`配件 ${part.part_name || part.part_code} 库存不足，当前 ${stock}，需 ${line.quantity}`)
    }
    resolved.push({ line, part })
  }

  const orderLockRes = await db.collection('cicada_orders')
    .where({
      _id: order._id,
      inventory_deducted: dbCmd.neq(true),
      inventory_status: dbCmd.neq('outbound_processing')
    })
    .update({
      inventory_status: 'outbound_processing',
      inventory_processing_at: now,
      update_time: now
    })
  if (!orderLockRes.updated) {
    return { skipped: true, reason: '该工单已完成或正在进行配件出库', flows: [] }
  }

  const deducted = []
  const flowPayloads = []
  const flows = []
  try {
    for (const { line, part } of resolved) {
      const deductRes = await db.collection('cicada_parts')
        .where({ _id: part._id, stock: dbCmd.gte(line.quantity) })
        .update({
          stock: dbCmd.inc(-line.quantity),
          update_time: now
        })
      if (!deductRes.updated) {
        const latestRes = await db.collection('cicada_parts').doc(part._id).get()
        const latestPart = latestRes.data && latestRes.data[0]
        const latestStock = Number(latestPart && latestPart.stock || 0) || 0
        throw new Error(`配件 ${part.part_name || part.part_code} 库存不足，当前 ${latestStock}，需 ${line.quantity}`)
      }
      const latestRes = await db.collection('cicada_parts').doc(part._id).get()
      const latestPart = latestRes.data && latestRes.data[0]
      const afterStock = Number(latestPart && latestPart.stock || 0) || 0
      const beforeStock = afterStock + line.quantity
      deducted.push({ part_id: part._id, quantity: line.quantity })
      flowPayloads.push({
        part_id: part._id,
        part_code: part.part_code || line.part_code || '',
        part_name: part.part_name || line.part_name || '',
        order_id: order._id || '',
        order_no: order.order_no || '',
        flow_type: 'outbound',
        quantity: line.quantity,
        before_stock: beforeStock,
        after_stock: afterStock,
        operator_id: actor._id || '',
        operator_name: actor.name || actor.username || '',
        remark: '工单维修领用出库',
        create_time: now
      })
    }

    for (const flow of flowPayloads) {
      const addRes = await db.collection('cicada_inventory_flows').add(flow)
      flows.push({ ...flow, _id: addRes.id })
    }

    const completedAt = Date.now()
    await db.collection('cicada_orders').doc(order._id).update({
      inventory_deducted: true,
      inventory_deduct_time: completedAt,
      inventory_status: 'outbound',
      inventory_processing_at: 0,
      update_time: completedAt
    })
  } catch (error) {
    for (const item of deducted.reverse()) {
      await db.collection('cicada_parts').doc(item.part_id).update({
        stock: dbCmd.inc(item.quantity),
        update_time: Date.now()
      })
    }
    for (const flow of flows) {
      if (flow._id) await db.collection('cicada_inventory_flows').doc(flow._id).remove()
    }
    await db.collection('cicada_orders').doc(order._id).update({
      inventory_deducted: false,
      inventory_status: 'outbound_failed',
      inventory_processing_at: 0,
      update_time: Date.now()
    })
    throw error
  }

  await logOrderEvent({
    order,
    action: 'inventory_outbound',
    actor,
    before: { inventory_deducted: Boolean(order.inventory_deducted) },
    after: { inventory_deducted: true, flows: flows.map(item => ({ part_code: item.part_code, quantity: item.quantity })) }
  })

  return { skipped: false, flows }
}

function buildQuoteData(quote = {}, now, order = {}) {
  const status = normalizeText(quote.status || quote.quote_status || quote.quoteStatus || 'draft') || 'draft'
  if (!QUOTE_STATUS.includes(status)) {
    throw new Error('报价状态不正确')
  }

  const legacyItems = normalizeQuoteItems(quote.items || quote.quote_items || quote.quoteItems)
  let quoteDetail = normalizeQuoteDetail(quote, legacyItems)
  let quoteItems = buildLegacyQuoteItemsFromDetail(quoteDetail, legacyItems)
  let partsFee = normalizeQuoteAmount(quoteDetail.parts_total)
  let laborFee = normalizeQuoteAmount(quoteDetail.services_total) + normalizeQuoteAmount(quoteDetail.others_total)
  const totalPrice = normalizeQuoteAmount(quoteDetail.final_price)
  let autoTotal = normalizeQuoteAmount(quoteDetail.auto_total)
  const quoteRemark = normalizeText(quoteDetail.remark || quote.remark || quote.quote_remark || quote.quoteRemark)

  if (!quoteItems.length && totalPrice > 0) {
    const simpleService = {
      name: '维修费用',
      product_category: '',
      unit_price: totalPrice,
      quantity: 1,
      amount: totalPrice,
      remark: quoteRemark || '简易报价'
    }
    quoteDetail = {
      ...quoteDetail,
      parts: [],
      services: [simpleService],
      others: [],
      parts_total: 0,
      services_total: totalPrice,
      others_total: 0,
      auto_total: totalPrice,
      final_price: totalPrice
    }
    quoteItems = buildLegacyQuoteItemsFromDetail(quoteDetail, legacyItems)
    partsFee = 0
    laborFee = totalPrice
    autoTotal = totalPrice
  }

  if (quoteRemark.length > 200) {
    throw new Error('报价备注不能超过200字')
  }

  const isWarrantyFree = order.warranty_free_confirmed === true
  if ((status === 'draft' || status === 'issued') && totalPrice <= 0) {
    if (!isWarrantyFree) throw new Error('仅所有设备均明确为质保免费的工单可以发布零元质保方案')
    quoteDetail = {
      ...quoteDetail,
      parts: [],
      services: [{
        name: '质保服务',
        unit_price: 0,
        quantity: 1,
        amount: 0,
        remark: quoteRemark || '原厂质保期内免收维修费用'
      }],
      others: [],
      parts_total: 0,
      services_total: 0,
      others_total: 0,
      auto_total: 0,
      final_price: 0
    }
    quoteItems = [{
      name: '质保服务',
      desc: quoteRemark || '原厂质保期内免收维修费用',
      parts_fee: 0,
      labor_fee: 0
    }]
    partsFee = 0
    laborFee = 0
    autoTotal = 0
  } else if ((status === 'draft' || status === 'issued') && (!quoteItems.length || autoTotal <= 0)) {
    throw new Error('请填写有效报价项目和金额')
  }

  // 付费且含全新原厂配件更换时，维修件延保固定为三个月。
  const hasWarrantyEligiblePart = quoteDetail.parts.some(item => item.warranty_eligible === true && item.quantity > 0)
  const warrantyMonths = totalPrice > 0 && hasWarrantyEligiblePart
    ? warrantyPolicy.DEFAULT_REPAIR_PART_WARRANTY_MONTHS
    : 0

  return {
    quote_items: quoteItems,
    quote_detail: {
      ...quoteDetail,
      final_price: totalPrice,
      remark: quoteRemark
    },
    parts_fee: partsFee,
    labor_fee: laborFee,
    total_price: totalPrice,
    quote_status: status,
    quote_remark: quoteRemark,
    quote_warranty_months: warrantyMonths,
    quote_update_time: now,
    update_time: now
  }
}

function getMediaUrl(value = '') {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const candidates = [
    value.resolvedUrl,
    value.previewUrl,
    value.tempFileURL,
    value.tempUrl,
    value.url,
    value.fileUrl,
    value.fileID,
    value.fileId,
    value.path
  ]
  const resolved = candidates.find(candidate => typeof candidate === 'string' && candidate.trim())
  return resolved ? resolved.trim() : ''
}

function isCloudFileId(value = '') {
  return getMediaUrl(value).startsWith('cloud://')
}

// 从若干凭证里收集 cloud:// fileID（去重）
function collectProofCloudFileIds(proofs = []) {
  if (!Array.isArray(proofs)) return []
  return proofs
    .map((proof = {}) => getMediaUrl(proof.fileID || proof.fileId || proof.url))
    .filter(isCloudFileId)
}

// 批量把一组 fileID 换成临时地址映射；空列表直接返回空 map，异常吞掉返回空 map。
async function fetchTempUrlMap(fileIds = []) {
  const unique = [...new Set((fileIds || []).filter(isCloudFileId))]
  if (!unique.length) return {}
  try {
    const tempRes = await uniCloud.getTempFileURL({ fileList: unique })
    return (tempRes.fileList || []).reduce((map, item = {}) => {
      if (item.fileID && item.tempFileURL) map[item.fileID] = item.tempFileURL
      return map
    }, {})
  } catch (e) {
    return {}
  }
}

// 用已经算好的 urlMap 给凭证套上临时地址（纯函数，无网络调用）
function applyProofUrlMap(proofs = [], urlMap = {}) {
  if (!Array.isArray(proofs) || !proofs.length) return proofs
  return proofs.map((proof = {}) => {
    const cloudFileID = proof.fileID || proof.fileId || (isCloudFileId(proof.url) ? proof.url : '')
    const tempUrl = urlMap[cloudFileID]
    return tempUrl
      ? {
          ...proof,
          cloudFileID,
          fileID: cloudFileID,
          url: tempUrl,
          fileUrl: tempUrl,
          previewUrl: tempUrl
        }
      : proof
  })
}

// 工单 item 上承载媒体 URL 的字段：购买凭证 / 故障图 / 视频 / 通用附件
const ITEM_MEDIA_FIELDS = ['voucher_urls', 'image_urls', 'video_urls', 'media_urls']

// 从 itemsList 里收集所有 cloud:// 媒体 fileID（去重）。这些图上传时存的是
// cloud:// fileID，浏览器端（后台）无法直接渲染，必须换成临时 https 链接。
function collectItemMediaCloudFileIds(itemsList = []) {
  const ids = []
  ;(Array.isArray(itemsList) ? itemsList : []).forEach(item => {
    ITEM_MEDIA_FIELDS.forEach(field => {
      const arr = item && item[field]
      if (Array.isArray(arr)) arr.forEach(value => {
        const url = getMediaUrl(value)
        if (isCloudFileId(url)) ids.push(url)
      })
    })
  })
  return ids
}

// 用已算好的 urlMap 把 itemsList 里各媒体数组中的 cloud:// 逐个替换为临时链接（纯函数）
function applyItemMediaUrlMap(itemsList = [], urlMap = {}) {
  if (!Array.isArray(itemsList) || !itemsList.length) return itemsList
  return itemsList.map(item => {
    if (!item || typeof item !== 'object') return item
    const next = { ...item }
    ITEM_MEDIA_FIELDS.forEach(field => {
      if (Array.isArray(next[field])) {
        next[field] = next[field].map(value => {
          const url = getMediaUrl(value)
          return (isCloudFileId(url) && urlMap[url]) ? urlMap[url] : url
        }).filter(Boolean)
      }
    })
    return next
  })
}

async function normalizePaymentProofs(proofs = []) {
  if (!Array.isArray(proofs) || !proofs.length) return []
  const cloudFileIds = collectProofCloudFileIds(proofs)
  if (!cloudFileIds.length) return proofs

  try {
    const urlMap = await fetchTempUrlMap(cloudFileIds)
    return applyProofUrlMap(proofs, urlMap)
  } catch (e) {
    return proofs
  }
}

async function enrichPaymentProofs(order = {}) {
  return {
    ...order,
    payment_proofs: await normalizePaymentProofs(order.payment_proofs || order.paymentProofs || [])
  }
}

async function fetchOrderBatches(matchCond = {}, { withItems = false, maxRows = 0, returnMeta = false } = {}) {
  const batchSize = ADMIN_ORDER_LIST_BATCH_SIZE
  const orders = []
  let offset = 0
  let truncated = false

  while (true) {
    const remaining = maxRows ? Math.max(maxRows - orders.length, 0) : batchSize
    if (maxRows && remaining <= 0) {
      truncated = true
      break
    }

    let query = db.collection('cicada_orders')
      .aggregate()
      .match(withActiveOrderFilter(matchCond))
      .sort({ create_time: -1 })
      .skip(offset)
      .limit(Math.min(batchSize, remaining || batchSize))

    if (withItems) {
      query = query.lookup({
        from: 'cicada_order_items',
        localField: '_id',
        foreignField: 'order_id',
        as: 'itemsList'
      })
    }

    const res = await query.end()
    const batch = res.data || []
    orders.push(...batch)
    if (batch.length < Math.min(batchSize, remaining || batchSize)) break
    offset += batch.length
  }

  return returnMeta ? { orders, truncated } : orders
}

function padDatePart(value) {
  return String(value).padStart(2, '0')
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

function parseDateStart(value, fallback) {
  if (!value) return fallback
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? fallback : date.getTime()
}

function parseDateEnd(value, fallback) {
  if (!value) return fallback
  const date = new Date(`${String(value).slice(0, 10)}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? fallback : date.getTime()
}

function normalizeDashboardRange(startDate = '', endDate = '') {
  const now = new Date()
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
  const defaultStartDate = new Date(now)
  defaultStartDate.setDate(now.getDate() - 6)
  defaultStartDate.setHours(0, 0, 0, 0)

  let startTime = parseDateStart(startDate, defaultStartDate.getTime())
  let endTime = parseDateEnd(endDate, defaultEnd)
  if (startTime > endTime) {
    const temp = startTime
    startTime = endTime
    endTime = temp
  }
  return { startTime, endTime }
}

function isInRange(value, startTime, endTime) {
  const time = Number(value || 0)
  return time >= startTime && time <= endTime
}

function getWeekStart(date) {
  const next = new Date(date)
  const day = next.getDay() || 7
  next.setDate(next.getDate() - day + 1)
  next.setHours(0, 0, 0, 0)
  return next
}

function getTrendKey(time, granularity = 'day') {
  const date = new Date(Number(time || 0))
  if (Number.isNaN(date.getTime())) return ''
  if (granularity === 'week') return formatDateKey(getWeekStart(date))
  return formatDateKey(date)
}

function buildTrendBuckets(startTime, endTime, granularity = 'day') {
  const buckets = []
  const cursor = granularity === 'week' ? getWeekStart(new Date(startTime)) : new Date(startTime)
  cursor.setHours(0, 0, 0, 0)

  while (cursor.getTime() <= endTime) {
    const key = formatDateKey(cursor)
    buckets.push({
      key,
      label: granularity === 'week' ? `${key} 周` : key,
      newOrders: 0,
      completedOrders: 0,
      pendingOrders: 0
    })
    cursor.setDate(cursor.getDate() + (granularity === 'week' ? 7 : 1))
  }

  return buckets
}

function getOrderCompletedTime(order = {}) {
  return Number(order.completed_time || order.complete_time || order.update_time || order.create_time || 0)
}

function getDashboardMetrics(orders = [], feedbacks = [], startTime, endTime, granularity = 'day') {
  const pendingStatuses = ['pending', 'sent', 'received']
  const repairingStatuses = ['inspecting', 'fixing']
  const trend = buildTrendBuckets(startTime, endTime, granularity)
  const trendMap = trend.reduce((map, item) => {
    map[item.key] = item
    return map
  }, {})
  const completedDurations = []

  const metrics = {
    newOrders: 0,
    pendingOrders: 0,
    repairingOrders: 0,
    completedOrders: 0,
    avgHandleHours: 0,
    quotePendingOrders: 0,
    invoicePendingOrders: 0,
    paidAmount: 0,
    totalOrders: 0,
    totalFeedbacks: 0,
    pendingFeedbacks: 0,
    // 各状态在库工单数（环形图「工单状态分布」用；不含 cancelled）
    statusBreakdown: {
      pending: 0, sent: 0, received: 0, inspecting: 0, fixing: 0, shipped: 0, completed: 0
    }
  }

  orders.forEach(order => {
    if (order.status !== 'cancelled') metrics.totalOrders += 1
    if (Object.prototype.hasOwnProperty.call(metrics.statusBreakdown, order.status)) {
      metrics.statusBreakdown[order.status] += 1
    }
    const createTime = Number(order.create_time || 0)
    const completedTime = getOrderCompletedTime(order)
    const createKey = getTrendKey(createTime, granularity)
    const completedKey = getTrendKey(completedTime, granularity)

    if (isInRange(createTime, startTime, endTime)) {
      metrics.newOrders += 1
      if (trendMap[createKey]) trendMap[createKey].newOrders += 1
    }

    if (pendingStatuses.includes(order.status)) {
      metrics.pendingOrders += 1
      if (isInRange(createTime, startTime, endTime) && trendMap[createKey]) {
        trendMap[createKey].pendingOrders += 1
      }
    }

    if (repairingStatuses.includes(order.status)) metrics.repairingOrders += 1
    if (matchesTodoType(order, 'quote')) metrics.quotePendingOrders += 1
    if (matchesTodoType(order, 'invoice')) metrics.invoicePendingOrders += 1

    if (order.status === 'completed' && isInRange(completedTime, startTime, endTime)) {
      metrics.completedOrders += 1
      if (trendMap[completedKey]) trendMap[completedKey].completedOrders += 1
      if (createTime && completedTime >= createTime) {
        completedDurations.push((completedTime - createTime) / 3600000)
      }
    }

    // 本期已收金额：付款已确认(paid)且到账时间落在区间内的工单金额求和
    if (order.payment_status === 'paid' && isInRange(Number(order.payment_paid_time || 0), startTime, endTime)) {
      metrics.paidAmount += Number(order.total_price || 0) || 0
    }
  })

  feedbacks.forEach(item => {
    const createTime = Number(item.create_time || item.submit_time || item.update_time || 0)
    if (isInRange(createTime, startTime, endTime)) {
      metrics.totalFeedbacks += 1
      if (['待处理', '未读', '处理中'].includes(item.status)) metrics.pendingFeedbacks += 1
    }
  })

  if (completedDurations.length) {
    metrics.avgHandleHours = Number((completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length).toFixed(1))
  }
  metrics.paidAmount = Number(metrics.paidAmount.toFixed(2))

  return { metrics, trend }
}

module.exports = {
  async _before() {
    if (this.getMethodName && this.getMethodName() === 'getSubscriptionConfig') return

    // 从 HTTP 请求或普通调用中获取 token
    let token
    const httpInfo = this.getHttpInfo && this.getHttpInfo()
    if (httpInfo && httpInfo.body) {
      const body = JSON.parse(httpInfo.body)
      token = body.token
    } else {
      const params = this.getParams()[0] || {}
      token = params.token
    }
    this.currentAdminUser = await verifyAdminToken(token)
  },

  // URL 化接口使用业务码响应：鉴权失败为 401，其他未捕获异常保持 -1。
  _after(error, result) {
    if (error) {
      return toAdminErrorResponse(error)
    }
    return result
  },

  async getWorkflowConfig(params) {
    try {
      const user = requireAdminPermission(this, 'get_workflow_config')
      return { code: 0, data: getWorkflowConfigForRole(user.role) }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 后台代客新建工单：用于客户不会/不便通过小程序提交报修的线下受理场景
  async createAdminOrder(params) {
    let orderId = ''
    try {
      const currentAdmin = requireAdminPermission(this, 'create_order')
      const requestParams = pickParam(this, params)
      const {
        customer = {},
        ship_out_info,
        ship_back_info,
        items,
        status = 'pending',
        admin_remark = '',
        print_remark = ''
      } = requestParams

      const safeShipOut = sanitizeManualShipInfo(ship_out_info)
      const safeShipBack = sanitizeManualShipInfo(ship_back_info)
      const safeItems = (Array.isArray(items) ? items : []).map(item => sanitizeManualOrderItem(item))
      if (!safeItems.length) return { code: -1, msg: '请至少填写一个维修产品' }
      if (safeItems.some(item => !item.product_name)) return { code: -1, msg: '产品名称不能为空' }
      if (safeItems.some(item => !item.product_model)) return { code: -1, msg: '产品型号不能为空' }
      if (safeItems.some(item => !item.sn)) return { code: -1, msg: '产品序列号不能为空' }
      if (safeItems.some(item => !item.fault_desc)) return { code: -1, msg: '故障描述不能为空' }
      if (safeItems.some(item => item.fault_desc.length > 2000)) return { code: -1, msg: '故障描述不能超过2000字' }
      if (!safeShipOut.name || !extractValidPhone(safeShipOut.phone) || !safeShipOut.detail) {
        return { code: -1, msg: '请完善客户寄入联系人、手机号和地址' }
      }
      if (!safeShipBack.name || !extractValidPhone(safeShipBack.phone) || !safeShipBack.detail) {
        return { code: -1, msg: '请完善回寄联系人、手机号和地址' }
      }

      const normalizedStatus = normalizeText(status) || 'pending'
      if (!['pending', 'sent', 'received'].includes(normalizedStatus)) {
        return { code: -1, msg: '新建工单初始状态只能为已提交、运输中或已签收' }
      }
      if (normalizedStatus === 'sent' && !safeShipOut.logistics_no) {
        return { code: -1, msg: '运输中工单必须填写寄入物流单号' }
      }

      const customerInfo = await ensureManualOrderCustomer(customer, safeShipOut, safeShipBack)
      if (!safeShipBack.unit) safeShipBack.unit = (customerInfo.customer && customerInfo.customer.name) || safeShipOut.unit || safeShipBack.name

      const now = Date.now()
      const order_no = genOrderNo()
      const warranty = await computeOrderWarrantyFromItems(safeItems)
      const timeline = [
        {
          title: '后台代客创建报修单',
          desc: `${currentAdmin.name || currentAdmin.username || '工作人员'} 已代客户录入售后报修信息`,
          time: now,
          done: true
        }
      ]
      if (normalizedStatus === 'sent') {
        timeline.push({
          title: '已记录寄入物流',
          desc: `${safeShipOut.logistics_company || '物流'} ${safeShipOut.logistics_no}`,
          time: now,
          done: true
        })
      }
      if (normalizedStatus === 'received') {
        timeline.push({
          title: '设备已到店/已签收',
          desc: '后台创建时已确认设备到达维修点',
          time: now,
          done: true
        })
      }

      const newOrder = {
        order_no,
        user_id: customerInfo.user_id || '',
        customer_id: customerInfo.customer_id || '',
        customer_type: customerInfo.customer_type || 'clinic',
        biz_user: normalizeText(customer && (customer.biz_user || customer.bizUser)).slice(0, 40),
        status: normalizedStatus,
        ship_out_info: safeShipOut,
        ship_back_info: safeShipBack,
        engineer_id: '',
        total_price: 0,
        quote_status: 'pending',
        payment_status: 'pending',
        in_warranty: warranty.in_warranty,
        warranty_status: warranty.warranty_status,
        charge_type: warranty.charge_type,
        arrival_confirm_status: normalizedStatus === 'received' ? 'confirmed' : 'pending',
        admin_remark: normalizeText(admin_remark).slice(0, 1000),
        print_remark: normalizeText(print_remark).slice(0, 500),
        create_source: 'admin_manual',
        created_by_admin_id: currentAdmin._id || '',
        created_by_admin_name: currentAdmin.name || currentAdmin.username || currentAdmin.nickname || '',
        timeline,
        status_enter_time: now,
        status_update_time: now,
        update_time: now,
        create_time: now
      }
      if (normalizedStatus === 'received') {
        newOrder.arrival_confirmed_at = now
        newOrder.arrival_confirmed_by = currentAdmin._id || ''
        newOrder.arrival_confirmed_name = currentAdmin.name || currentAdmin.username || currentAdmin.nickname || ''
      }

      const orderRes = await db.collection('cicada_orders').add(newOrder)
      orderId = orderRes.id
      await Promise.all(safeItems.map(item => db.collection('cicada_order_items').add({ ...item, order_id: orderId })))
      await upsertManualCustomerDevices(customerInfo, safeItems, { order_no, order_id: orderId, status: normalizedStatus })

      const persistedOrder = { ...newOrder, _id: orderId }
      await logOrderEvent({
        order: persistedOrder,
        action: 'create_order',
        actor: currentAdmin,
        before: {},
        after: {
          source: 'admin_manual',
          status: normalizedStatus,
          customer_id: customerInfo.customer_id,
          customer_created: Boolean(customerInfo.created),
          item_count: safeItems.length
        }
      })
      if (safeShipOut.logistics_no) await subscribeOrderLogistics(persistedOrder, 'out')
      if (newOrder.user_id) await sendOrderSubscription(persistedOrder, 'repair_submitted', '工作人员已为您创建报修工单')

      return {
        code: 0,
        msg: '工单创建成功',
        data: {
          order_id: orderId,
          order_no,
          customer_id: customerInfo.customer_id,
          status: normalizedStatus
        }
      }
    } catch (e) {
      if (orderId) {
        await Promise.all([
          db.collection('cicada_orders').doc(orderId).remove(),
          db.collection('cicada_order_items').where({ order_id: orderId }).remove()
        ]).catch(() => {})
      }
      return { code: -1, msg: e.message }
    }
  },

  // 管理员批量逻辑删除误建工单。保留工单、明细和审计记录，避免破坏财务与售后追溯。
  async batchDeleteOrders(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'delete_order')
      const requestParams = pickParam(this, params)
      const reason = normalizeText(requestParams.reason)
      const confirmText = normalizeText(requestParams.confirm_text || requestParams.confirmText)
      const rows = Array.isArray(requestParams.orders) ? requestParams.orders : []

      if (!rows.length) return { code: -1, msg: '请至少选择一个要删除的工单' }
      if (rows.length > 50) return { code: -1, msg: '单次最多删除50个工单' }
      if (reason.length < 2) return { code: -1, msg: '删除原因至少填写2个字' }
      if (reason.length > 500) return { code: -1, msg: '删除原因不能超过500字' }

      const normalizedRows = rows.map(row => ({
        order_id: normalizeText(row && (row.order_id || row.orderId || row._id)),
        order_no: normalizeText(row && (row.order_no || row.orderNo || row.id))
      }))
      if (normalizedRows.some(row => !row.order_id || !row.order_no)) {
        return { code: -1, msg: '所选工单信息不完整，请刷新列表后重试' }
      }
      const uniqueIds = [...new Set(normalizedRows.map(row => row.order_id))]
      if (uniqueIds.length !== normalizedRows.length) return { code: -1, msg: '所选工单中存在重复项' }

      const expectedConfirmText = `确认删除${normalizedRows.length}个工单`
      if (confirmText !== expectedConfirmText) {
        return { code: -1, msg: `请输入“${expectedConfirmText}”确认批量删除` }
      }

      const found = await db.collection('cicada_orders')
        .where({ _id: dbCmd.in(uniqueIds) })
        .limit(50)
        .get()
      const orderMap = new Map((found.data || []).map(order => [order._id, order]))
      const deleted = []
      const failures = []
      const now = Date.now()
      const deletedByName = currentAdmin.name || currentAdmin.username || currentAdmin.nickname || ''

      for (const requested of normalizedRows) {
        const order = orderMap.get(requested.order_id)
        if (!order) {
          failures.push({ order_id: requested.order_id, order_no: requested.order_no, reason: '工单不存在' })
          continue
        }
        if (normalizeText(order.order_no) !== requested.order_no) {
          failures.push({ order_id: requested.order_id, order_no: requested.order_no, reason: '工单号与工单ID不匹配，请刷新后重试' })
          continue
        }

        const blockReason = getBatchDeleteBlockReason(order)
        if (blockReason) {
          failures.push({ order_id: order._id, order_no: order.order_no || requested.order_no, reason: blockReason })
          continue
        }

        const updateRes = await db.collection('cicada_orders')
          .where({ _id: order._id, is_deleted: dbCmd.neq(true) })
          .update({
            is_deleted: true,
            deleted_time: now,
            deleted_by: currentAdmin._id || '',
            deleted_by_name: deletedByName,
            delete_reason: reason,
            update_time: now
          })
        if (!updateRes.updated) {
          failures.push({ order_id: order._id, order_no: order.order_no || requested.order_no, reason: '工单状态已变化，请刷新后重试' })
          continue
        }

        await logOrderEvent({
          order,
          source: 'admin',
          action: 'delete_order',
          actor: currentAdmin,
          before: {
            status: order.status || '',
            payment_status: order.payment_status || '',
            quote_status: order.quote_status || '',
            is_deleted: false
          },
          after: { is_deleted: true, deleted_time: now, delete_reason: reason }
        })
        deleted.push({ order_id: order._id, order_no: order.order_no || requested.order_no })
      }

      return {
        code: 0,
        msg: failures.length ? '批量删除已完成，部分工单未删除' : '批量删除成功',
        data: {
          requested_count: normalizedRows.length,
          deleted_count: deleted.length,
          failed_count: failures.length,
          deleted,
          failures
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 获取后台工单列表（支持筛选/分页）
  async getAdminOrderList(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'view_order')
      const requestParams = pickParam(this, params)
      let {
        status,
        page = 1,
        pageSize = 20,
        keyword = '',
        deviceModel = '',
        invoiceStatus = '',
        warrantyStatus = '',
        customerType = '',
        customer_type = '',
        todoType = '',
        slaLevel = '',
        responseMode = 'array'
      } = requestParams

      if (status && !ORDER_STATUS.includes(status)) return { code: -1, msg: '工单状态不正确' }

      const pagination = normalizePage(page, pageSize)
      const normalizedKeyword = normalizeText(keyword).toLowerCase()
      const compactKeyword = normalizedKeyword.replace(/[\s-]+/g, '')
      const normalizedDeviceModel = normalizeText(deviceModel)
      const normalizedInvoiceStatus = normalizeInvoiceStatusFilter(invoiceStatus)
      const normalizedWarrantyStatus = normalizeText(warrantyStatus)
      const normalizedCustomerType = normalizeCustomerType(customerType || customer_type)
      const normalizedSlaLevel = normalizeText(slaLevel)
      const directMatchCond = buildDirectAdminOrderMatchCond({ status, todoType })
      // 历史工单可能没有客户类型快照，筛选时需先用 CRM 档案补全后再判断。
      const canUseDirectQuery = directMatchCond && !normalizedKeyword && !normalizedDeviceModel && !normalizedInvoiceStatus && !normalizedWarrantyStatus && !normalizedCustomerType && !normalizedSlaLevel

      let list = []
      let total = 0
      let deviceModels = []
      let truncated = false

      if (canUseDirectQuery) {
        const pageResult = await fetchAdminOrderPage(directMatchCond, pagination)
        list = await enrichAdminOrdersForList(pageResult.rawOrders, currentAdmin)
        total = pageResult.total
        deviceModels = collectDeviceModelsFromOrders(list)
      } else {
        const fallbackMatchCond = {}
        if (status) fallbackMatchCond.status = status

        // 在不改变最终结果的前提下，把「可索引且与 JS 谓词完全等价」的等值条件下推到 DB，
        // 缩小扫描集（原来只下推 status，其余全靠 2000 行内存扫描）。
        // 安全前提：下方 JS 过滤会重新校验全部条件，因此只能下推「JS 会接受的行必然满足」的条件，
        //           绝不能下推可能误删有效行的条件（keyword/设备型号/SLA/发票状态默认值等仍留在 JS）。
        // 1) 在保状态：独立等值字段，系统写入值规范，直接下推
        if (normalizedWarrantyStatus) fallbackMatchCond.warranty_status = normalizedWarrantyStatus
        // 2) 直接型待办(inbound/payment)的 DB 条件与 matchesTodoType 完全等价；
        //    仅在未显式指定 status 时下推，避免与 status 参数的交集语义冲突（该冲突场景交给 JS 兜底）
        if (!status) {
          const directTodoCond = getDirectTodoMatchCond(todoType)
          if (directTodoCond && Object.keys(directTodoCond).length) {
            Object.assign(fallbackMatchCond, directTodoCond)
          }
        }

        const fallback = await fetchOrderBatches(fallbackMatchCond, {
          withItems: true,
          maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT,
          returnMeta: true
        })
        truncated = fallback.truncated

        const enrichedOrders = await enrichAdminOrdersForList(fallback.orders, currentAdmin)
        const filteredOrders = enrichedOrders.filter(order => {
          const items = Array.isArray(order.itemsList) ? order.itemsList : []
          const productModels = items.map(item => normalizeText(item.product_model)).filter(Boolean)
          const productSns = items.map(item => normalizeText(item.sn)).filter(Boolean)
          const invoiceInfo = order.invoice_info || {}
          const orderInvoiceStatus = normalizeInvoiceStatusFilter(invoiceInfo.status || (invoiceInfo.need_invoice ? '待开票' : '无需开票'))
          const orderCustomerType = normalizeText(order.customer_type)
          const searchableText = [
            order.order_no,
            order._id,
            order.user_id,
            order.product_name,
            order.product_model,
            order.fault_desc,
            orderCustomerType,
            order.customer_name,
            order.ship_back_info && order.ship_back_info.name,
            order.ship_back_info && order.ship_back_info.phone,
            order.ship_back_info && order.ship_back_info.unit,
            order.ship_out_info && order.ship_out_info.logistics_no,
            order.ship_out_info && order.ship_out_info.logisticsNo,
            order.ship_out_info && order.ship_out_info.tracking_no,
            order.ship_out_info && order.ship_out_info.trackingNo,
            order.ship_back_info && order.ship_back_info.logistics_no,
            order.ship_back_info && order.ship_back_info.logisticsNo,
            order.ship_back_info && order.ship_back_info.tracking_no,
            order.ship_back_info && order.ship_back_info.trackingNo,
            order.ship_back_info && order.ship_back_info.return_no,
            order.ship_back_info && order.ship_back_info.returnNo,
            ...productModels,
            ...productSns
          ].filter(Boolean).join(' ').toLowerCase()
          const compactSearchableText = searchableText.replace(/[\s-]+/g, '')

          return matchesTodoType(order, todoType) &&
            (!normalizedKeyword || searchableText.includes(normalizedKeyword) || (compactKeyword && compactSearchableText.includes(compactKeyword))) &&
            (!normalizedDeviceModel || productModels.includes(normalizedDeviceModel)) &&
            (!normalizedInvoiceStatus || orderInvoiceStatus === normalizedInvoiceStatus) &&
            (!normalizedWarrantyStatus || normalizeText(order.warranty_status) === normalizedWarrantyStatus) &&
            (!normalizedCustomerType || orderCustomerType === normalizedCustomerType) &&
            matchesSlaFilter(order, normalizedSlaLevel)
        })

        total = filteredOrders.length
        const start = (pagination.page - 1) * pagination.pageSize
        list = filteredOrders.slice(start, start + pagination.pageSize)
        deviceModels = collectDeviceModelsFromOrders(filteredOrders)
      }

      const pagePayload = {
        list,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        deviceModels,
        truncated,
        scanLimit: truncated ? ADMIN_ORDER_FILTER_SCAN_LIMIT : undefined
      }

      return {
        code: 0,
        data: responseMode === 'page' ? pagePayload : list
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 获取单条订单详情
  async getAdminOrderDetail(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'view_order')
      let order_id
      if (params && params.order_id) {
        ({ order_id } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ order_id } = body)
        }
      }
      if (!order_id) return { code: -1, msg: '缺少工单ID' }

      // 使用聚合查询联表获取工单项目
      const res = await db.collection('cicada_orders')
        .aggregate()
        .match(withActiveOrderFilter({ _id: order_id }))
        .lookup({
          from: 'cicada_order_items',
          localField: '_id',
          foreignField: 'order_id',
          as: 'itemsList'
        })
        .end()

      if (!res.data || res.data.length === 0) {
        return { code: -1, msg: '工单不存在' }
      }

      const order = res.data[0]

      // 详情页一次性把 item 级媒体 + 订单级支付凭证的 cloud:// 换成临时链接
      const detailUrlMap = await fetchTempUrlMap([
        ...collectItemMediaCloudFileIds(order.itemsList || []),
        ...collectProofCloudFileIds(order.payment_proofs || order.paymentProofs || [])
      ])
      const itemsList = applyItemMediaUrlMap(order.itemsList || [], detailUrlMap)
      const itemDetail = (itemsList.length > 0) ? itemsList[0] : {}

      const orderData = stripPaymentProofsIfForbidden({
        ...order,
        payment_proofs: applyProofUrlMap(order.payment_proofs || order.paymentProofs || [], detailUrlMap),
        product_name: itemDetail.product_name || '',
        product_model: itemDetail.product_model || '',
        fault_desc: itemDetail.fault_desc || '',
        media_urls: itemDetail.media_urls || [],
        sn: itemDetail.sn || '',
        buy_date: itemDetail.buy_date || '',
        fix_solution: itemDetail.fix_solution || '',
        itemsList
      }, currentAdmin)

      return { code: 0, data: orderData }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async listParts(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'manage_inventory')
      const showCost = canViewPartCost(currentAdmin)
      const { keyword = '', stockStatus = '', enabled, page = 1, pageSize = 20 } = pickParam(this, params)
      const pagination = normalizePage(page, pageSize)
      const normalizedKeyword = normalizeText(keyword).toLowerCase()
      const allRes = await db.collection('cicada_parts').orderBy('create_time', 'desc').limit(1000).get()
      let list = (allRes.data || []).filter(part => {
        const searchable = [
          part.part_code,
          part.part_name,
          part.model,
          ...(Array.isArray(part.compatible_models) ? part.compatible_models : [])
        ].filter(Boolean).join(' ').toLowerCase()
        const stock = Number(part.stock || 0) || 0
        const warning = Number(part.warning_threshold || 0) || 0
        return (!normalizedKeyword || searchable.includes(normalizedKeyword)) &&
          (enabled === undefined || enabled === '' || Boolean(part.enabled) === Boolean(enabled)) &&
          (!stockStatus || (stockStatus === 'low' ? warning > 0 && stock <= warning : stockStatus === 'out' ? stock <= 0 : true))
      })
      const total = list.length
      const start = (pagination.page - 1) * pagination.pageSize
      list = list.slice(start, start + pagination.pageSize).map(part => mapPartForClient(part, showCost))
      return { code: 0, data: { list, total, page: pagination.page, pageSize: pagination.pageSize } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 物流上线自检：只暴露配置状态和缺失项，不返回任何第三方凭证。
  async getLogisticsReadiness(params) {
    try {
      requireAdminPermission(this, 'view_order')
      return { code: 0, data: buildLogisticsReadiness(expressProvider.getConfig()) }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async exportParts(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'manage_inventory')
      const showCost = canViewPartCost(currentAdmin)
      const { keyword = '', stockStatus = '', enabled = '' } = pickParam(this, params)
      const normalizedKeyword = normalizeText(keyword).toLowerCase()
      const allRes = await db.collection('cicada_parts').orderBy('create_time', 'desc').limit(1000).get()
      const list = (allRes.data || []).filter(part => {
        const searchable = [
          part.part_code,
          part.part_name,
          part.model,
          ...(Array.isArray(part.compatible_models) ? part.compatible_models : [])
        ].filter(Boolean).join(' ').toLowerCase()
        const stock = Number(part.stock || 0) || 0
        const warning = Number(part.warning_threshold || 0) || 0
        return (!normalizedKeyword || searchable.includes(normalizedKeyword)) &&
          (enabled === undefined || enabled === '' || Boolean(part.enabled) === normalizeBooleanValue(enabled, true)) &&
          (!stockStatus || (stockStatus === 'low' ? warning > 0 && stock <= warning : stockStatus === 'out' ? stock <= 0 : true))
      }).map(part => mapPartForClient(part, showCost))
      return { code: 0, data: { list, total: list.length, truncated: (allRes.data || []).length >= 1000 } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async savePart(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'manage_inventory')
      const showCost = canViewPartCost(currentAdmin)
      const { part = {} } = pickParam(this, params)
      const data = normalizePartInput(part)
      if (!data.part_code) return { code: -1, msg: '缺少配件编码' }
      if (!data.part_name) return { code: -1, msg: '缺少配件名称' }
      const now = Date.now()
      const partId = normalizeText(part._id || part.part_id || part.partId)

      if (partId) {
        const oldRes = await db.collection('cicada_parts').doc(partId).get()
        const oldPart = oldRes.data && oldRes.data[0]
        if (!oldPart) return { code: -1, msg: '配件不存在' }
        // 非 admin/finance 不可修改采购成本：保留原值，防止越权篡改成本
        if (!showCost) data.purchase_cost = Number(oldPart.purchase_cost || 0)
        const updateData = { ...data, update_time: now }
        await db.collection('cicada_parts').doc(partId).update(updateData)
        if (Number(oldPart.stock || 0) !== Number(data.stock || 0)) {
          await db.collection('cicada_inventory_flows').add({
            part_id: partId,
            part_code: data.part_code,
            part_name: data.part_name,
            flow_type: 'adjust',
            quantity: Number(data.stock || 0) - Number(oldPart.stock || 0),
            before_stock: Number(oldPart.stock || 0),
            after_stock: Number(data.stock || 0),
            operator_id: currentAdmin._id || '',
            operator_name: currentAdmin.name || currentAdmin.username || '',
            remark: '后台编辑库存',
            create_time: now
          })
        }
        return { code: 0, data: mapPartForClient({ _id: partId, ...updateData }, showCost) }
      }

      const dup = await db.collection('cicada_parts').where({ part_code: data.part_code }).limit(1).get()
      if (dup.data && dup.data.length) return { code: -1, msg: '配件编码已存在' }
      const createData = {
        ...data,
        create_time: now,
        update_time: now
      }
      const addRes = await db.collection('cicada_parts').add(createData)
      if (data.stock > 0) {
        await db.collection('cicada_inventory_flows').add({
          part_id: addRes.id,
          part_code: data.part_code,
          part_name: data.part_name,
          flow_type: 'inbound',
          quantity: data.stock,
          before_stock: 0,
          after_stock: data.stock,
          operator_id: currentAdmin._id || '',
          operator_name: currentAdmin.name || currentAdmin.username || '',
          remark: '初始入库',
          create_time: now
        })
      }
      return { code: 0, data: mapPartForClient({ _id: addRes.id, ...createData }, showCost) }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async updatePartStatus(params) {
    try {
      requireAdminPermission(this, 'manage_inventory')
      const { part_id, enabled } = pickParam(this, params)
      if (!part_id) return { code: -1, msg: '缺少配件ID' }
      const updateData = { enabled: Boolean(enabled), update_time: Date.now() }
      const res = await db.collection('cicada_parts').doc(part_id).update(updateData)
      if (!res.updated) return { code: -1, msg: '配件不存在' }
      return { code: 0, data: updateData }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async batchUpdatePartStatus(params) {
    try {
      requireAdminPermission(this, 'manage_inventory')
      const { part_ids = [], enabled = false } = pickParam(this, params)
      const ids = [...new Set((Array.isArray(part_ids) ? part_ids : []).map(normalizeText).filter(Boolean))]
      if (!ids.length) return { code: -1, msg: '请选择要操作的配件' }
      if (ids.length > 100) return { code: -1, msg: '单次最多批量处理 100 个配件' }

      const summary = { total: ids.length, updated: 0, failed: [] }
      const updateData = { enabled: normalizeBooleanValue(enabled, false), update_time: Date.now() }
      for (const partId of ids) {
        try {
          const result = await db.collection('cicada_parts').doc(partId).update(updateData)
          if (!result.updated) {
            summary.failed.push({ part_id: partId, reason: '配件不存在或已被删除' })
            continue
          }
          summary.updated += 1
        } catch (error) {
          summary.failed.push({ part_id: partId, reason: error.message || '状态更新失败' })
        }
      }
      return { code: 0, data: summary }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async batchImportParts(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'manage_inventory')
      const showCost = canViewPartCost(currentAdmin)
      const { rows = [], mode = 'upsert' } = pickParam(this, params)
      if (!Array.isArray(rows) || !rows.length) return { code: -1, msg: '导入数据不能为空' }
      if (rows.length > 1000) return { code: -1, msg: '单次最多导入 1000 条' }

      const importMode = ['insert_only', 'upsert', 'stocktake'].includes(mode) ? mode : 'upsert'
      const now = Date.now()
      const summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: [], mode: importMode }
      const seenCodes = new Set()
      const partsRes = await db.collection('cicada_parts').limit(1000).get()
      const partByCode = new Map((partsRes.data || []).map(part => [normalizeText(part.part_code), part]))

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i] || {}
        const rowNo = Number(raw.row || raw.rowNo || 0) || i + 2
        const invalidNumberFields = getInvalidPartNumberFields(raw)
        const data = normalizePartInput(raw)
        if (!data.part_code) { summary.failed.push({ row: rowNo, part_code: '', part_name: data.part_name, reason: '配件编码为空' }); continue }
        if (!data.part_name) { summary.failed.push({ row: rowNo, part_code: data.part_code, part_name: '', reason: '配件名称为空' }); continue }
        if (seenCodes.has(data.part_code)) { summary.failed.push({ row: rowNo, part_code: data.part_code, part_name: data.part_name, reason: '文件内配件编码重复' }); continue }
        if (invalidNumberFields.length) { summary.failed.push({ row: rowNo, part_code: data.part_code, part_name: data.part_name, reason: `${invalidNumberFields.join('、')}格式不正确` }); continue }
        seenCodes.add(data.part_code)

        let oldPart = partByCode.get(data.part_code)
        if (!oldPart) {
          const latestRes = await db.collection('cicada_parts').where({ part_code: data.part_code }).limit(1).get()
          oldPart = latestRes.data && latestRes.data[0]
          if (oldPart) partByCode.set(data.part_code, oldPart)
        }
        if (!oldPart) {
          if (!showCost) data.purchase_cost = 0
          const createData = { ...data, create_time: now, update_time: now }
          let addRes
          try {
            addRes = await db.collection('cicada_parts').add(createData)
          } catch (error) {
            summary.failed.push({ row: rowNo, part_code: data.part_code, part_name: data.part_name, reason: error.message || '新增失败' })
            continue
          }
          partByCode.set(data.part_code, { _id: addRes.id, ...createData })
          if (data.stock > 0) {
            await db.collection('cicada_inventory_flows').add({
              part_id: addRes.id,
              part_code: data.part_code,
              part_name: data.part_name,
              flow_type: 'inbound',
              quantity: data.stock,
              before_stock: 0,
              after_stock: data.stock,
              operator_id: currentAdmin._id || '',
              operator_name: currentAdmin.name || currentAdmin.username || '',
              remark: 'Excel批量导入初始入库',
              create_time: now
            })
          }
          summary.created += 1
          continue
        }

        if (importMode === 'insert_only') {
          summary.skipped += 1
          continue
        }

        const updateData = {
          part_name: data.part_name,
          model: data.model,
          compatible_models: data.compatible_models,
          sale_price: data.sale_price,
          warning_threshold: data.warning_threshold,
          enabled: data.enabled,
          remark: data.remark,
          update_time: now
        }
        if (showCost) updateData.purchase_cost = data.purchase_cost
        if (importMode === 'stocktake') updateData.stock = data.stock

        await db.collection('cicada_parts').doc(oldPart._id).update(updateData)
        if (importMode === 'stocktake' && Number(oldPart.stock || 0) !== Number(data.stock || 0)) {
          await db.collection('cicada_inventory_flows').add({
            part_id: oldPart._id,
            part_code: data.part_code,
            part_name: data.part_name,
            flow_type: 'adjust',
            quantity: Number(data.stock || 0) - Number(oldPart.stock || 0),
            before_stock: Number(oldPart.stock || 0),
            after_stock: Number(data.stock || 0),
            operator_id: currentAdmin._id || '',
            operator_name: currentAdmin.name || currentAdmin.username || '',
            remark: 'Excel批量导入库存盘点调整',
            create_time: now
          })
        }
        partByCode.set(data.part_code, { ...oldPart, ...updateData })
        summary.updated += 1
      }

      return { code: 0, data: summary }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async listInventoryFlows(params) {
    try {
      requireAdminPermission(this, 'manage_inventory')
      const { part_id = '', order_id = '', page = 1, pageSize = 20 } = pickParam(this, params)
      const pagination = normalizePage(page, pageSize)
      const matchCond = {}
      if (part_id) matchCond.part_id = part_id
      if (order_id) matchCond.order_id = order_id
      const [countRes, listRes] = await Promise.all([
        db.collection('cicada_inventory_flows').where(matchCond).count(),
        db.collection('cicada_inventory_flows')
          .where(matchCond)
          .orderBy('create_time', 'desc')
          .skip((pagination.page - 1) * pagination.pageSize)
          .limit(pagination.pageSize)
          .get()
      ])
      return { code: 0, data: { list: listRes.data || [], total: countRes.total || 0, page: pagination.page, pageSize: pagination.pageSize } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async useOrderParts(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'manage_inventory')
      const { order_id } = pickParam(this, params)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      const result = await outboundOrderInventory(order, currentAdmin, Date.now(), { required: true })
      return { code: 0, data: result }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 分配工程师
  async assignEngineer(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'manage_staff')
      let order_id, engineer_id
      if (params && params.order_id) {
        ({ order_id, engineer_id } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ order_id, engineer_id } = body)
        }
      }
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      await verifyEngineer(engineer_id)
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      const res = await db.collection('cicada_orders').doc(order_id).update({
        engineer_id,
        update_time: Date.now()
      })
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      await logOrderEvent({
        order,
        action: 'assign_engineer',
        actor: currentAdmin,
        before: { engineer_id: order.engineer_id || '' },
        after: { engineer_id }
      })
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 更新工单状态
  async updateOrderStatus(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'update_status')
      let order_id, status
      if (params && params.order_id) {
        ({ order_id, status } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ order_id, status } = body)
        }
      }
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      if (!ORDER_STATUS.includes(status)) return { code: -1, msg: '工单状态不正确' }
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      assertOrderStatusTransition(order.status, status)
      const prerequisiteError = getStatusTransitionPrerequisiteError(order, status)
      if (prerequisiteError) return { code: -1, msg: prerequisiteError }
      const now = Date.now()
      const res = await db.collection('cicada_orders').doc(order_id).update({
        status,
        ...buildStatusTimestampUpdate(order, status, now),
        ...buildArchiveStatusUpdate(order, status),
        update_time: now
      })
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      await logOrderEvent({
        order,
        action: 'update_status',
        actor: currentAdmin,
        before: { status: order.status || '' },
        after: { status }
      })
      const sceneMap = {
        received: 'order_received',
        shipped: 'order_shipped',
        completed: 'order_completed'
      }
      if (sceneMap[status] && order.status !== status) {
        await sendOrderSubscription({ ...order, status }, sceneMap[status])
      }
      if (status === 'completed') {
        await applyRepairWarrantyExtension({ ...order, status }, now)
      }
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 快递签收只代表包裹到达；工作人员核对设备后在此确认正式入库。
  async confirmInboundArrival(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'update_status')
      const { order_id } = pickParam(this, params)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      if (order.arrival_confirm_status === 'confirmed' || order.status === 'received') {
        return { code: 0, msg: '该工单已确认入库' }
      }
      if (!['pending', 'sent'].includes(order.status)) return { code: -1, msg: '当前工单状态不能确认入库' }
      const outTrack = (order.track_cache && order.track_cache.out) || {}
      if (order.arrival_confirm_status !== 'pending' && normalizeText(outTrack.state) !== '3') {
        return { code: -1, msg: '快递尚未显示签收，不能确认入库' }
      }
      assertOrderStatusTransition(order.status, 'received')
      const now = Date.now()
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const updateData = {
        status: 'received',
        ...buildStatusTimestampUpdate(order, 'received', now),
        arrival_confirm_status: 'confirmed',
        arrival_confirmed_at: now,
        arrival_confirmed_by: normalizeText(currentAdmin._id || currentAdmin.id),
        arrival_confirmed_name: normalizeText(currentAdmin.name || currentAdmin.username || currentAdmin.nickname) || '后台人员',
        ship_out_info: { ...(order.ship_out_info || {}), received_at: now },
        timeline: [
          ...timeline,
          { title: '设备已确认入库', desc: '维修中心已完成包裹与设备核对，等待检测', time: now, done: true }
        ],
        update_time: now
      }
      const result = await db.collection('cicada_orders').doc(order_id).update(updateData)
      if (!result.updated) return { code: -1, msg: '确认入库失败' }
      await logOrderEvent({
        order,
        action: 'confirm_inbound_arrival',
        actor: currentAdmin,
        before: { status: order.status || '', arrival_confirm_status: order.arrival_confirm_status || '' },
        after: { status: 'received', arrival_confirm_status: 'confirmed', arrival_confirmed_at: now }
      })
      await sendOrderSubscription({ ...order, ...updateData }, 'order_received', '设备已确认入库')
      return { code: 0, msg: '已确认入库', data: { status: 'received', arrival_confirm_status: 'confirmed' } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 批量导入物流单：inbound=客户寄入签收，return=后台回寄发货
  async batchImportLogistics(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'import_logistics')
      const { type = 'return', rows, importDate = '' } = pickParam(this, params)
      const importType = type === 'inbound' ? 'inbound' : 'return'
      const normalizedList = normalizeLogisticsImportRows(rows, importType)
      if (!normalizedList.length) {
        return { code: -1, msg: '导入数据不能为空' }
      }
      if (normalizedList.length > LOGISTICS_IMPORT_MAX_ROWS) {
        return { code: -1, msg: `单次最多导入 ${LOGISTICS_IMPORT_MAX_ROWS} 条，请拆分 Excel 后重试` }
      }

      const summary = {
        type: importType,
        typeLabel: importType === 'inbound' ? '客户寄入签收' : '后台回寄发货',
        targetStatus: importType === 'inbound' ? '已签收' : '已回寄',
        total: normalizedList.length,
        success: 0,
        fail: 0,
        errors: [],
        warnings: []
      }
      const seen = new Set()
      const now = Date.now()

      for (const item of normalizedList) {
        if (!item.orderNo) {
          summary.fail += 1
          summary.errors.push({ orderNo: '-', reason: '缺少工单编号' })
          continue
        }
        if (!item.logisticsCompany) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '缺少物流公司' })
          continue
        }
        if (!item.logisticsNo) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '缺少物流单号' })
          continue
        }
        if (seen.has(item.orderNo)) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: 'Excel中工单编号重复' })
          continue
        }
        seen.add(item.orderNo)

        const order = await findOrderByNo(item.orderNo)
        if (!order) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '工单不存在' })
          continue
        }
        if (order.status === 'cancelled') {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '已取消工单不能导入修改' })
          continue
        }
        if (importType === 'inbound' && ['shipped', 'completed'].includes(order.status)) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '工单已回寄或已完成，不能回退为已签收' })
          continue
        }
        if (importType === 'return') {
          const shipmentBlockReason = getReturnShipmentBlockReason(order)
          if (shipmentBlockReason) {
            summary.fail += 1
            summary.errors.push({ orderNo: item.orderNo, reason: shipmentBlockReason })
            continue
          }
        }

        const segment = importType === 'inbound' ? 'out' : 'back'
        const trackCheck = await validateTrackingNoBeforeSave(
          order,
          item.logisticsNo,
          item.logisticsCompany,
          segment
        )
        if (!trackCheck.ok) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: trackCheck.reason })
          continue
        }
        item.logisticsNo = trackCheck.value
        if (trackCheck.warning) {
          summary.warnings.push({ orderNo: item.orderNo, warning: trackCheck.warning })
        }

        let updateData = buildLogisticsImportUpdate(order, item, importType, now, importDate)
        if (importType === 'inbound') {
          updateData.arrival_confirm_status = 'confirmed'
          updateData.arrival_detected_at = order.arrival_detected_at || now
          updateData.arrival_confirmed_at = now
          updateData.arrival_confirmed_by = normalizeText(currentAdmin._id || currentAdmin.id)
          updateData.arrival_confirmed_name = normalizeText(currentAdmin.name || currentAdmin.username || currentAdmin.nickname) || '后台人员'
        }
        updateData = attachVerifiedTrackCache(updateData, order, segment, trackCheck)
        const targetStatus = importType === 'inbound' ? 'received' : 'shipped'
        try {
          assertOrderStatusTransition(order.status, targetStatus)
        } catch (e) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: e.message })
          continue
        }
        const res = await db.collection('cicada_orders').doc(order._id).update(updateData)
        if (!res.updated) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '更新失败' })
          continue
        }

        await logOrderEvent({
          order,
          action: importType === 'return' ? 'ship_return' : 'update_status',
          actor: currentAdmin,
          before: {
            status: order.status || '',
            ship_out_info: order.ship_out_info || {},
            ship_back_info: order.ship_back_info || {}
          },
          after: {
            status: updateData.status || order.status || '',
            ship_out_info: updateData.ship_out_info || order.ship_out_info || {},
            ship_back_info: updateData.ship_back_info || order.ship_back_info || {},
            type: importType
          }
        })
        const notifyScene = importType === 'inbound' ? 'order_received' : 'order_shipped'
        await sendOrderSubscription({ ...order, ...updateData }, notifyScene, updateData.status === 'received' ? '设备已签收' : '设备已回寄')
        await subscribeOrderLogistics({ ...order, ...updateData }, importType === 'inbound' ? 'out' : 'back')
        summary.success += 1
      }

      return { code: 0, data: summary }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 批量导入回寄运单号，按工单号匹配并更新回寄物流信息
  async batchImportReturnLogistics(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'import_logistics')
      const { rows } = pickParam(this, params)
      const normalizedRows = normalizeImportRows(rows)
      if (!normalizedRows.length) {
        return { code: -1, msg: '导入数据不能为空' }
      }
      if (normalizedRows.length > LOGISTICS_IMPORT_MAX_ROWS) {
        return { code: -1, msg: `单次最多导入 ${LOGISTICS_IMPORT_MAX_ROWS} 条，请拆分 Excel 后重试` }
      }

      const results = []
      const seen = new Set()
      const validRows = []

      for (const item of normalizedRows) {
        if (!item.order_no) {
          results.push({ ...item, success: false, reason: '缺少工单编号' })
          continue
        }
        if (!item.logistics_no) {
          results.push({ ...item, success: false, reason: '缺少回寄运单号' })
          continue
        }
        if (!item.logistics_company) {
          results.push({ ...item, success: false, reason: '缺少物流公司' })
          continue
        }
        if (seen.has(item.order_no)) {
          results.push({ ...item, success: false, reason: 'Excel中工单编号重复' })
          continue
        }
        seen.add(item.order_no)
        validRows.push(item)
      }

      const now = Date.now()
      for (const item of validRows) {
        const found = await db.collection('cicada_orders')
          .where(withActiveOrderFilter({ order_no: item.order_no }))
          .limit(1)
          .get()
        const order = found.data[0]

        if (!order) {
          results.push({ ...item, success: false, reason: '工单不存在' })
          continue
        }
        if (order.status === 'cancelled') {
          results.push({ ...item, success: false, reason: '已取消工单不能导入修改' })
          continue
        }
        // 已完成工单锁定：禁止改回寄单号，防篡改历史物流记录
        if (order.status === 'completed') {
          results.push({ ...item, success: false, reason: '已完成工单的回寄单号已锁定，不可修改' })
          continue
        }
        // 集中校验回寄业务策略；付款状态不作为后台发货前置条件。
        const shipmentBlockReason = getReturnShipmentPolicyBlockReason(order)
        if (shipmentBlockReason) {
          results.push({ ...item, success: false, reason: shipmentBlockReason })
          continue
        }
        // 录入源头防错：单号格式 + 快递公司一致性校验，不符直接拦截该行
        const trackCheck = await validateTrackingNoBeforeSave(order, item.logistics_no, item.logistics_company, 'back')
        if (!trackCheck.ok) {
          results.push({ ...item, success: false, reason: trackCheck.reason })
          continue
        }
        item.logistics_no = trackCheck.value

        const shipBackInfo = buildShipBackInfo(order, item, now)
        const timeline = Array.isArray(order.timeline) ? order.timeline : []
        const timelineText = `${item.logistics_company || '物流'} ${item.logistics_no}`
        let updateData = {
          ship_back_info: shipBackInfo,
          status: 'shipped',
          ...buildStatusTimestampUpdate(order, 'shipped', now),
          ...buildArchiveStatusUpdate(order, 'shipped'),
          timeline: [
            ...timeline,
            {
              title: '回寄发货',
              desc: timelineText,
              time: now,
              done: true
            }
          ],
          update_time: now
        }
        updateData = attachVerifiedTrackCache(updateData, order, 'back', trackCheck)
        try {
          assertOrderStatusTransition(order.status, updateData.status)
        } catch (e) {
          results.push({ ...item, success: false, reason: e.message })
          continue
        }

        const res = await db.collection('cicada_orders').doc(order._id).update(updateData)
        if (!res.updated) {
          results.push({ ...item, success: false, reason: '更新失败' })
          continue
        }

        await logOrderEvent({
          order,
          action: 'ship_return',
          actor: currentAdmin,
          before: {
            status: order.status || '',
            ship_back_info: order.ship_back_info || {}
          },
          after: {
            status: updateData.status,
            ship_back_info: updateData.ship_back_info
          }
        })
        await sendOrderSubscription({ ...order, ...updateData }, 'order_shipped', '设备已回寄')
        await subscribeOrderLogistics({ ...order, ...updateData }, 'back')
        results.push({
          ...item,
          order_id: order._id,
          success: true,
          reason: '已更新',
          warning: trackCheck.warning || ''
        })
      }

      const successCount = results.filter(item => item.success).length
      const failCount = results.length - successCount
      return {
        code: 0,
        data: {
          total: results.length,
          successCount,
          failCount,
          results
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 批量回寄发货，按工单编号更新回寄物流并将状态置为已发货
  async batchUpdateShipping(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'import_logistics')
      const { shippingList } = pickParam(this, params)
      const normalizedList = normalizeShippingList(shippingList)
      if (!normalizedList.length) {
        return { code: -1, msg: '导入数据不能为空' }
      }
      if (normalizedList.length > LOGISTICS_IMPORT_MAX_ROWS) {
        return { code: -1, msg: `单次最多导入 ${LOGISTICS_IMPORT_MAX_ROWS} 条，请拆分 Excel 后重试` }
      }

      const summary = {
        total: normalizedList.length,
        success: 0,
        fail: 0,
        errors: [],
        warnings: []
      }
      const seen = new Set()
      const now = Date.now()

      for (const item of normalizedList) {
        if (!item.orderNo) {
          summary.fail += 1
          summary.errors.push({ orderNo: '-', reason: '缺少工单编号' })
          continue
        }
        if (!item.returnCompany) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '缺少物流公司' })
          continue
        }
        if (!item.returnNo) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '缺少物流单号' })
          continue
        }
        if (seen.has(item.orderNo)) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: 'Excel中工单编号重复' })
          continue
        }
        seen.add(item.orderNo)

        const order = await findOrderByNo(item.orderNo)
        if (!order) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '工单不存在' })
          continue
        }
        if (order.status === 'cancelled') {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '已取消工单不能导入修改' })
          continue
        }
        // 已完成工单锁定：禁止改回寄单号，防篡改历史物流记录
        if (order.status === 'completed') {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '已完成工单的回寄单号已锁定，不可修改' })
          continue
        }
        // 集中校验回寄业务策略；付款状态不作为后台发货前置条件。
        const shipmentBlockReason = getReturnShipmentPolicyBlockReason(order)
        if (shipmentBlockReason) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: shipmentBlockReason })
          continue
        }
        // 录入源头防错：单号格式 + 快递公司一致性校验
        const trackCheck = await validateTrackingNoBeforeSave(order, item.returnNo, item.returnCompany, 'back')
        if (!trackCheck.ok) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: trackCheck.reason })
          continue
        }
        item.returnNo = trackCheck.value
        if (trackCheck.warning) {
          summary.warnings.push({ orderNo: item.orderNo, warning: trackCheck.warning })
        }

        const timeline = Array.isArray(order.timeline) ? order.timeline : []
        let updateData = {
          status: 'shipped',
          ...buildStatusTimestampUpdate(order, 'shipped', now),
          ...buildArchiveStatusUpdate(order, 'shipped'),
          ship_back_info: buildReturnShippingInfo(order, item, now),
          timeline: [
            ...timeline,
            {
              title: '回寄发货',
              desc: `${item.returnCompany || '物流'} ${item.returnNo}`,
              time: now,
              done: true
            }
          ],
          update_time: now
        }
        updateData = attachVerifiedTrackCache(updateData, order, 'back', trackCheck)
        try {
          assertOrderStatusTransition(order.status, updateData.status)
        } catch (e) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: e.message })
          continue
        }

        const res = await db.collection('cicada_orders').doc(order._id).update(updateData)
        if (!res.updated) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '更新失败' })
          continue
        }

        await logOrderEvent({
          order,
          action: 'ship_return',
          actor: currentAdmin,
          before: {
            status: order.status || '',
            ship_back_info: order.ship_back_info || {}
          },
          after: {
            status: updateData.status,
            ship_back_info: updateData.ship_back_info
          }
        })
        await sendOrderSubscription({ ...order, ...updateData }, 'order_shipped', '设备已回寄')
        await subscribeOrderLogistics({ ...order, ...updateData }, 'back')
        summary.success += 1
      }

      return { code: 0, data: summary }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 更新工单备注：admin_remark 仅后台可见，print_remark 用于随件打印
  async updateRemarks(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'update_remarks')
      const { orderId, order_id, adminRemark, printRemark } = pickParam(this, params)
      const targetOrderId = order_id || orderId
      if (!targetOrderId) return { code: -1, msg: '缺少工单ID' }

      const now = Date.now()
      const found = await db.collection('cicada_orders').doc(targetOrderId).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      const remarkData = {
        admin_remark: normalizeText(adminRemark),
        print_remark: normalizeText(printRemark),
        update_time: now
      }

      const res = await db.collection('cicada_orders').doc(targetOrderId).update(remarkData)
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      await logOrderEvent({
        order,
        action: 'update_remarks',
        actor: currentAdmin,
        before: {
          admin_remark: order.admin_remark || '',
          print_remark: order.print_remark || ''
        },
        after: {
          admin_remark: remarkData.admin_remark,
          print_remark: remarkData.print_remark
        }
      })

      return { code: 0, data: remarkData }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 保存工单产品/设备信息（后台按 SN 回填后落库），并按新 SN 重算工单在保快照
  async saveOrderItems(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'update_remarks')
      const { order_id, orderId, items } = pickParam(this, params)
      const targetOrderId = order_id || orderId
      if (!targetOrderId) return { code: -1, msg: '缺少工单ID' }
      if (!Array.isArray(items) || !items.length) return { code: -1, msg: '缺少产品信息' }

      const found = await db.collection('cicada_orders').doc(targetOrderId).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }

      const now = Date.now()
      // 先取本工单的全部产品项，构建归属白名单，杜绝按 _id 改到其它工单的项
      const itemKeys = [order._id, order.order_no].filter(Boolean)
      const existingRes = itemKeys.length
        ? await db.collection('cicada_order_items').where({ order_id: dbCmd.in(itemKeys) }).get()
        : { data: [] }
      const ownedItems = existingRes.data || []
      const ownedById = new Map(ownedItems.map(it => [String(it._id), it]))
      const changesWarrantyEvidence = items.some(item => {
        const owned = item && ownedById.get(normalizeText(item._id))
        if (!owned) return false
        const nextMonths = Math.max(0, Number(item.warranty_months || 0) || 0)
        const nextExpire = normalizeText(item.warranty_expire)
        const nextStart = normalizeText(item.warranty_start_date)
        const nextInvoiceDate = normalizeText(item.invoice_received_date)
        const nextManufactureDate = normalizeText(item.manufacture_date)
        const nextCoverage = normalizeText(item.coverage_result)
        const nextReason = normalizeText(item.coverage_reason)
        return nextMonths !== Math.max(0, Number(owned.warranty_months || 0) || 0)
          || nextExpire !== normalizeText(owned.warranty_expire)
          || nextStart !== normalizeText(owned.warranty_start_date)
          || nextInvoiceDate !== normalizeText(owned.invoice_received_date)
          || nextManufactureDate !== normalizeText(owned.manufacture_date)
          || nextCoverage !== normalizeText(owned.coverage_result)
          || nextReason !== normalizeText(owned.coverage_reason)
      })
      if (changesWarrantyEvidence) assertRolePermission(currentAdmin, 'issue_quote')

      // 逐条更新工单项（仅限本工单下的项，按 _id 精确更新）
      for (const item of items) {
        const itemId = normalizeText(item && item._id)
        const owned = itemId && ownedById.get(itemId)
        if (!owned) continue // 跳过不属于本工单的项
        const sn = normalizeText(item.sn)
        const rawCoverageResult = normalizeText(item.coverage_result)
        const coverageResult = ['pending', 'free', 'paid', 'partial', 'not_covered'].includes(rawCoverageResult)
          ? rawCoverageResult
          : ''
        const patch = {
          product_category: normalizeText(item.product_category),
          product_model: normalizeText(item.product_model),
          sn,
          sn_normalized: normalizeSn(sn),
          buy_date: normalizeText(item.buy_date),
          warranty_start_date: normalizeText(item.warranty_start_date),
          invoice_received_date: normalizeText(item.invoice_received_date),
          manufacture_date: normalizeText(item.manufacture_date),
          warranty_months: warrantyPolicy.DEFAULT_PRODUCT_WARRANTY_MONTHS,
          warranty_expire: normalizeText(item.warranty_expire),
          coverage_result: coverageResult,
          coverage_reason: normalizeText(item.coverage_reason),
          coverage_note: normalizeText(item.coverage_note).slice(0, 500)
        }
        if (coverageResult === 'free' && !warrantyPolicy.isFreeCoverageReason(patch.coverage_reason)) {
          return { code: -1, msg: '免费维修必须确认原厂质量缺陷，或确认同故障同更换件的维修延保' }
        }
        const itemUpdate = await db.collection('cicada_order_items').doc(itemId).update(patch)
        if (!itemUpdate.updated) return { code: -1, msg: '设备信息保存失败，请刷新工单后重试' }
        Object.assign(owned, patch) // 同步内存副本，供下方在保重算

        // 工单内明确补录的质保信息同步回 SN 设备档案，供后续报修复用。
        const hasExplicitWarranty = Boolean(
          patch.warranty_expire
          || patch.warranty_start_date
          || patch.invoice_received_date
          || patch.manufacture_date
          || patch.buy_date
          || patch.warranty_months > 0
        )
        if (sn && hasExplicitWarranty) {
          const devicePatch = {
            warranty_months: patch.warranty_months,
            warranty_expire: patch.warranty_expire,
            warranty_start_date: patch.warranty_start_date,
            invoice_received_date: patch.invoice_received_date,
            manufacture_date: patch.manufacture_date,
            update_time: now
          }
          if (patch.buy_date) devicePatch.buy_date = patch.buy_date
          try {
            const snKey = normalizeSn(sn)
            let deviceRes = await db.collection('cicada_user_devices').where({ sn_normalized: snKey }).limit(1).get()
            if (!deviceRes.data || !deviceRes.data.length) {
              deviceRes = await db.collection('cicada_user_devices').where({ sn }).limit(1).get()
            }
            const device = deviceRes.data && deviceRes.data[0]
            if (device) await db.collection('cicada_user_devices').doc(device._id).update(devicePatch)
          } catch (e) {
            console.warn('同步设备质保信息失败:', e && e.message)
          }
        }
      }

      // 用更新后的本工单产品项重算在保结论
      const warranty = await computeOrderWarrantyFromItems(ownedItems)
      await Promise.all(ownedItems
        .filter(item => item && item._id && item.warranty_status)
        .map(item => db.collection('cicada_order_items').doc(item._id).update({
          warranty_status: item.warranty_status
        }).catch(() => {})))

      await db.collection('cicada_orders').doc(targetOrderId).update({
        in_warranty: warranty.in_warranty,
        warranty_status: warranty.warranty_status,
        charge_type: warranty.charge_type,
        update_time: now
      })

      await logOrderEvent({
        order,
        action: 'update_order_items',
        actor: currentAdmin,
        before: { warranty_status: order.warranty_status || '', in_warranty: Boolean(order.in_warranty) },
        after: { warranty_status: warranty.warranty_status, in_warranty: warranty.in_warranty, item_count: items.length }
      })

      return { code: 0, data: warranty }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 内部开票状态登记；真实税控/财务系统开票需要后续对接第三方接口
  async updateInvoiceStatus(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'update_invoice')
      const { order_id, status, invoice = {} } = pickParam(this, params)
      const nextStatus = normalizeInvoiceStatusValue(status)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      if (!INVOICE_STATUS.includes(nextStatus)) return { code: -1, msg: '发票状态不正确' }

      const now = Date.now()
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      if (nextStatus !== '无需开票') {
        const invoiceBlockReason = getInvoiceRequestBlockReason(order)
        if (invoiceBlockReason) return { code: -1, msg: invoiceBlockReason }
      }
      const oldInvoice = order.invoice_info || {}
      const nextInvoiceType = normalizeText(invoice.invoice_type || invoice.invoiceType) || oldInvoice.invoice_type || '电子普通发票'
      const requestedFulfillmentMode = normalizeText(invoice.fulfillment_mode || invoice.fulfillmentMode)
      if (requestedFulfillmentMode && requestedFulfillmentMode !== 'manual') return { code: -1, msg: '当前仅支持财务人工开票并登记' }
      const nextFulfillmentMode = 'manual'
      const nextDeliveryMethod = nextInvoiceType === '纸质专用发票' ? 'postal' : 'electronic'
      const nextMailCompany = normalizeText(invoice.mail_company || invoice.mailCompany)
      const nextMailNo = normalizeText(invoice.mail_no || invoice.mailNo)
      const nextMailTime = normalizeText(invoice.mail_time || invoice.mailTime)
      const nextReceivedTime = normalizeText(invoice.received_time || invoice.receivedTime)
      const resolvedMailCompany = nextMailCompany || oldInvoice.mail_company || ''
      const resolvedMailNo = nextMailNo || oldInvoice.mail_no || ''
      const resolvedMailTime = nextMailTime || oldInvoice.mail_time || ''
      if (nextInvoiceType !== '纸质专用发票' && (nextMailCompany || nextMailNo || nextMailTime || nextReceivedTime)) {
        return { code: -1, msg: '电子普通发票无需登记邮寄物流' }
      }
      if (nextInvoiceType !== '纸质专用发票' && ['已寄出', '已签收'].includes(nextStatus)) {
        return { code: -1, msg: '电子普通发票无需使用邮寄状态' }
      }
      const nextInvoiceUrl = normalizeText(invoice.invoice_url || invoice.file_url || invoice.fileUrl || invoice.url) || oldInvoice.invoice_url || oldInvoice.file_url || ''
      const nextPdfUrl = normalizeText(invoice.pdf_url || invoice.pdfUrl || invoice.invoice_file_id || invoice.invoiceFileId) || oldInvoice.pdf_url || nextInvoiceUrl
      const nextInvoiceNo = normalizeText(invoice.invoice_no || invoice.invoiceNo) || oldInvoice.invoice_no || ''
      const nextInvoiceDate = normalizeText(invoice.invoice_date || invoice.invoiceDate) || oldInvoice.invoice_date || ''
      if (['已开具', '已寄出', '已签收'].includes(nextStatus) && (!nextInvoiceNo || !nextInvoiceDate)) {
        return { code: -1, msg: '标记已开票前必须填写发票号码和开票日期' }
      }
      const invoiceNumberConflict = await findInvoiceNumberConflict(nextInvoiceNo, order_id)
      if (invoiceNumberConflict) {
        return { code: -1, msg: `发票号码已绑定工单 ${invoiceNumberConflict.order_no || invoiceNumberConflict._id}` }
      }
      if (nextInvoiceType === '纸质专用发票' && ['已寄出', '已签收'].includes(nextStatus) && (!resolvedMailCompany || !resolvedMailNo)) {
        return { code: -1, msg: '标记已寄出前必须填写快递公司和快递单号' }
      }
      const archiveStatus = nextStatus === '已签收' || (nextDeliveryMethod === 'electronic' && nextStatus === '已开具')
        ? 'archived'
        : (nextStatus === '已寄出' ? 'in_transit' : (nextStatus === '已开具' ? 'pending_delivery' : 'pending'))
      const invoiceInfo = {
        ...oldInvoice,
        need_invoice: nextStatus !== '无需开票',
        status: nextStatus,
        invoice_type: nextInvoiceType,
        tax_category: INVOICE_TAX_CATEGORY,
        item_name: INVOICE_ITEM_NAME,
        delivery_method: nextDeliveryMethod,
        fulfillment_mode: nextFulfillmentMode,
        issued_channel: nextFulfillmentMode,
        archive_status: archiveStatus,
        archive_order_id: order._id,
        archive_order_no: order.order_no || '',
        service_completed_time: oldInvoice.service_completed_time || order.completed_time || order.complete_time || order.update_time || now,
        settlement_time: oldInvoice.settlement_time || order.payment_paid_time || order.update_time || now,
        expected_delivery_days: nextDeliveryMethod === 'postal' ? '7-15' : '1-3',
        title_type: normalizeText(invoice.title_type || invoice.titleType) || oldInvoice.title_type || 'company',
        title: normalizeText(invoice.title) || oldInvoice.title || '',
        tax_no: normalizeText(invoice.tax_no || invoice.taxNo) || oldInvoice.tax_no || '',
        email: normalizeText(invoice.email || invoice.invoiceEmail) || oldInvoice.email || '',
        register_address: normalizeText(invoice.register_address || invoice.registerAddress) || oldInvoice.register_address || '',
        register_phone: normalizeText(invoice.register_phone || invoice.registerPhone) || oldInvoice.register_phone || '',
        bank_name: normalizeText(invoice.bank_name || invoice.bankName) || oldInvoice.bank_name || '',
        bank_account: normalizeText(invoice.bank_account || invoice.bankAccount) || oldInvoice.bank_account || '',
        recipient_name: normalizeText(invoice.recipient_name || invoice.recipientName) || oldInvoice.recipient_name || '',
        recipient_phone: normalizeText(invoice.recipient_phone || invoice.recipientPhone) || oldInvoice.recipient_phone || '',
        recipient_address: normalizeText(invoice.recipient_address || invoice.recipientAddress) || oldInvoice.recipient_address || '',
        remark: normalizeText(invoice.remark) || oldInvoice.remark || '',
        invoice_url: nextInvoiceUrl,
        pdf_url: nextPdfUrl,
        invoice_file_id: nextPdfUrl && !/^https?:\/\//i.test(nextPdfUrl) ? nextPdfUrl : (oldInvoice.invoice_file_id || ''),
        invoice_no: nextInvoiceNo,
        invoice_date: nextInvoiceDate,
        // 专票（纸质）邮寄信息：增值税专用发票需邮寄纸质件，登记物流便于客户跟踪与对账
        mail_company: nextDeliveryMethod === 'postal' ? resolvedMailCompany : '',
        mail_no: nextDeliveryMethod === 'postal' ? resolvedMailNo : '',
        mail_time: nextDeliveryMethod === 'postal' ? resolvedMailTime : '',
        received_time: nextStatus === '已签收' ? (nextReceivedTime || oldInvoice.received_time || now) : (nextReceivedTime || oldInvoice.received_time || ''),
        update_time: now
      }
      if (nextStatus === '已开具') invoiceInfo.issued_time = oldInvoice.issued_time || now

      const updateData = { invoice_info: invoiceInfo, update_time: now }
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const nextTimeline = [...timeline]
      // 首次置为「已开具」时补一条时间线，客户端进度可见
      if (nextStatus === '已开具' && oldInvoice.status !== '已开具') {
        const title = nextInvoiceType === '纸质专用发票' ? '纸质发票已开具' : '电子发票已开具'
        const desc = nextInvoiceType === '纸质专用发票'
          ? '纸质专票已开具，待财务登记寄送物流。'
          : `发票号码：${invoiceInfo.invoice_no}；项目：${INVOICE_TAX_CATEGORY} / ${INVOICE_ITEM_NAME}`
        nextTimeline.push({
          title,
          desc,
          time: now,
          done: true
        })
      }
      if (nextInvoiceType === '纸质专用发票' && nextStatus === '已寄出' && oldInvoice.status !== '已寄出') {
        nextTimeline.push({
          title: '纸质发票寄出',
          desc: `${invoiceInfo.mail_company || '物流'} ${invoiceInfo.mail_no || '单号待录入'}`.trim(),
          time: invoiceInfo.mail_time || now,
          done: true
        })
      }
      if (nextInvoiceType === '纸质专用发票' && nextStatus === '已签收' && oldInvoice.status !== '已签收') {
        nextTimeline.push({
          title: '纸质发票已签收',
          desc: '发票物流已签收，请交由财务归档。',
          time: invoiceInfo.received_time || now,
          done: true
        })
      }
      if (nextTimeline.length !== timeline.length) {
        updateData.timeline = nextTimeline
      }

      const res = await db.collection('cicada_orders').doc(order_id).update(updateData)
      if (!res.updated) return { code: -1, msg: '工单更新失败' }
      await logOrderEvent({
        order,
        action: 'update_invoice',
        actor: currentAdmin,
        before: { invoice_info: oldInvoice },
        after: { invoice_info: invoiceInfo }
      })
      return { code: 0, data: invoiceInfo }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 后台手动填写/发布维修报价
  async updateOrderQuote(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'issue_quote')
      const { order_id, quote = {} } = pickParam(this, params)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }

      const now = Date.now()
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }

      const warrantyFreeConfirmed = await isOrderWarrantyFreeConfirmed(order)
      const quoteData = buildQuoteData(quote, now, { ...order, warranty_free_confirmed: warrantyFreeConfirmed })
      const warrantyParts = quoteData.quote_detail.parts.filter(item => item.warranty_eligible === true && item.quantity > 0)
      if (quoteData.quote_status === 'issued' && warrantyParts.length) {
        const itemKeys = [order._id, order.order_no].filter(Boolean)
        const itemRes = await db.collection('cicada_order_items').where({ order_id: dbCmd.in(itemKeys) }).get()
        const deviceSns = [...new Set((itemRes.data || []).map(item => normalizeText(item.sn)).filter(Boolean))]
        const normalizedDeviceSns = new Map(deviceSns.map(sn => [normalizeSn(sn), sn]))
        for (const part of warrantyParts) {
          const assignedKey = normalizeSn(part.device_sn)
          if (!assignedKey && deviceSns.length === 1) {
            part.device_sn = deviceSns[0]
            continue
          }
          if (!assignedKey || !normalizedDeviceSns.has(assignedKey)) {
            return { code: -1, msg: '全新原厂更换件必须关联本工单中的设备SN，才能承诺3个月维修件延保' }
          }
          part.device_sn = normalizedDeviceSns.get(assignedKey)
        }
      }
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const updateData = {
        ...quoteData
      }

      const isWarrantyFree = quoteData.total_price <= 0 && warrantyFreeConfirmed

      if (quoteData.quote_status === 'issued') {
        updateData.payment_status = isWarrantyFree
          ? 'not_required'
          : (order.payment_status === 'paid' ? 'paid' : 'pending')
        updateData.needs_return = false
        updateData.archive_status = 'active'
      }

      if (quoteData.quote_status === 'issued') {
        if (isWarrantyFree) {
          updateData.payment_deadline = 0
        } else {
          // 付款截止时间：优先用后台传入的绝对时间，其次按天数，否则默认 7 天
          const days = Math.max(1, parseInt(quote.payment_deadline_days ?? quote.paymentDeadlineDays ?? DEFAULT_PAYMENT_DEADLINE_DAYS, 10) || DEFAULT_PAYMENT_DEADLINE_DAYS)
          const absoluteDeadline = parseInt(quote.payment_deadline ?? quote.paymentDeadline ?? 0, 10) || 0
          updateData.payment_deadline = absoluteDeadline > now ? absoluteDeadline : (now + days * 24 * 3600 * 1000)
        }
        updateData.timeline = [
          ...timeline,
          {
            title: isWarrantyFree ? '质保方案已发布' : '维修报价已发布',
            desc: isWarrantyFree
              ? '本次维修符合质保免收费条件，等待客户确认维修。'
              : `报价合计 ${quoteData.total_price.toFixed(2)} 元，等待客户确认。`,
            time: now,
            done: true
          }
        ]
      }

      const res = await db.collection('cicada_orders').doc(order_id).update(updateData)
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      await logOrderEvent({
        order,
        action: 'issue_quote',
        actor: currentAdmin,
        before: {
          quote_status: order.quote_status || 'pending',
          quote_items: order.quote_items || [],
          quote_detail: order.quote_detail || null,
          total_price: Number(order.total_price || 0)
        },
        after: {
          quote_status: quoteData.quote_status,
          quote_items: quoteData.quote_items,
          quote_detail: quoteData.quote_detail,
          total_price: quoteData.total_price
        }
      })

      if (quoteData.quote_status === 'issued' && order.quote_status !== 'issued') {
        await sendOrderSubscription({ ...order, ...updateData }, 'quote_issued', '维修报价已发布')
      }
      return { code: 0, data: updateData }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 后台核销客户付款凭证/到账状态
  async updatePaymentStatus(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'confirm_payment')
      const { order_id, status, reason = '', payment_method = '' } = pickParam(this, params)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      const paymentStatus = normalizeText(status || 'paid')
      if (!PAYMENT_STATUS.includes(paymentStatus)) return { code: -1, msg: '付款状态不正确' }

      const now = Date.now()
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }

      const rejectReason = normalizeText(reason).slice(0, 200)
      if (paymentStatus === 'rejected' && !rejectReason) {
        return { code: -1, msg: '驳回转账凭证时必须填写原因' }
      }
      let confirmedPaymentMethod = ''
      if (paymentStatus === 'paid' && order.payment_status !== 'paid') {
        assertManualPaymentConfirmationAllowed(order)
        confirmedPaymentMethod = resolveManualPaymentMethod(order, payment_method)
      }

      const updateData = {
        payment_status: paymentStatus,
        payment_update_time: now,
        update_time: now
      }

      if (paymentStatus === 'paid') {
        if (order.payment_status !== 'paid') {
          updateData.payment_method = confirmedPaymentMethod
          updateData.payment_paid_time = now
          Object.assign(updateData, getPaymentConfirmationStatusUpdate(order, now, canTransitionOrderStatus))
          if (updateData.status === 'fixing' && getRepairStartBlockReason({ ...order, payment_status: 'paid' })) {
            delete updateData.status
          }
        }
        updateData.payment_reject_reason = ''
        updateData.payment_reject_time = 0
      }

      if (paymentStatus === 'rejected') {
        updateData.payment_reject_reason = rejectReason
        updateData.payment_reject_time = now
      }

      if ((paymentStatus === 'paid' && order.payment_status !== 'paid') || paymentStatus === 'rejected') {
        const timeline = Array.isArray(order.timeline) ? order.timeline : []
        updateData.timeline = [
          ...timeline,
          paymentStatus === 'paid'
            ? {
                title: '付款已核销',
                desc: updateData.status === 'fixing'
                  ? '财务已确认对公付款到账，工单已进入处理中。'
                  : '财务已确认对公付款到账。',
                time: now,
                done: true
              }
            : {
                title: '转账凭证已驳回',
                desc: rejectReason,
                time: now,
                done: true
              }
        ]
      }

      const isNewPaymentConfirmation = paymentStatus === 'paid' && order.payment_status !== 'paid'
      const updateMatch = {
        _id: order_id,
        status: order.status,
        payment_status: dbCmd.in(MANUAL_CONFIRMABLE_PAYMENT_STATUSES)
      }
      if (order.update_time) updateMatch.update_time = order.update_time
      const res = isNewPaymentConfirmation
        ? await db.collection('cicada_orders').where(updateMatch).update(updateData)
        : await db.collection('cicada_orders').doc(order_id).update(updateData)
      if (!res.updated) {
        return {
          code: -1,
          msg: isNewPaymentConfirmation ? '工单状态已变化，请刷新后重新确认收款' : '工单不存在'
        }
      }

      let inventoryResult = null
      if (isNewPaymentConfirmation) {
        try {
          inventoryResult = await outboundOrderInventory({ ...order, ...updateData }, currentAdmin, Date.now())
        } catch (inventoryError) {
          inventoryResult = {
            skipped: true,
            warning: true,
            reason: `付款已确认，但配件未自动出库：${inventoryError.message || '请到库存管理核对'}`,
            flows: []
          }
        }
      }
      await logOrderEvent({
        order,
        action: paymentStatus === 'rejected' ? 'reject_payment_proof' : 'confirm_payment',
        actor: currentAdmin,
        before: {
          payment_status: order.payment_status || 'pending',
          payment_method: order.payment_method || '',
          status: order.status || ''
        },
        after: {
          payment_status: paymentStatus,
          payment_method: updateData.payment_method || order.payment_method || '',
          status: updateData.status || order.status || '',
          reason: rejectReason
        }
      })

      if (paymentStatus === 'paid' && order.payment_status !== 'paid') {
        await sendOrderSubscription({ ...order, ...updateData }, 'payment_confirmed', '付款已确认')
      }
      if (paymentStatus === 'rejected') {
        await sendOrderSubscription({ ...order, ...updateData }, 'payment_rejected', rejectReason || '转账凭证未通过审核')
      }
      // 库存未自动扣减的告警（报价含配件但未绑定库存）随响应返回，供前端提示运营核对
      const msg = inventoryResult && inventoryResult.warning ? inventoryResult.reason : ''
      return { code: 0, msg, data: { ...updateData, inventoryResult } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 恢复异常的配件出库锁。先核对流水，只有流水与报价完全匹配时才自动补齐订单状态；
  // 没有任何流水的卡单可在人工确认后 reset，再使用 retry 重新扣减库存。
  async recoverOrderInventory(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'manage_inventory')
      const { order_id, action = 'inspect', confirm = false } = pickParam(this, params)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      if (order.inventory_deducted) return { code: 0, data: { status: 'outbound', recovered: false, message: '该工单已完成配件出库' } }
      if (!['outbound_processing', 'outbound_failed'].includes(order.inventory_status)) {
        return { code: -1, msg: `当前库存状态为 ${order.inventory_status || '未处理'}，无需恢复` }
      }

      if (order.inventory_status === 'outbound_failed' && action === 'retry') {
        const result = await outboundOrderInventory(order, currentAdmin, Date.now(), { required: true })
        return { code: 0, data: { status: 'outbound', recovered: true, retry: true, result } }
      }

      const flowRes = await db.collection('cicada_inventory_flows')
        .where({ order_id, flow_type: 'outbound' })
        .limit(200)
        .get()
      const flows = flowRes.data || []
      const lines = getQuoteInventoryLines(order)
      const expected = new Map()
      for (const line of lines) {
        const part = await findInventoryPart(line)
        const key = part ? String(part._id) : (line.part_id || `code:${line.part_code}`)
        expected.set(key, (expected.get(key) || 0) + line.quantity)
      }
      const actual = new Map()
      for (const flow of flows) {
        const key = String(flow.part_id || (flow.part_code ? `code:${flow.part_code}` : ''))
        if (key) actual.set(key, (actual.get(key) || 0) + Math.max(Number(flow.quantity || 0), 0))
      }
      const matches = expected.size > 0 && expected.size === actual.size && [...expected.entries()].every(([key, quantity]) => actual.get(key) === quantity)

      if (matches) {
        const now = Date.now()
        await db.collection('cicada_orders').doc(order_id).update({
          inventory_deducted: true,
          inventory_deduct_time: order.inventory_deduct_time || now,
          inventory_status: 'outbound',
          inventory_processing_at: 0,
          update_time: now
        })
        await logOrderEvent({ order, action: 'inventory_recovery_finalize', actor: currentAdmin, before: { inventory_status: order.inventory_status }, after: { inventory_status: 'outbound', flow_count: flows.length } })
        return { code: 0, data: { status: 'outbound', recovered: true, mode: 'finalize', flowCount: flows.length } }
      }

      if (action === 'reset' && confirm === true && flows.length === 0) {
        const now = Date.now()
        await db.collection('cicada_orders').doc(order_id).update({ inventory_status: 'outbound_failed', inventory_processing_at: 0, update_time: now })
        await logOrderEvent({ order, action: 'inventory_recovery_reset', actor: currentAdmin, before: { inventory_status: order.inventory_status }, after: { inventory_status: 'outbound_failed' } })
        return { code: 0, data: { status: 'outbound_failed', recovered: true, mode: 'reset' } }
      }

      return {
        code: -1,
        msg: flows.length ? '库存流水与报价配件数量不一致，请人工核对后处理' : '未发现出库流水；请确认库存未扣减后使用 confirm=true reset，再执行 retry',
        data: { status: order.inventory_status, flowCount: flows.length, expected: [...expected.entries()], actual: [...actual.entries()] }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 微信支付退款（限 admin/finance）。支持全额或部分退款，幂等防重复，写审计。
  async refundOrderPayment(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'confirm_payment')
      const { order_id, reason = '', amount } = pickParam(this, params)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }

      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }

      // 前置校验：必须是已用微信支付成功的工单
      if (order.payment_status !== 'paid') return { code: -1, msg: '该工单未完成支付，无法退款' }
      if (order.payment_method !== 'wechat_pay') return { code: -1, msg: '仅支持微信支付订单在线退款，其他方式请线下处理' }
      if (order.refund_status === 'refunded') return { code: -1, msg: '该工单已退款，请勿重复操作' }
      if (order.refund_status === 'processing') return { code: -1, msg: '退款处理中，请稍后查询结果' }

      const outTradeNo = String(order.wechat_pay_out_trade_no || '').trim()
      const transactionId = String(order.wechat_pay_transaction_id || '').trim()
      if (!outTradeNo && !transactionId) return { code: -1, msg: '缺少微信支付交易号，无法退款' }

      const totalFen = getOrderPaidAmountFen(order)
      if (totalFen <= 0) return { code: -1, msg: '无法确定原支付金额，请核对工单' }
      // amount 为可选的退款金额（元），不传则全额退款
      const refundFen = amount === undefined || amount === '' || amount === null
        ? totalFen
        : Math.round((Number(amount) || 0) * 100)
      if (!(refundFen > 0) || refundFen > totalFen) return { code: -1, msg: '退款金额不合法（需大于0且不超过原支付金额）' }

      const config = getWechatPayConfig()
      const outRefundNo = genRefundNo(order, refundFen)
      const reasonText = String(reason || '').trim().slice(0, 80)
      const body = {
        out_refund_no: outRefundNo,
        reason: reasonText || '售后退款',
        amount: { refund: refundFen, total: totalFen, currency: 'CNY' }
      }
      if (transactionId) body.transaction_id = transactionId
      else body.out_trade_no = outTradeNo
      if (config.notifyUrl) body.notify_url = config.notifyUrl

      // 条件更新抢占退款处理权，避免并发双击同时通过前置校验。
      const now = Date.now()
      const lockRes = await db.collection('cicada_orders')
        .where({
          _id: order_id,
          payment_status: 'paid',
          payment_method: 'wechat_pay',
          refund_status: dbCmd.and(dbCmd.neq('processing'), dbCmd.neq('refunded'))
        })
        .update({
          refund_status: 'processing',
          refund_out_no: outRefundNo,
          refund_amount_fen: refundFen,
          update_time: now
        })
      if (!lockRes.updated) {
        const latestRes = await db.collection('cicada_orders').doc(order_id).get()
        const latest = latestRes.data && latestRes.data[0]
        if (latest && latest.refund_status === 'refunded') return { code: -1, msg: '该工单已退款，请勿重复操作' }
        return { code: -1, msg: '退款处理中，请稍后查询结果' }
      }

      let result
      try {
        result = await requestWechatPay('POST', '/v3/refund/domestic/refunds', body, config)
      } catch (err) {
        // 退款下单失败：回滚处理中标记，便于重试
        await db.collection('cicada_orders').doc(order_id).update({ refund_status: order.refund_status || '', update_time: Date.now() })
        return { code: -1, msg: `微信退款失败：${err.message}` }
      }

      // SUCCESS=即时退款成功；PROCESSING=受理中（异步到账）
      const wxStatus = String(result.status || '').toUpperCase()
      const isDone = wxStatus === 'SUCCESS'
      const finishedAt = Date.now()
      const fullRefund = refundFen >= totalFen
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const updateData = {
        refund_status: isDone ? 'refunded' : 'processing',
        refund_amount_fen: refundFen,
        refund_out_no: outRefundNo,
        wechat_refund_id: result.refund_id || '',
        refund_reason: reasonText,
        refund_time: isDone ? finishedAt : 0,
        update_time: finishedAt,
        timeline: [
          ...timeline,
          {
            title: isDone ? '已退款' : '退款受理中',
            desc: `${fullRefund ? '全额' : '部分'}退款 ¥${(refundFen / 100).toFixed(2)}${reasonText ? `（${reasonText}）` : ''}`,
            time: finishedAt,
            done: isDone
          }
        ]
      }
      // 全额退款且即时成功时，同步把付款状态回退为已退款
      if (isDone && fullRefund) updateData.payment_status = 'refunded'

      await db.collection('cicada_orders').doc(order_id).update(updateData)
      await logOrderEvent({
        order,
        action: 'refund_payment',
        actor: currentAdmin,
        before: { payment_status: order.payment_status, refund_status: order.refund_status || '' },
        after: { refund_status: updateData.refund_status, refund_amount_fen: refundFen, out_refund_no: outRefundNo, wx_status: wxStatus }
      })

      return { code: 0, msg: isDone ? '退款成功' : '退款已受理，到账以微信结果为准', data: { ...updateData, wx_status: wxStatus } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 主动查询微信退款单，作为异步退款通知不可用时的兜底对账入口。
  async syncRefundStatus(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'confirm_payment')
      const { order_id } = pickParam(this, params)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      if (order.refund_status === 'refunded') return { code: 0, data: { refund_status: 'refunded', unchanged: true } }
      const outRefundNo = normalizeText(order.refund_out_no)
      if (!outRefundNo) return { code: -1, msg: '缺少微信退款单号，无法查询' }

      const config = getWechatPayConfig()
      const result = await requestWechatPay('GET', `/v3/refund/domestic/refunds/${encodeURIComponent(outRefundNo)}`, undefined, config)
      const wxStatus = normalizeText(result && result.status).toUpperCase()
      const isSuccess = wxStatus === 'SUCCESS'
      const isFailed = ['CLOSED', 'ABNORMAL', 'FAILED', 'REFUND_CLOSED'].includes(wxStatus)
      const nextStatus = isSuccess ? 'refunded' : (isFailed ? 'failed' : 'processing')
      const refundFen = Number(order.refund_amount_fen || 0) || 0
      const totalFen = getOrderPaidAmountFen(order)
      const now = Date.now()
      const updateData = {
        refund_status: nextStatus,
        wechat_refund_id: normalizeText(result && result.refund_id) || order.wechat_refund_id || '',
        refund_query_time: now,
        refund_time: isSuccess ? (order.refund_time || now) : (order.refund_time || 0),
        update_time: now
      }
      if (isSuccess && refundFen >= totalFen) updateData.payment_status = 'refunded'
      if (isFailed) updateData.refund_failure_reason = normalizeText(result && (result.reason || result.message))
      const oldTimeline = Array.isArray(order.timeline) ? order.timeline : []
      const title = isSuccess ? '退款已完成' : (isFailed ? '退款失败' : '退款仍在处理中')
      updateData.timeline = [...oldTimeline, { title, desc: `微信退款状态：${wxStatus || '未知'}`, time: now, done: isSuccess || isFailed }]
      await db.collection('cicada_orders').doc(order_id).update(updateData)
      await logOrderEvent({ order, action: 'sync_refund_status', actor: currentAdmin, before: { refund_status: order.refund_status || '' }, after: { refund_status: nextStatus, wx_status: wxStatus } })
      return { code: 0, msg: isSuccess ? '退款已完成' : (isFailed ? '微信退款失败' : '退款仍在处理中'), data: { ...updateData, wx_status: wxStatus } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getSettlementList(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'view_settlement')
      const { paymentStatus = '', paymentMethod = '', keyword = '', page = 1, pageSize = 20 } = pickParam(this, params)
      const pagination = normalizePage(page, pageSize)
      const normalizedKeyword = normalizeText(keyword).toLowerCase()
      const matchCond = {
        total_price: dbCmd.gt(0),
        quote_status: dbCmd.in(['issued', 'confirmed', 'rejected'])
      }
      if (paymentStatus) matchCond.payment_status = paymentStatus
      if (paymentMethod === 'corporate') {
        matchCond.payment_method = dbCmd.in(['offline_transfer', 'bank_transfer'])
      } else if (paymentMethod === 'wechat_pay') {
        matchCond.payment_method = 'wechat_pay'
      }
      const fallback = await fetchOrderBatches(matchCond, { maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT, returnMeta: true })
      // 整批一次换取凭证临时链接，避免每单一次 getTempFileURL 的 N+1
      const settlementProofIds = []
      ;(fallback.orders || []).forEach(order => {
        collectProofCloudFileIds(order.payment_proofs || order.paymentProofs || [])
          .forEach(id => settlementProofIds.push(id))
      })
      const settlementUrlMap = await fetchTempUrlMap(settlementProofIds)
      const enriched = (fallback.orders || []).map(order => stripPaymentProofsIfForbidden(
        { ...order, payment_proofs: applyProofUrlMap(order.payment_proofs || order.paymentProofs || [], settlementUrlMap) },
        currentAdmin
      ))
      const filtered = enriched.filter(order => {
        const shipBack = order.ship_back_info || {}
        const searchable = [
          order.order_no,
          order._id,
          shipBack.name,
          shipBack.phone,
          shipBack.unit
        ].filter(Boolean).join(' ').toLowerCase()
        return !normalizedKeyword || searchable.includes(normalizedKeyword)
      })
      const start = (pagination.page - 1) * pagination.pageSize
      const list = filtered.slice(start, start + pagination.pageSize).map(order => ({
        _id: order._id,
        order_no: order.order_no,
        customer_name: (order.ship_back_info && (order.ship_back_info.unit || order.ship_back_info.name)) || '',
        contact_phone: (order.ship_back_info && order.ship_back_info.phone) || '',
        quote_status: order.quote_status || 'pending',
        status: order.status || '',
        payment_status: order.payment_status || 'pending',
        payment_proofs: order.payment_proofs || [],
        total_price: Number(order.total_price || 0),
        parts_fee: Number(order.parts_fee || 0),
        labor_fee: Number(order.labor_fee || 0),
        invoice_info: order.invoice_info || {},
        inventory_deducted: Boolean(order.inventory_deducted),
        // 对账维度：支付渠道/付款时间/微信单号 + 物流单号（四流合一）
        payment_method: order.payment_method || '',
        payment_paid_time: order.payment_paid_time || 0,
        wechat_transaction_id: order.wechat_pay_transaction_id || '',
        out_trade_no: order.order_no || '',
        logistics_no_out: (order.ship_out_info && (order.ship_out_info.logistics_no || order.ship_out_info.tracking_no)) || '',
        logistics_no_back: (order.ship_back_info && (order.ship_back_info.logistics_no || order.ship_back_info.tracking_no)) || '',
        create_time: order.create_time || 0,
        update_time: order.update_time || 0
      }))
      return {
        code: 0,
        data: {
          list,
          total: filtered.length,
          page: pagination.page,
          pageSize: pagination.pageSize,
          truncated: fallback.truncated
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 追加工单时间线节点
  async addTimeline(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'add_timeline')
      let order_id, title, desc
      if (params && params.order_id) {
        ({ order_id, title, desc } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ order_id, title, desc } = body)
        }
      }
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      if (!title || typeof title !== 'string') return { code: -1, msg: '时间线标题不能为空' }
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      const timelineItem = { title, desc, time: Date.now(), done: true }
      const res = await db.collection('cicada_orders').doc(order_id).update({
        timeline: dbCmd.push(timelineItem),
        update_time: Date.now()
      })
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      await logOrderEvent({
        order,
        action: 'add_timeline',
        actor: currentAdmin,
        before: { timeline_count: Array.isArray(order.timeline) ? order.timeline.length : 0 },
        after: { timeline: timelineItem }
      })
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 获取统计数据
  // 工单操作审计日志查询（医疗器械合规备查）：按工单号/操作类型/时间范围筛选，分页按时间倒序
  async getOrderEvents(params) {
    try {
      requireAdminPermission(this, 'view_audit_log')
      const body = pickParam(this, params)
      const orderNo = String(body.orderNo || '').trim()
      const action = String(body.action || '').trim()
      const actorName = String(body.actorName || '').trim()
      const startTime = body.startTime ? Number(body.startTime) : null
      const endTime = body.endTime ? Number(body.endTime) : null

      let page = Number(body.page) || 1
      let pageSize = Number(body.pageSize) || 20
      if (page < 1) page = 1
      if (pageSize < 1) pageSize = 20
      if (pageSize > 200) pageSize = 200

      const where = {}
      if (orderNo) where.order_no = orderNo
      if (action) where.action = action
      if (actorName) where.actor_name = actorName
      if (startTime && endTime) where.create_time = dbCmd.gte(startTime).and(dbCmd.lte(endTime))
      else if (startTime) where.create_time = dbCmd.gte(startTime)
      else if (endTime) where.create_time = dbCmd.lte(endTime)

      const offset = (page - 1) * pageSize
      const collection = db.collection('cicada_order_events')
      const [countRes, listRes] = await Promise.all([
        collection.where(where).count(),
        collection.where(where).orderBy('create_time', 'desc').skip(offset).limit(pageSize).get()
      ])

      return {
        code: 0,
        data: {
          list: listRes.data || [],
          total: countRes.total,
          page,
          pageSize
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 售后工程师绩效：统计指定月份各工程师的完工工单数（含负责品类/区域），默认当月
  async getEngineerPerformance(params) {
    try {
      requireAdminPermission(this, 'manage_staff')
      const body = pickParam(this, params)
      const now = new Date()
      const year = Number(body.year) || now.getFullYear()
      const month = Number(body.month) || (now.getMonth() + 1)
      const monthStart = new Date(year, month - 1, 1).getTime()
      const monthEnd = new Date(year, month, 1).getTime()

      // 当月完工工单（完工时间近似取 update_time），仅取 engineer_id，JS 侧按工程师聚合
      const ordersRes = await db.collection('cicada_orders')
        .where(withActiveOrderFilter({ status: 'completed', update_time: dbCmd.gte(monthStart).and(dbCmd.lt(monthEnd)) }))
        .field({ engineer_id: true })
        .limit(2000)
        .get()
      const counts = {}
      ;(ordersRes.data || []).forEach(o => {
        if (o.engineer_id) counts[o.engineer_id] = (counts[o.engineer_id] || 0) + 1
      })

      // 工程师/管理员名单及其负责品类、区域
      const staffRes = await db.collection('cicada_users')
        .where({ role: dbCmd.in(['engineer', 'admin', 'superadmin']) })
        .field({ name: true, nickname: true, username: true, role: true, device_categories: true, service_areas: true })
        .limit(500)
        .get()

      const list = (staffRes.data || []).map(u => ({
        engineer_id: u._id,
        name: u.name || u.nickname || u.username || '',
        role: u.role,
        device_categories: u.device_categories || [],
        service_areas: u.service_areas || [],
        completed_count: counts[u._id] || 0
      })).sort((a, b) => b.completed_count - a.completed_count)

      return { code: 0, data: { year, month, list } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getStatistics(params) {
    try {
      requireAdminPermission(this, 'get_stats')
      const { includeStatusBreakdown = false } = pickParam(this, params)
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime()

      const [pendingRes, todayRes, statusResults] = await Promise.all([
        db.collection('cicada_orders').where({
          status: dbCmd.in(['pending', 'sent', 'received']),
          is_deleted: dbCmd.neq(true)
        }).count(),
        db.collection('cicada_orders').where(withActiveOrderFilter({ create_time: dbCmd.gte(todayStart) })).count(),
        includeStatusBreakdown
          ? Promise.all(ORDER_STATUS.map(status => (
              db.collection('cicada_orders').where(withActiveOrderFilter({ status })).count()
            )))
          : Promise.resolve(null)
      ])

      const statusBreakdown = statusResults
        ? Object.fromEntries(ORDER_STATUS.map((status, index) => [status, Number(statusResults[index].total || 0)]))
        : undefined

      return {
        code: 0,
        data: {
          pendingCount: pendingRes.total,
          todayCount: todayRes.total,
          ...(statusBreakdown ? { statusBreakdown } : {})
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 获取后台待办中心分组统计
  async getTodoSummary(params) {
    try {
      requireAdminPermission(this, 'get_stats')
      const groups = [
        { key: 'inbound', title: '待签收', desc: '客户已提交或运输中的工单', count: 0 },
        { key: 'quote', title: '待报价', desc: '已签收/处理中但未发布报价', count: 0 },
        { key: 'payment', title: '待核销', desc: '客户已上传付款凭证', count: 0 },
        { key: 'invoice', title: '待开票', desc: '客户已提交发票申请', count: 0 },
        { key: 'return', title: '待回寄', desc: '已报价或拒修且尚未回寄', count: 0 },
        { key: 'exception', title: '异常工单', desc: '需要人工介入处理', count: 0 }
      ]

      const counts = await Promise.all(groups.map(group => countOrdersByMatch(getTodoCountMatchCond(group.key), group.key)))
      groups.forEach((group, index) => { group.count = counts[index] || 0 })

      return { code: 0, data: { groups } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 站内提醒中心：聚合现有工单、物流与 SLA 规则，不创建第二份待办数据。
  async getNotificationSummary(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'view_order')
      const groups = []
      const unavailable = []
      let orders = []
      try {
        orders = await fetchOrderBatches({ status: dbCmd.neq('cancelled') }, { maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT })
      } catch (error) {
        unavailable.push('工单待办')
      }

      const addOrderGroup = ({ key, title, severity, roles, filter, description }) => {
        if (!canViewNotificationGroup(currentAdmin, roles)) return
        const matched = orders.filter(filter).sort((a, b) => Number(b.update_time || b.create_time || 0) - Number(a.update_time || a.create_time || 0))
        if (!matched.length) return
        groups.push({
          key,
          title,
          severity,
          count: matched.length,
          samples: buildOrderNotificationSamples(matched, description)
        })
      }

      if (!unavailable.length) {
        addOrderGroup({
          key: 'quote', title: '待报价', severity: 'info', roles: ['admin', 'engineer', 'support'],
          filter: order => matchesTodoType(order, 'quote'),
          description: order => `当前状态：${getOrderStatusLabel(order.status || '待处理')}`
        })
        addOrderGroup({
          key: 'payment', title: '待核销', severity: 'warning', roles: ['admin', 'finance'],
          filter: order => matchesTodoType(order, 'payment'),
          description: () => '客户已提交付款凭证，等待核验'
        })
        addOrderGroup({
          key: 'invoice', title: '待开票', severity: 'warning', roles: ['admin', 'finance'],
          filter: order => matchesTodoType(order, 'invoice'),
          description: () => '客户已提交开票申请，等待处理'
        })
        addOrderGroup({
          key: 'sla_warning', title: 'SLA 临近超时', severity: 'warning', roles: ['admin', 'engineer', 'support'],
          filter: order => getSlaInfo(order).level === 'warning',
          description: order => {
            const sla = getSlaInfo(order)
            return `${sla.title || '当前阶段'}已停留 ${sla.dwell_hours} 小时，建议${sla.action || '尽快处理'}`
          }
        })
        addOrderGroup({
          key: 'sla_critical', title: 'SLA 已超时', severity: 'critical', roles: ['admin', 'engineer', 'support'],
          filter: order => getSlaInfo(order).level === 'critical',
          description: order => {
            const sla = getSlaInfo(order)
            return `${sla.title || '当前阶段'}已停留 ${sla.dwell_hours} 小时，需优先处理`
          }
        })
        if (canViewNotificationGroup(currentAdmin, ['admin', 'engineer', 'support'])) {
          try {
            const exceptions = await collectLogisticsExceptions(orders)
            if (exceptions.length) {
              groups.push({
                key: 'logistics',
                title: '物流异常',
                severity: exceptions.some(item => item.type === 'provider_exception') ? 'critical' : 'warning',
                count: exceptions.length,
                samples: exceptions.slice(0, 5).map(item => ({
                  id: item.orderId || '',
                  title: `工单 ${item.orderNo || item.orderId || '-'}`,
                  desc: item.reason || '物流异常，建议及时核实'
                }))
              })
            }
          } catch (error) {
            unavailable.push('物流异常')
          }
        }
      }

      const severityRank = { critical: 0, warning: 1, info: 2 }
      groups.sort((a, b) => {
        const rank = severityRank[a.severity] - severityRank[b.severity]
        return rank || b.count - a.count
      })
      return { code: 0, data: { total: groups.reduce((sum, group) => sum + group.count, 0), groups, unavailable } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 物流异常列表：扫在途工单，按时间信号判定 48h 未揽收 / 72h 停滞，供后台主动联系客户
  // 注：当前轨迹按工单状态合成，判定基于工单时间戳；接通真实物流轨迹后判定会更精准。
  async getLogisticsExceptions(params) {
    try {
      requireAdminPermission(this, 'view_order')
      const exceptions = await collectLogisticsExceptions()
      return { code: 0, data: { total: exceptions.length, exceptions } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 查询单段物流轨迹。物流公司、运单号和手机号均只从订单存量数据取得，禁止前端透传。
  async getLogisticsTrack(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'view_order')
      const p = pickParam(this, params)
      const orderId = normalizeText(p.orderId || p.order_id)
      const segment = normalizeText(p.segment)
      const refresh = p.refresh === true || p.refresh === 'true'
      if (!orderId) return { code: -1, msg: '缺少工单ID' }
      if (!['out', 'back'].includes(segment)) return { code: -1, msg: '物流段参数不正确' }

      const orderRes = await db.collection('cicada_orders').doc(orderId).get()
      const order = orderRes.data && orderRes.data[0]
      if (!order || isDeletedOrder(order)) return { code: -1, msg: '工单不存在' }
      const shipInfo = getOrderShipInfo(order, segment)
      const existingCache = (order.track_cache && order.track_cache[segment]) || {}
      const providerConfig = expressProvider.getConfig()
      const base = {
        segment,
        company: shipInfo.company,
        tracking_no: shipInfo.trackingNo,
        configured: Boolean(providerConfig.queryConfigured),
        cache: existingCache
      }
      if (!shipInfo.company || !shipInfo.trackingNo) {
        return { code: 0, data: { ...base, available: false, message: '该物流段尚未录入快递公司或运单号' } }
      }

      if (!refresh && expressProvider.isFresh(existingCache, shipInfo.trackingNo)) {
        return { code: 0, data: { ...base, available: true, cached: true, message: '' } }
      }

      let result
      try {
        result = await expressProvider.query(shipInfo)
      } catch (error) {
        return {
          code: 0,
          data: {
            ...base,
            available: Boolean(existingCache && existingCache.tracks),
            cached: Boolean(existingCache && existingCache.tracks),
            message: error.message || '物流查询暂不可用'
          }
        }
      }
      if (!result.configured) {
        return { code: 0, data: { ...base, available: Boolean(existingCache && existingCache.tracks), cached: Boolean(existingCache && existingCache.tracks), message: '物流查询服务尚未配置' } }
      }
      if (!result.success || !result.cache) {
        return { code: 0, data: { ...base, available: Boolean(existingCache && existingCache.tracks), cached: Boolean(existingCache && existingCache.tracks), message: result.message || '暂无物流轨迹' } }
      }

      const reconciled = reconcileTrackCache(existingCache, result.cache)
      if (!reconciled.accepted) {
        return {
          code: 0,
          data: {
            ...base,
            available: Boolean(existingCache && existingCache.tracks),
            cached: true,
            cache: existingCache,
            message: reconciled.reason === 'stale' ? '查询结果较旧，已保留最新轨迹' : '轨迹未发生变化'
          }
        }
      }
      const now = Date.now()
      const nextCache = reconciled.cache
      await db.collection('cicada_orders').doc(order._id).update({
        track_cache: { ...(order.track_cache || {}), [segment]: nextCache },
        logistics_track_update_time: now
      })
      // 审计不记录手机号、运单号或第三方凭证，仅保留操作结果。
      await logOrderEvent({
        order,
        source: 'admin',
        action: 'logistics_track_refresh',
        actor: currentAdmin,
        after: { segment, result: 'success', fetched_at: now }
      })
      return { code: 0, data: { ...base, available: true, cached: false, cache: nextCache, message: '' } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 物流台账：两段物流（寄出/回寄）汇总，支持分页拉全量导出；超扫描上限返回 truncated
  async getLogisticsLedger(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'export_order')
      const canConfirmArrival = hasRolePermission(currentAdmin.role, 'update_status')
      const { status = '', keyword = '', page = 1, pageSize = 20 } = pickParam(this, params)
      const pagination = normalizePage(page, pageSize)
      const kw = normalizeText(keyword).toLowerCase()
      const matchCond = { status: dbCmd.neq('cancelled') }
      if (status && ORDER_STATUS.includes(status)) matchCond.status = status
      const fetched = await fetchOrderBatches(matchCond, { maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT, returnMeta: true })
      const rows = (fetched.orders || []).map(o => {
        const out = o.ship_out_info || {}
        const back = o.ship_back_info || {}
        const outTrack = (o.track_cache && o.track_cache.out) || {}
        const backTrack = (o.track_cache && o.track_cache.back) || {}
        return {
          order_id: o._id,
          order_no: o.order_no || '',
          status: o.status || '',
          customer: normalizeText(back.unit || back.name || ''),
          out_company: normalizeText(out.logistics_company || out.logisticsCompany || ''),
          out_no: normalizeText(out.logistics_no || out.logisticsNo || ''),
          back_company: normalizeText(back.logistics_company || back.logisticsCompany || back.returnCompany || ''),
          back_no: normalizeText(back.logistics_no || back.logisticsNo || back.return_no || back.returnNo || ''),
          out_track_status: normalizeText(outTrack.status || ''),
          out_last_track_at: normalizeText(outTrack.lastTrackAt || ''),
          out_subscription_status: normalizeText(outTrack.subscriptionStatus || ''),
          arrival_confirm_status: normalizeText(o.arrival_confirm_status || ''),
          arrival_detected_at: o.arrival_detected_at || 0,
          arrival_confirmed_at: o.arrival_confirmed_at || 0,
          can_confirm_arrival: canConfirmArrival,
          back_track_status: normalizeText(backTrack.status || ''),
          back_last_track_at: normalizeText(backTrack.lastTrackAt || ''),
          back_subscription_status: normalizeText(backTrack.subscriptionStatus || ''),
          create_time: o.create_time || 0,
          update_time: o.update_time || 0
        }
      })
      const filtered = kw
        ? rows.filter(r => [r.order_no, r.customer, r.out_no, r.back_no].filter(Boolean).join(' ').toLowerCase().includes(kw))
        : rows
      const start = (pagination.page - 1) * pagination.pageSize
      const list = filtered.slice(start, start + pagination.pageSize)
      return { code: 0, data: { list, total: filtered.length, page: pagination.page, pageSize: pagination.pageSize, truncated: fetched.truncated } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 四流台账：订单+物流+支付+发票合一，分页拉全量统一导出（取代对账/发票各自导出）
  async getFourFlowLedger(params) {
    try {
      requireAdminPermission(this, 'view_settlement')
      const { status = '', keyword = '', billableOnly = false, page = 1, pageSize = 20 } = pickParam(this, params)
      const pagination = normalizePage(page, pageSize)
      const kw = normalizeText(keyword).toLowerCase()
      const matchCond = { status: dbCmd.neq('cancelled') }
      if (status && ORDER_STATUS.includes(status)) matchCond.status = status
      const fetched = await fetchOrderBatches(matchCond, { maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT, returnMeta: true })
      let rows = (fetched.orders || []).map(o => {
        const out = o.ship_out_info || {}
        const back = o.ship_back_info || {}
        const inv = o.invoice_info || {}
        return {
          order_no: o.order_no || '',
          status: o.status || '',
          customer: normalizeText(back.unit || back.name || ''),
          phone: normalizeText(back.phone || ''),
          total_price: Number(o.total_price || 0),
          parts_fee: Number(o.parts_fee || 0),
          labor_fee: Number(o.labor_fee || 0),
          payment_status: o.payment_status || 'pending',
          payment_method: o.payment_method || '',
          payment_paid_time: o.payment_paid_time || 0,
          wechat_transaction_id: o.wechat_pay_transaction_id || '',
          out_company: normalizeText(out.logistics_company || out.logisticsCompany || ''),
          out_no: normalizeText(out.logistics_no || out.logisticsNo || ''),
          back_company: normalizeText(back.logistics_company || back.logisticsCompany || back.returnCompany || ''),
          back_no: normalizeText(back.logistics_no || back.logisticsNo || back.return_no || back.returnNo || ''),
          invoice_status: inv.status || (inv.need_invoice ? '待开票' : '无需开票'),
          invoice_title: normalizeText(inv.title || ''),
          tax_no: normalizeText(inv.tax_no || ''),
          invoice_no: normalizeText(inv.invoice_no || ''),
          invoice_date: normalizeText(inv.invoice_date || ''),
          mail_company: normalizeText(inv.mail_company || ''),
          mail_no: normalizeText(inv.mail_no || ''),
          received_time: normalizeText(inv.received_time || ''),
          create_time: o.create_time || 0,
          update_time: o.update_time || 0
        }
      })
      if (billableOnly) rows = rows.filter(r => r.total_price > 0)
      const filtered = rows.filter(r => !kw || [r.order_no, r.customer, r.phone, r.out_no, r.back_no, r.invoice_no].filter(Boolean).join(' ').toLowerCase().includes(kw))
      const start = (pagination.page - 1) * pagination.pageSize
      const list = filtered.slice(start, start + pagination.pageSize)
      return { code: 0, data: { list, total: filtered.length, page: pagination.page, pageSize: pagination.pageSize, truncated: fetched.truncated } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 开票申请列表：客户已申请开票（need_invoice）的工单，支持分页拉全量导出 + truncated
  async getInvoiceApplications(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'update_invoice')
      const { status = '', keyword = '', page = 1, pageSize = 20 } = pickParam(this, params)
      const pagination = normalizePage(page, pageSize)
      const kw = normalizeText(keyword).toLowerCase()
      const wantStatus = normalizeInvoiceStatusFilter(status)
      const fetched = await fetchOrderBatches({ status: dbCmd.neq('cancelled') }, { maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT, returnMeta: true })
      const rows = (fetched.orders || [])
        .filter(o => {
          const inv = o.invoice_info || {}
          const invoiceStatus = normalizeText(inv.status)
          const hasIssuedRecord = Boolean(inv.invoice_no) || ['已开具', '已寄出', '已签收'].includes(invoiceStatus)
          // 已开具的历史记录继续保留用于审计；未完成的旧申请必须重新满足当前开票规则。
          return hasIssuedRecord || (!getInvoiceRequestBlockReason(o) && (inv.need_invoice || invoiceStatus))
        })
        .map(o => {
          const inv = o.invoice_info || {}
          const back = o.ship_back_info || {}
          return {
            _id: o._id,
            order_no: o.order_no || '',
            customer: normalizeText(back.unit || back.name || ''),
            total_price: Number(o.total_price || 0),
            status: inv.status || (inv.need_invoice ? '待开票' : '无需开票'),
            invoice_type: normalizeText(inv.invoice_type || ''),
            tax_category: normalizeText(inv.tax_category || INVOICE_TAX_CATEGORY),
            item_name: normalizeText(inv.item_name || INVOICE_ITEM_NAME),
            delivery_method: normalizeText(inv.delivery_method || ''),
            fulfillment_mode: normalizeText(inv.fulfillment_mode || 'manual'),
            archive_status: normalizeText(inv.archive_status || 'pending'),
            archive_order_no: normalizeText(inv.archive_order_no || o.order_no || ''),
            title: normalizeText(inv.title || ''),
            tax_no: normalizeText(inv.tax_no || ''),
            email: normalizeText(inv.email || ''),
            register_address: normalizeText(inv.register_address || ''),
            register_phone: normalizeText(inv.register_phone || ''),
            bank_name: normalizeText(inv.bank_name || ''),
            bank_account: normalizeText(inv.bank_account || ''),
            recipient_name: normalizeText(inv.recipient_name || ''),
            recipient_phone: normalizeText(inv.recipient_phone || ''),
            recipient_address: normalizeText(inv.recipient_address || ''),
            invoice_no: normalizeText(inv.invoice_no || ''),
            invoice_date: normalizeText(inv.invoice_date || ''),
            invoice_url: normalizeText(inv.invoice_url || inv.file_url || ''),
            pdf_url: normalizeText(inv.pdf_url || ''),
            mail_company: normalizeText(inv.mail_company || ''),
            mail_no: normalizeText(inv.mail_no || ''),
            mail_time: normalizeText(inv.mail_time || ''),
            received_time: normalizeText(inv.received_time || ''),
            update_time: o.update_time || 0
          }
        })
      const filtered = rows.filter(r => {
        if (wantStatus && normalizeInvoiceStatusFilter(r.status) !== wantStatus) return false
        if (kw && ![r.order_no, r.customer, r.title, r.invoice_no].filter(Boolean).join(' ').toLowerCase().includes(kw)) return false
        return true
      })
      const start = (pagination.page - 1) * pagination.pageSize
      const list = filtered.slice(start, start + pagination.pageSize)
      return { code: 0, data: { list, total: filtered.length, page: pagination.page, pageSize: pagination.pageSize, truncated: fetched.truncated } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 批量导入开票结果：按工单号回填发票号/日期/链接/状态，写审计
  async batchImportInvoices(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'update_invoice')
      const { rows } = pickParam(this, params)
      if (!Array.isArray(rows) || !rows.length) return { code: -1, msg: '导入数据不能为空' }
      const summary = { total: rows.length, success: 0, fail: 0, errors: [] }
      const seen = new Set()
      const now = Date.now()
      for (const raw of rows) {
        const orderNo = normalizeText(raw.order_no || raw.orderNo || raw['工单编号'] || raw['工单号'])
        if (!orderNo) { summary.fail += 1; summary.errors.push({ orderNo: '-', reason: '缺少工单编号' }); continue }
        if (seen.has(orderNo)) { summary.fail += 1; summary.errors.push({ orderNo, reason: 'Excel中工单编号重复' }); continue }
        seen.add(orderNo)
        const invoiceNo = normalizeText(raw.invoice_no || raw.invoiceNo || raw['发票号码'])
        const invoiceDate = normalizeText(raw.invoice_date || raw.invoiceDate || raw['开票日期'])
        const invoiceUrl = normalizeText(raw.invoice_url || raw.invoiceUrl || raw['发票链接'])
        const statusIn = normalizeInvoiceStatusValue(normalizeText(raw.status || raw['开票状态']) || (invoiceNo ? '已开具' : '开具中'))
        if (!invoiceNo && !invoiceUrl) { summary.fail += 1; summary.errors.push({ orderNo, reason: '缺少发票号码或发票链接' }); continue }
        if (['已开具', '已寄出', '已签收'].includes(statusIn) && (!invoiceNo || !invoiceDate)) {
          summary.fail += 1; summary.errors.push({ orderNo, reason: '已开票记录必须填写发票号码和开票日期' }); continue
        }
        const order = await findOrderByNo(orderNo)
        if (!order) { summary.fail += 1; summary.errors.push({ orderNo, reason: '工单不存在' }); continue }
        if (order.status === 'cancelled') { summary.fail += 1; summary.errors.push({ orderNo, reason: '已取消工单不可开票' }); continue }
        const invoiceNumberConflict = await findInvoiceNumberConflict(invoiceNo, order._id)
        if (invoiceNumberConflict) {
          summary.fail += 1
          summary.errors.push({ orderNo, reason: `发票号码已绑定工单 ${invoiceNumberConflict.order_no || invoiceNumberConflict._id}` })
          continue
        }
        const invoiceBlockReason = getInvoiceRequestBlockReason(order)
        if (invoiceBlockReason) { summary.fail += 1; summary.errors.push({ orderNo, reason: invoiceBlockReason }); continue }
        const oldInvoice = order.invoice_info || {}
        const invoiceInfo = {
          ...oldInvoice,
          need_invoice: true,
          status: statusIn,
          tax_category: INVOICE_TAX_CATEGORY,
          item_name: INVOICE_ITEM_NAME,
          delivery_method: oldInvoice.delivery_method || (oldInvoice.invoice_type === '纸质专用发票' ? 'postal' : 'electronic'),
          fulfillment_mode: 'manual',
          issued_channel: 'manual',
          archive_status: statusIn === '已签收' || (oldInvoice.invoice_type !== '纸质专用发票' && statusIn === '已开具') ? 'archived' : (oldInvoice.archive_status || 'pending'),
          archive_order_id: order._id,
          archive_order_no: order.order_no || '',
          service_completed_time: oldInvoice.service_completed_time || order.completed_time || order.complete_time || order.update_time || now,
          settlement_time: oldInvoice.settlement_time || order.payment_paid_time || order.update_time || now,
          invoice_no: invoiceNo || oldInvoice.invoice_no || '',
          invoice_date: invoiceDate || oldInvoice.invoice_date || '',
          invoice_url: invoiceUrl || oldInvoice.invoice_url || '',
          update_time: now
        }
        if (statusIn === '已开具') invoiceInfo.issued_time = oldInvoice.issued_time || now
        const res = await db.collection('cicada_orders').doc(order._id).update({ invoice_info: invoiceInfo, update_time: now })
        if (!res.updated) { summary.fail += 1; summary.errors.push({ orderNo, reason: '更新失败' }); continue }
        await logOrderEvent({ order, action: 'update_invoice', actor: currentAdmin, before: { invoice_info: oldInvoice }, after: { invoice_info: invoiceInfo } })
        summary.success += 1
      }
      return { code: 0, data: summary }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 供 URL 健康检查确认订阅模板配置通道可达，不暴露模板 ID 明文
  async getSubscriptionConfig(params) {
    try {
      const templates = SUBSCRIPTION_CONFIG_SCENES.map(item => ({
        ...item,
        configured: Boolean(getSubscriptionTemplateId(item.scene))
      }))
      return { code: 0, data: { templates } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 获取服务数据总结
  async getDashboardSummary(params) {
    try {
      requireAdminPermission(this, 'get_stats')
      const { startDate = '', endDate = '', granularity = 'day' } = pickParam(this, params)
      const { startTime, endTime } = normalizeDashboardRange(startDate, endDate)
      const normalizedGranularity = granularity === 'week' ? 'week' : 'day'
      const [orders, feedbackRes] = await Promise.all([
        fetchOrderBatches({ status: dbCmd.neq('cancelled') }),
        db.collection('cicada_feedbacks').where({
          create_time: dbCmd.and(dbCmd.gte(startTime), dbCmd.lte(endTime))
        }).get()
      ])
      const { metrics, trend } = getDashboardMetrics(orders, feedbackRes.data || [], startTime, endTime, normalizedGranularity)

      return {
        code: 0,
        data: {
          metrics,
          trend,
          range: { startTime, endTime, granularity: normalizedGranularity },
          totalOrders: metrics.totalOrders,
          completedOrders: metrics.completedOrders,
          pendingOrders: metrics.pendingOrders,
          monthOrders: metrics.newOrders,
          paidAmount: metrics.paidAmount,
          totalFeedbacks: metrics.totalFeedbacks,
          pendingFeedbacks: metrics.pendingFeedbacks,
          statusBreakdown: metrics.statusBreakdown
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
