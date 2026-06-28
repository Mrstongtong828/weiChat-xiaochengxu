const db = uniCloud.database()
const dbCmd = db.command
const crypto = require('crypto')
const WECHAT_PAY_API_BASE = 'https://api.mch.weixin.qq.com'

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
    received: ['inspecting', 'fixing', 'cancelled'],
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
    export_order: ALL_ROLES,
    get_stats: ALL_ROLES,
    get_workflow_config: ALL_ROLES,
    update_status: ['admin', 'engineer'],
    import_logistics: ['admin', 'engineer'],
    issue_quote: ['admin', 'support'],
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
    getWorkflowConfigForRole,
    hasRolePermission,
    isKnownRole
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
  getWorkflowConfigForRole,
  hasRolePermission,
  isKnownRole
} = loadWorkflowModule()

async function verifyAdminToken(token) {
  if (!token) throw new Error('鉴权失败：非管理人员禁止访问该接口')
  const res = await db.collection('cicada_users').where({ token }).limit(1).get()
  const user = res.data[0]
  if (!user || user.disabled || !isKnownRole(user.role)) {
    throw new Error('鉴权失败：非管理人员禁止访问该接口')
  }
  if (Date.now() > user.token_expire) throw new Error('鉴权失败：Token已过期')
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
  if (type === 'return') return { status: dbCmd.in(['fixing', 'inspecting']), payment_status: 'paid' }
  return null
}

function getTodoCountMatchCond(todoType = '') {
  const directCond = getDirectTodoMatchCond(todoType)
  if (directCond) return directCond
  const type = normalizeText(todoType)
  if (type === 'quote') {
    return {
      status: dbCmd.in(['received', 'inspecting', 'fixing']),
      quote_status: dbCmd.in(['pending', 'draft', 'rejected'])
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
  const [countRes, pageRes] = await Promise.all([
    db.collection('cicada_orders').where(matchCond).count(),
    db.collection('cicada_orders')
      .aggregate()
      .match(matchCond)
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

async function enrichAdminOrderForList(order = {}, currentAdmin = {}) {
  const itemDetail = (order.itemsList && order.itemsList.length > 0) ? order.itemsList[0] : {}
  const orderWithProofs = await enrichPaymentProofs(order)

  return stripPaymentProofsIfForbidden({
    ...orderWithProofs,
    product_name: itemDetail.product_name || '',
    product_model: itemDetail.product_model || '',
    fault_desc: itemDetail.fault_desc || '',
    media_urls: itemDetail.media_urls || [],
    sn: itemDetail.sn || '',
    buy_date: itemDetail.buy_date || '',
    fix_solution: itemDetail.fix_solution || '',
    itemsList: order.itemsList || [],
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
// 安全：CRM 主手机号属客户档案敏感信息，仅 admin 可见完整号（与 CRM view_phone=admin-only 对齐），
// 其余角色（engineer/finance/support）一律脱敏，避免工单列表旁路 CRM 脱敏策略。
async function attachCustomerSummaries(orders = [], currentAdmin = {}) {
  if (!Array.isArray(orders) || !orders.length) return
  const canViewFullPhone = String(currentAdmin && currentAdmin.role || '').toLowerCase() === 'admin'
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
    if (!c) return
    const displayPhone = canViewFullPhone ? (c.phone || '') : maskPhone(c.phone)
    o.customer = {
      id: c._id,
      name: c.name || '',
      phone: displayPhone,
      customer_type: c.customer_type || '',
      tags: Array.isArray(c.tags) ? c.tags : []
    }
    o.customer_name = c.name || ''
    o.customer_phone = displayPhone
    o.customer_type = c.customer_type || ''
  })
}

async function enrichAdminOrdersForList(rawOrders = [], currentAdmin = {}) {
  const enriched = await Promise.all(rawOrders.map(order => enrichAdminOrderForList(order, currentAdmin)))
  await attachCustomerSummaries(enriched, currentAdmin)
  return enriched
}

async function countOrdersByMatch(matchCond, todoType = '') {
  try {
    const res = await db.collection('cicada_orders').where(matchCond).count()
    return res.total || 0
  } catch (e) {
    const orders = await fetchOrderBatches({ status: dbCmd.neq('cancelled') }, { maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT })
    return orders.filter(order => matchesTodoType(order, todoType)).length
  }
}

const SUBSCRIPTION_SCENE_LABELS = {
  repair_submitted: '报修已提交',
  order_received: '设备已签收',
  quote_issued: '维修报价已发布',
  payment_confirmed: '付款已确认',
  order_shipped: '设备已回寄',
  order_completed: '工单已完成',
  review_invite: '邀请服务评价'
}
const SUBSCRIPTION_CONFIG_SCENES = [
  { scene: 'repair_submitted', title: '报修提交提醒' },
  { scene: 'order_received', title: '设备签收提醒' },
  { scene: 'quote_issued', title: '维修报价提醒' },
  { scene: 'payment_confirmed', title: '付款到账提醒' },
  { scene: 'order_shipped', title: '回寄发货提醒' },
  { scene: 'order_completed', title: '工单完成提醒' },
  { scene: 'review_invite', title: '服务评价邀请' }
]
let wechatAccessTokenCache = { token: '', expireAt: 0 }

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return String(value).trim()
  }
  return ''
}

function getSubscriptionTemplateId(scene = '') {
  const key = String(scene || '').trim().toUpperCase()
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
  const base64Key = getEnvValue('WX_PAY_PRIVATE_KEY_BASE64', 'WXPAY_PRIVATE_KEY_BASE64', 'WECHAT_PAY_PRIVATE_KEY_BASE64')
  if (base64Key) return Buffer.from(base64Key, 'base64').toString('utf8')
  return normalizeWxPrivateKey(getEnvValue('WX_PAY_PRIVATE_KEY', 'WXPAY_PRIVATE_KEY', 'WECHAT_PAY_PRIVATE_KEY'))
}

function getWechatPayConfig() {
  const config = {
    appId: getEnvValue('WX_PAY_APPID', 'WXPAY_APPID', 'WECHAT_PAY_APPID', 'WX_APPID'),
    mchId: getEnvValue('WX_PAY_MCH_ID', 'WXPAY_MCH_ID', 'WECHAT_PAY_MCH_ID'),
    serialNo: getEnvValue('WX_PAY_SERIAL_NO', 'WXPAY_SERIAL_NO', 'WECHAT_PAY_SERIAL_NO'),
    notifyUrl: getEnvValue('WX_PAY_REFUND_NOTIFY_URL', 'WX_PAY_NOTIFY_URL', 'WXPAY_NOTIFY_URL', 'WECHAT_PAY_NOTIFY_URL'),
    privateKey: getWechatPayPrivateKey()
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
    dataType: 'json',
    headers: {
      Authorization: buildWechatPayAuthorization(method, url, bodyText, config),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  })
  if (res.status < 200 || res.status >= 300) {
    const message = res.data && (res.data.message || res.data.code) ? `${res.data.message || res.data.code}` : `微信退款请求失败(${res.status})`
    throw new Error(message)
  }
  return res.data || {}
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

function formatNotifyTime(value = Date.now()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildSubscriptionData(order = {}, scene = '', remark = '') {
  const sceneLabel = SUBSCRIPTION_SCENE_LABELS[scene] || '工单状态更新'
  return {
    thing1: { value: sceneLabel.slice(0, 20) },
    character_string2: { value: String(order.order_no || order._id || '').slice(0, 32) },
    phrase3: { value: sceneLabel.slice(0, 10) },
    time4: { value: formatNotifyTime() },
    thing5: { value: String(remark || sceneLabel).slice(0, 20) }
  }
}

async function logSubscriptionMessage(payload = {}) {
  await db.collection('cicada_subscription_logs').add({
    ...payload,
    create_time: Date.now()
  }).catch(() => {})
}

async function sendOrderSubscription(order = {}, scene = '', remark = '') {
  const templateId = getSubscriptionTemplateId(scene)
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
    await sendWechatSubscribeMessage({
      touser: user.openid,
      template_id: templateId,
      page: `pages/index/index?module=track&orderId=${encodeURIComponent(order.order_no || order._id || '')}`,
      data: buildSubscriptionData(order, scene, remark)
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

// SN 规范化键：大写、去除所有空格与横杠，用于容错检索匹配。
// 口径必须与 cicada-client-order / cicada-admin-customer 中的同名函数保持一致。
function normalizeSn(value) {
  return normalizeText(value).toUpperCase().replace(/[\s-]+/g, '')
}

const DEFAULT_WARRANTY_MONTHS = 12

// 将 YYYY-MM-DD 加 N 个月，返回 YYYY-MM-DD；无效输入返回空串（与 client-order 口径一致）
function addMonthsToDateStr(dateStr, months) {
  const s = normalizeText(dateStr)
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return ''
  d.setMonth(d.getMonth() + Number(months || 0))
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// 由设备/工单项推算质保到期日：优先 warranty_expire，否则 buy_date + warranty_months(默认12)
function deriveWarrantyExpire(source = {}) {
  const stored = normalizeText(source.warranty_expire)
  if (stored) return stored
  const months = Number(source.warranty_months) > 0 ? Number(source.warranty_months) : DEFAULT_WARRANTY_MONTHS
  return addMonthsToDateStr(source.buy_date, months)
}

// 重算工单级在保结论：逐个 SN 优先查已建档设备，否则用工单项购机日期推算。
// 返回 { in_warranty, warranty_status, charge_type }
async function computeOrderWarrantyFromItems(items = []) {
  let anyInWarranty = false
  let anyEvaluated = false
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
    const source = device || { buy_date: item && item.buy_date }
    const expire = deriveWarrantyExpire(source)
    if (!expire) continue
    anyEvaluated = true
    const expireTs = new Date(`${expire}T23:59:59`).getTime()
    if (!Number.isNaN(expireTs) && Date.now() <= expireTs) anyInWarranty = true
  }
  if (!anyEvaluated) return { in_warranty: false, warranty_status: 'unknown', charge_type: 'pending' }
  return {
    in_warranty: anyInWarranty,
    warranty_status: anyInWarranty ? 'in_warranty' : 'expired',
    charge_type: anyInWarranty ? 'free' : 'paid'
  }
}

function normalizeInvoiceStatusFilter(value = '') {
  const text = normalizeText(value)
  if (!text) return ''
  const map = {
    未发票: '待开票',
    已发票: '已开具'
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
  if (type === 'quote') return ['received', 'inspecting', 'fixing'].includes(status) && !['issued', 'confirmed'].includes(quoteStatus)
  if (type === 'payment') return totalPrice > 0 && paymentStatus === 'uploaded'
  if (type === 'invoice') return Boolean(invoiceInfo.need_invoice) && ['待开票', '开具中', '未发票'].includes(invoiceInfo.status || '待开票')
  if (type === 'return') return ['fixing', 'inspecting'].includes(status) && paymentStatus === 'paid'
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
    update_time: now
  }

  if (isInbound) {
    updateData.ship_out_info = buildShipOutImportInfo(order, item, eventTime)
  } else {
    updateData.ship_back_info = buildShipBackImportInfo(order, item, eventTime)
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
    .where({ order_no: orderNo })
    .limit(1)
    .get()
  if (orderNoRes.data && orderNoRes.data[0]) return orderNoRes.data[0]

  try {
    const idRes = await db.collection('cicada_orders').doc(orderNo).get()
    return idRes.data && idRes.data[0] ? idRes.data[0] : null
  } catch (e) {
    return null
  }
}

const INVOICE_STATUS = ['无需开票', '待开票', '开具中', '已开具']
const QUOTE_STATUS = ['pending', 'draft', 'issued', 'confirmed', 'rejected']
const PAYMENT_STATUS = ['pending', 'uploaded', 'paid']
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
      : normalizeText(part.compatibleModels || part.compatible_models).split(/[,，\n]/).map(normalizeText).filter(Boolean),
    purchase_cost: normalizeQuoteAmount(part.purchase_cost ?? part.purchaseCost),
    sale_price: normalizeQuoteAmount(part.sale_price ?? part.salePrice ?? part.unit_price ?? part.unitPrice),
    stock: Math.max(Number(part.stock ?? 0) || 0, 0),
    warning_threshold: Math.max(Number(part.warning_threshold ?? part.warningThreshold ?? 0) || 0, 0),
    enabled: part.enabled === undefined ? true : Boolean(part.enabled),
    remark: normalizeText(part.remark)
  }
}

// canViewCost：采购成本属敏感商业数据，仅 admin/finance 可见；engineer 等角色不下发成本字段
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
  return ['admin', 'finance'].includes(String(admin && admin.role || '').toLowerCase())
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

    await db.collection('cicada_orders').doc(order._id).update({
      inventory_deducted: true,
      inventory_deduct_time: now,
      inventory_status: 'outbound',
      update_time: now
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

function buildQuoteData(quote = {}, now) {
  const status = normalizeText(quote.status || quote.quote_status || quote.quoteStatus || 'draft') || 'draft'
  if (!QUOTE_STATUS.includes(status)) {
    throw new Error('报价状态不正确')
  }

  const legacyItems = normalizeQuoteItems(quote.items || quote.quote_items || quote.quoteItems)
  const quoteDetail = normalizeQuoteDetail(quote, legacyItems)
  const quoteItems = buildLegacyQuoteItemsFromDetail(quoteDetail, legacyItems)
  const partsFee = normalizeQuoteAmount(quoteDetail.parts_total)
  const laborFee = normalizeQuoteAmount(quoteDetail.services_total) + normalizeQuoteAmount(quoteDetail.others_total)
  const totalPrice = normalizeQuoteAmount(quoteDetail.final_price)
  const autoTotal = normalizeQuoteAmount(quoteDetail.auto_total)
  const quoteRemark = normalizeText(quoteDetail.remark || quote.remark || quote.quote_remark || quote.quoteRemark)

  if (quoteRemark.length > 200) {
    throw new Error('报价备注不能超过200字')
  }

  if ((status === 'draft' || status === 'issued') && (!quoteItems.length || totalPrice <= 0 || autoTotal <= 0)) {
    throw new Error('请填写有效报价项目和金额')
  }

  // 维修质保期（月），随报价发给客户，0 表示沿用全局质保政策
  const warrantyMonths = Math.max(0, parseInt(
    quote.quote_warranty_months ?? quote.warranty_months ?? quote.warrantyMonths ?? 0, 10
  ) || 0)

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

function isCloudFileId(value = '') {
  return String(value || '').startsWith('cloud://')
}

async function normalizePaymentProofs(proofs = []) {
  if (!Array.isArray(proofs) || !proofs.length) return []
  const cloudFileIds = [...new Set(proofs
    .map((proof = {}) => proof.fileID || proof.fileId || proof.url)
    .filter(isCloudFileId))]

  if (!cloudFileIds.length) return proofs

  try {
    const tempRes = await uniCloud.getTempFileURL({ fileList: cloudFileIds })
    const urlMap = (tempRes.fileList || []).reduce((map, item = {}) => {
      if (item.fileID && item.tempFileURL) map[item.fileID] = item.tempFileURL
      return map
    }, {})

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
      .match(matchCond)
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
    totalOrders: 0,
    totalFeedbacks: 0,
    pendingFeedbacks: 0
  }

  orders.forEach(order => {
    if (order.status !== 'cancelled') metrics.totalOrders += 1
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

  // 统一错误出口：_before/方法体抛出的异常（如鉴权失败）转成 { code: -1 } 正常返回，
  // 避免 URL 化下未捕获异常导致 HTTP 500（前端据 code 处理/跳登录）
  _after(error, result) {
    if (error) {
      return { code: -1, msg: (error && error.message) ? error.message : '请求失败' }
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
        todoType = '',
        slaLevel = '',
        responseMode = 'array'
      } = requestParams

      if (status && !ORDER_STATUS.includes(status)) return { code: -1, msg: '工单状态不正确' }

      const pagination = normalizePage(page, pageSize)
      const normalizedKeyword = normalizeText(keyword).toLowerCase()
      const normalizedDeviceModel = normalizeText(deviceModel)
      const normalizedInvoiceStatus = normalizeInvoiceStatusFilter(invoiceStatus)
      const normalizedWarrantyStatus = normalizeText(warrantyStatus)
      const normalizedSlaLevel = normalizeText(slaLevel)
      const directMatchCond = buildDirectAdminOrderMatchCond({ status, todoType })
      const canUseDirectQuery = directMatchCond && !normalizedKeyword && !normalizedDeviceModel && !normalizedInvoiceStatus && !normalizedWarrantyStatus && !normalizedSlaLevel

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
          const searchableText = [
            order.order_no,
            order._id,
            order.user_id,
            order.product_name,
            order.product_model,
            order.fault_desc,
            order.ship_back_info && order.ship_back_info.name,
            order.ship_back_info && order.ship_back_info.phone,
            order.ship_back_info && order.ship_back_info.unit,
            order.ship_out_info && order.ship_out_info.logistics_no,
            order.ship_back_info && order.ship_back_info.logistics_no,
            ...productModels,
            ...productSns
          ].filter(Boolean).join(' ').toLowerCase()

          return matchesTodoType(order, todoType) &&
            (!normalizedKeyword || searchableText.includes(normalizedKeyword)) &&
            (!normalizedDeviceModel || productModels.includes(normalizedDeviceModel)) &&
            (!normalizedInvoiceStatus || orderInvoiceStatus === normalizedInvoiceStatus) &&
            (!normalizedWarrantyStatus || normalizeText(order.warranty_status) === normalizedWarrantyStatus) &&
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
        .match({ _id: order_id })
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
      const itemDetail = (order.itemsList && order.itemsList.length > 0) ? order.itemsList[0] : {}

      const orderWithProofs = await enrichPaymentProofs(order)
      const orderData = stripPaymentProofsIfForbidden({
        ...orderWithProofs,
        product_name: itemDetail.product_name || '',
        product_model: itemDetail.product_model || '',
        fault_desc: itemDetail.fault_desc || '',
        media_urls: itemDetail.media_urls || [],
        sn: itemDetail.sn || '',
        buy_date: itemDetail.buy_date || '',
        fix_solution: itemDetail.fix_solution || '',
        itemsList: order.itemsList || []
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
      const res = await db.collection('cicada_orders').doc(order_id).update({
        status,
        update_time: Date.now()
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
        // 工单完成后追加服务评价邀请（模板未配置时自动跳过）
        if (status === 'completed') {
          await sendOrderSubscription({ ...order, status }, 'review_invite', '邀请您对本次维修评价')
        }
      }
      return { code: 0 }
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

      const summary = {
        type: importType,
        typeLabel: importType === 'inbound' ? '客户寄入签收' : '后台回寄发货',
        targetStatus: importType === 'inbound' ? '已签收' : '已回寄',
        total: normalizedList.length,
        success: 0,
        fail: 0,
        errors: []
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

        const updateData = buildLogisticsImportUpdate(order, item, importType, now, importDate)
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
          .where({ order_no: item.order_no })
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

        const shipBackInfo = buildShipBackInfo(order, item, now)
        const timeline = Array.isArray(order.timeline) ? order.timeline : []
        const timelineText = `${item.logistics_company || '物流'} ${item.logistics_no}`
        const updateData = {
          ship_back_info: shipBackInfo,
          status: 'shipped',
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
        results.push({
          ...item,
          order_id: order._id,
          success: true,
          reason: '已更新'
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

      const summary = {
        total: normalizedList.length,
        success: 0,
        fail: 0,
        errors: []
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

        const timeline = Array.isArray(order.timeline) ? order.timeline : []
        const updateData = {
          status: 'shipped',
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

      // 逐条更新工单项（仅限本工单下的项，按 _id 精确更新）
      for (const item of items) {
        const itemId = normalizeText(item && item._id)
        const owned = itemId && ownedById.get(itemId)
        if (!owned) continue // 跳过不属于本工单的项
        const sn = normalizeText(item.sn)
        const patch = {
          product_category: normalizeText(item.product_category),
          product_model: normalizeText(item.product_model),
          sn,
          sn_normalized: normalizeSn(sn),
          buy_date: normalizeText(item.buy_date)
        }
        await db.collection('cicada_order_items').doc(itemId).update(patch).catch(() => {})
        Object.assign(owned, patch) // 同步内存副本，供下方在保重算
      }

      // 用更新后的本工单产品项重算在保结论
      const warranty = await computeOrderWarrantyFromItems(ownedItems)

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
      const oldInvoice = order.invoice_info || {}
      // 电子发票链接/号码/日期：财务开具后回填，客户端「已开票」据此复制下载（兼容 file_url 旧字段）
      const nextInvoiceUrl = normalizeText(invoice.invoice_url || invoice.file_url || invoice.fileUrl || invoice.url) || oldInvoice.invoice_url || oldInvoice.file_url || ''
      const invoiceInfo = {
        ...oldInvoice,
        need_invoice: nextStatus !== '无需开票',
        status: nextStatus,
        title: normalizeText(invoice.title) || oldInvoice.title || '',
        tax_no: normalizeText(invoice.tax_no || invoice.taxNo) || oldInvoice.tax_no || '',
        remark: normalizeText(invoice.remark) || oldInvoice.remark || '',
        invoice_url: nextInvoiceUrl,
        invoice_no: normalizeText(invoice.invoice_no || invoice.invoiceNo) || oldInvoice.invoice_no || '',
        invoice_date: normalizeText(invoice.invoice_date || invoice.invoiceDate) || oldInvoice.invoice_date || '',
        update_time: now
      }
      if (nextStatus === '已开具') invoiceInfo.issued_time = oldInvoice.issued_time || now

      const updateData = { invoice_info: invoiceInfo, update_time: now }
      // 首次置为「已开具」时补一条时间线，客户端进度可见
      if (nextStatus === '已开具' && oldInvoice.status !== '已开具') {
        const timeline = Array.isArray(order.timeline) ? order.timeline : []
        updateData.timeline = [
          ...timeline,
          {
            title: '电子发票已开具',
            desc: nextInvoiceUrl ? '可在「发票与开票」复制链接查看并下载' : `发票抬头：${invoiceInfo.title || '-'}`,
            time: now,
            done: true
          }
        ]
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

      const quoteData = buildQuoteData(quote, now)
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const updateData = {
        ...quoteData
      }

      if (quoteData.quote_status === 'issued' && !order.payment_status) {
        updateData.payment_status = 'pending'
      }

      if (quoteData.quote_status === 'issued') {
        // 付款截止时间：优先用后台传入的绝对时间，其次按天数，否则默认 7 天
        const days = Math.max(1, parseInt(quote.payment_deadline_days ?? quote.paymentDeadlineDays ?? DEFAULT_PAYMENT_DEADLINE_DAYS, 10) || DEFAULT_PAYMENT_DEADLINE_DAYS)
        const absoluteDeadline = parseInt(quote.payment_deadline ?? quote.paymentDeadline ?? 0, 10) || 0
        updateData.payment_deadline = absoluteDeadline > now ? absoluteDeadline : (now + days * 24 * 3600 * 1000)
        updateData.timeline = [
          ...timeline,
          {
            title: '维修报价已发布',
            desc: `报价合计 ${quoteData.total_price.toFixed(2)} 元，等待客户确认。`,
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
      const { order_id, status } = pickParam(this, params)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      const paymentStatus = normalizeText(status || 'paid')
      if (!PAYMENT_STATUS.includes(paymentStatus)) return { code: -1, msg: '付款状态不正确' }

      const now = Date.now()
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }

      let inventoryResult = null
      if (paymentStatus === 'paid' && order.payment_status !== 'paid') {
        inventoryResult = await outboundOrderInventory(order, currentAdmin, now)
      }

      const updateData = {
        payment_status: paymentStatus,
        payment_update_time: now,
        update_time: now
      }

      if (paymentStatus === 'paid') {
        updateData.payment_paid_time = now
      }

      if (paymentStatus === 'paid' && order.payment_status !== 'paid') {
        const timeline = Array.isArray(order.timeline) ? order.timeline : []
        updateData.timeline = [
          ...timeline,
          {
            title: '付款已核销',
            desc: '后台已确认客户付款到账。',
            time: now,
            done: true
          }
        ]
      }

      const res = await db.collection('cicada_orders').doc(order_id).update(updateData)
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      await logOrderEvent({
        order,
        action: 'confirm_payment',
        actor: currentAdmin,
        before: { payment_status: order.payment_status || 'pending' },
        after: { payment_status: paymentStatus }
      })

      if (paymentStatus === 'paid' && order.payment_status !== 'paid') {
        await sendOrderSubscription({ ...order, ...updateData }, 'payment_confirmed', '付款已确认')
      }
      // 库存未自动扣减的告警（报价含配件但未绑定库存）随响应返回，供前端提示运营核对
      const msg = inventoryResult && inventoryResult.warning ? inventoryResult.reason : ''
      return { code: 0, msg, data: { ...updateData, inventoryResult } }
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

  async getSettlementList(params) {
    try {
      const currentAdmin = requireAdminPermission(this, 'view_settlement')
      const { paymentStatus = '', keyword = '', page = 1, pageSize = 20 } = pickParam(this, params)
      const pagination = normalizePage(page, pageSize)
      const normalizedKeyword = normalizeText(keyword).toLowerCase()
      const matchCond = {
        total_price: dbCmd.gt(0),
        quote_status: dbCmd.in(['issued', 'confirmed', 'rejected'])
      }
      if (paymentStatus) matchCond.payment_status = paymentStatus
      const fallback = await fetchOrderBatches(matchCond, { maxRows: ADMIN_ORDER_FILTER_SCAN_LIMIT, returnMeta: true })
      const enriched = await Promise.all((fallback.orders || []).map(async order => stripPaymentProofsIfForbidden(await enrichPaymentProofs(order), currentAdmin)))
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
        payment_status: order.payment_status || 'pending',
        payment_proofs: order.payment_proofs || [],
        total_price: Number(order.total_price || 0),
        parts_fee: Number(order.parts_fee || 0),
        labor_fee: Number(order.labor_fee || 0),
        invoice_info: order.invoice_info || {},
        inventory_deducted: Boolean(order.inventory_deducted),
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
        .where({ status: 'completed', update_time: dbCmd.gte(monthStart).and(dbCmd.lt(monthEnd)) })
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
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime()

      const [pendingRes, todayRes] = await Promise.all([
        db.collection('cicada_orders').where({
          status: dbCmd.in(['pending', 'sent', 'received'])
        }).count(),
        db.collection('cicada_orders').where({ create_time: dbCmd.gte(todayStart) }).count()
      ])

      return {
        code: 0,
        data: {
          pendingCount: pendingRes.total,
          todayCount: todayRes.total
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
        { key: 'return', title: '待回寄', desc: '已付款但尚未回寄', count: 0 },
        { key: 'exception', title: '异常工单', desc: '需要人工介入处理', count: 0 }
      ]

      const counts = await Promise.all(groups.map(group => countOrdersByMatch(getTodoCountMatchCond(group.key), group.key)))
      groups.forEach((group, index) => { group.count = counts[index] || 0 })

      return { code: 0, data: { groups } }
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
          totalFeedbacks: metrics.totalFeedbacks,
          pendingFeedbacks: metrics.pendingFeedbacks
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
