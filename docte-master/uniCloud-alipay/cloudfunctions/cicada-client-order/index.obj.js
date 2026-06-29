const db = uniCloud.database()
const crypto = require('crypto')
const { assertOrderStatusTransition } = loadWorkflowModule()

function loadWorkflowModule() {
  try {
    return require('cicada-order-workflow')
  } catch (packageError) {
    return require('../common/cicada-order-workflow')
  }
}

const CREATE_ORDER_LIMIT = { windowMs: 60 * 1000, max: 8 }
const WECHAT_PAY_API_BASE = 'https://api.mch.weixin.qq.com'
const SUBSCRIPTION_SCENE_LABELS = {
  repair_submitted: '报修已提交',
  payment_confirmed: '付款已确认',
  order_completed: '工单已完成',
  review_invite: '邀请服务评价'
}
let wechatAccessTokenCache = { token: '', expireAt: 0 }

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return String(value)
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

function buildSubscriptionData(order = {}, scene = '', remark = '') {
  const sceneLabel = SUBSCRIPTION_SCENE_LABELS[scene] || '工单状态更新'
  return {
    thing1: { value: sceneLabel.slice(0, 20) },
    character_string2: { value: String(order.order_no || order._id || '').slice(0, 32) },
    phrase3: { value: sceneLabel.slice(0, 10) },
    time4: { value: formatTimelineTime(Date.now()) },
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

function getActorInfo(user = {}) {
  return {
    actor_id: user._id || user.user_id || '',
    actor_role: user.role || 'user',
    actor_name: user.nickname || user.name || user.username || user.mobile || user.phone || ''
  }
}

async function logOrderEvent({
  order = {},
  source = 'client',
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

function normalizePrivateKey(value = '') {
  return normalizeText(value).replace(/\\n/g, '\n')
}

function getWechatPayPrivateKey() {
  const base64Key = getEnvValue('WX_PAY_PRIVATE_KEY_BASE64', 'WXPAY_PRIVATE_KEY_BASE64', 'WECHAT_PAY_PRIVATE_KEY_BASE64')
  if (base64Key) {
    return Buffer.from(base64Key, 'base64').toString('utf8')
  }
  return normalizePrivateKey(getEnvValue('WX_PAY_PRIVATE_KEY', 'WXPAY_PRIVATE_KEY', 'WECHAT_PAY_PRIVATE_KEY'))
}

function getWechatPayApiV3Key() {
  return getEnvValue('WX_PAY_API_V3_KEY', 'WXPAY_API_V3_KEY', 'WECHAT_PAY_API_V3_KEY')
}

function getWechatPayConfig() {
  const config = {
    appId: getEnvValue('WX_PAY_APPID', 'WXPAY_APPID', 'WECHAT_PAY_APPID', 'WX_APPID'),
    mchId: getEnvValue('WX_PAY_MCH_ID', 'WXPAY_MCH_ID', 'WECHAT_PAY_MCH_ID'),
    serialNo: getEnvValue('WX_PAY_SERIAL_NO', 'WXPAY_SERIAL_NO', 'WECHAT_PAY_SERIAL_NO'),
    notifyUrl: getEnvValue('WX_PAY_NOTIFY_URL', 'WXPAY_NOTIFY_URL', 'WECHAT_PAY_NOTIFY_URL'),
    privateKey: getWechatPayPrivateKey()
  }
  const missing = []
  if (!config.appId) missing.push('WX_PAY_APPID 或 WX_APPID')
  if (!config.mchId) missing.push('WX_PAY_MCH_ID')
  if (!config.serialNo) missing.push('WX_PAY_SERIAL_NO')
  if (!config.notifyUrl) missing.push('WX_PAY_NOTIFY_URL')
  if (!config.privateKey) missing.push('WX_PAY_PRIVATE_KEY 或 WX_PAY_PRIVATE_KEY_BASE64')
  if (missing.length) {
    throw new Error(`微信支付暂未配置：${missing.join('、')}`)
  }
  return config
}

async function verifyUserToken(token) {
  if (!token) throw new Error('鉴权失败')
  const res = await db.collection('cicada_users').where({ token }).limit(1).get()
  const user = res.data[0]
  if (!user || user.disabled) throw new Error('鉴权失败')
  if (!user.token_expire || Date.now() > user.token_expire) throw new Error('Token已过期')
  return user
}

function pickFields(source = {}, fields = []) {
  return fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field]
    }
    return result
  }, {})
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizePage(page, pageSize) {
  const current = Math.max(Number(page) || 1, 1)
  const size = Math.min(Math.max(Number(pageSize) || 10, 1), 50)
  return { page: current, pageSize: size }
}

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim()
}

function normalizePhoneLast4(value) {
  return normalizeText(value).replace(/\D/g, '').slice(-4)
}

// SN 规范化键：大写、去除所有空格与横杠，用于容错检索匹配。
// 口径必须与 cicada-admin-customer / cicada-admin-order 中的同名函数保持一致。
function normalizeSn(value) {
  return normalizeText(value).toUpperCase().replace(/[\s-]+/g, '')
}

// 默认整机质保月数：当设备无显式 warranty_expire/warranty_months 时，用购机日期推算到期日
const DEFAULT_WARRANTY_MONTHS = 12

// 将 YYYY-MM-DD 加上 N 个月，返回 YYYY-MM-DD；无效输入返回空串
function addMonthsToDateStr(dateStr, months) {
  const s = normalizeText(dateStr)
  const m = Number(months)
  if (!s || !Number.isFinite(m) || m <= 0) return ''
  const d = new Date(`${s}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setMonth(d.getMonth() + m)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

// 推算质保到期日：优先已存 warranty_expire；否则由 buy_date + warranty_months(默认12) 推算
function deriveWarrantyExpire(device = {}) {
  const stored = normalizeText(device.warranty_expire)
  if (stored) return stored
  const months = Number(device.warranty_months) > 0 ? Number(device.warranty_months) : DEFAULT_WARRANTY_MONTHS
  return addMonthsToDateStr(device.buy_date || device.buyDate, months)
}

// 计算在保状态，返回 { inWarranty, warrantyStatus }
function computeWarrantyStatus(expireStr, extWarranty) {
  let inWarranty = false
  let warrantyStatus = 'unknown'
  const expire = normalizeText(expireStr)
  if (expire) {
    const expireTs = new Date(`${expire}T23:59:59`).getTime()
    if (!Number.isNaN(expireTs)) {
      inWarranty = Date.now() <= expireTs
      warrantyStatus = inWarranty
        ? (Array.isArray(extWarranty) && extWarranty.length ? 'extended' : 'in_warranty')
        : 'expired'
    }
  }
  return { inWarranty, warrantyStatus }
}

function formatTimelineTime(value) {
  if (!value) return ''
  if (typeof value === 'number') {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return String(value)
}

function normalizeOrderTimeline(timeline = []) {
  if (!Array.isArray(timeline)) return []
  return timeline.map(item => ({
    title: item.title || item.statusText || '包裹状态更新',
    desc: item.desc || item.description || item.content || '',
    time: formatTimelineTime(item.time || item.createTime || item.updateTime),
    pending: Boolean(item.pending)
  }))
}

function normalizeQuoteItems(items = []) {
  if (!Array.isArray(items)) return []
  return items.map((item = {}) => ({
    name: item.name || item.title || item.projectName || '维修费用',
    desc: item.desc || item.description || item.remark || '',
    partsFee: Number(item.partsFee ?? item.parts_fee ?? item.partFee ?? item.part_fee ?? item.materialFee ?? item.material_fee ?? 0) || 0,
    laborFee: Number(item.laborFee ?? item.labor_fee ?? item.workFee ?? item.work_fee ?? item.serviceFee ?? item.service_fee ?? 0) || 0
  })).filter(item => item.name || item.desc || item.partsFee > 0 || item.laborFee > 0)
}

function normalizeQuoteDetail(detail = null) {
  if (!detail || typeof detail !== 'object') return null
  return {
    parts: Array.isArray(detail.parts) ? detail.parts : [],
    services: Array.isArray(detail.services) ? detail.services : [],
    others: Array.isArray(detail.others) ? detail.others : [],
    partsTotal: Number(detail.parts_total ?? detail.partsTotal ?? 0) || 0,
    servicesTotal: Number(detail.services_total ?? detail.servicesTotal ?? 0) || 0,
    othersTotal: Number(detail.others_total ?? detail.othersTotal ?? 0) || 0,
    autoTotal: Number(detail.auto_total ?? detail.autoTotal ?? 0) || 0,
    finalPrice: Number(detail.final_price ?? detail.finalPrice ?? 0) || 0,
    remark: detail.remark || ''
  }
}

function exposeQuoteFields(order = {}) {
  const quoteStatus = order.quote_status || order.quoteStatus || 'pending'
  const visible = ['issued', 'confirmed', 'rejected'].includes(quoteStatus)
  if (!visible) {
    return {
      quoteDetail: null,
      quoteItems: [],
      quoteStatus: 'pending',
      partsFee: 0,
      laborFee: 0,
      totalFee: 0,
      totalPrice: 0,
      paymentProofs: [],
      paymentStatus: 'pending',
      paymentDeadline: 0,
      payment_deadline: 0,
      quoteWarrantyMonths: 0,
      quote_warranty_months: 0,
      authorizationStatus: '',
      authorizationTime: ''
    }
  }

  const quoteItems = normalizeQuoteItems(order.quote_items || order.quoteItems)
  const quoteDetail = normalizeQuoteDetail(order.quote_detail || order.quoteDetail)
  const partsFee = Number(order.parts_fee ?? order.partsFee ?? quoteItems.reduce((sum, item) => sum + item.partsFee, 0)) || 0
  const laborFee = Number(order.labor_fee ?? order.laborFee ?? quoteItems.reduce((sum, item) => sum + item.laborFee, 0)) || 0
  const totalFee = Number(order.total_price ?? order.totalPrice ?? partsFee + laborFee) || 0

  return {
    quoteDetail,
    quote_detail: quoteDetail,
    quoteItems,
    quote_items: quoteItems,
    quoteStatus,
    quote_status: quoteStatus,
    quoteRemark: order.quote_remark || order.quoteRemark || '',
    partsFee,
    parts_fee: partsFee,
    laborFee,
    labor_fee: laborFee,
    totalFee,
    total_price: totalFee,
    totalPrice: totalFee,
    paymentStatus: order.payment_status || order.paymentStatus || 'pending',
    payment_status: order.payment_status || order.paymentStatus || 'pending',
    paymentDeadline: Number(order.payment_deadline ?? order.paymentDeadline ?? 0) || 0,
    payment_deadline: Number(order.payment_deadline ?? order.paymentDeadline ?? 0) || 0,
    quoteWarrantyMonths: Number(order.quote_warranty_months ?? order.quoteWarrantyMonths ?? 0) || 0,
    quote_warranty_months: Number(order.quote_warranty_months ?? order.quoteWarrantyMonths ?? 0) || 0,
    paymentProofs: Array.isArray(order.payment_proofs) ? order.payment_proofs : (order.paymentProofs || []),
    payment_proofs: Array.isArray(order.payment_proofs) ? order.payment_proofs : (order.paymentProofs || []),
    authorizationStatus: order.authorization_status || order.authorizationStatus || '',
    authorization_status: order.authorization_status || order.authorizationStatus || '',
    authorizationTime: order.authorization_time || order.authorizationTime || '',
    authorization_time: order.authorization_time || order.authorizationTime || ''
  }
}

async function findOwnedOrder(userId, orderId) {
  if (!orderId) return null
  const idRes = await db.collection('cicada_orders')
    .where({ _id: orderId, user_id: userId })
    .limit(1)
    .get()
  if (idRes.data && idRes.data[0]) return idRes.data[0]

  const noRes = await db.collection('cicada_orders')
    .where({ order_no: orderId, user_id: userId })
    .limit(1)
    .get()
  return noRes.data && noRes.data[0] ? noRes.data[0] : null
}

async function findOrderByWechatOutTradeNo(outTradeNo) {
  const normalized = normalizeOutTradeNo(outTradeNo)
  if (!normalized) return null
  const res = await db.collection('cicada_orders')
    .where({ wechat_pay_out_trade_no: normalized })
    .limit(1)
    .get()
  return res.data && res.data[0] ? res.data[0] : null
}

function getShipInfo(order = {}, type = 'out') {
  const info = type === 'back' ? (order.ship_back_info || {}) : (order.ship_out_info || {})
  return {
    company: info.logistics_company || info.logisticsCompany || info.returnCompany || info.return_company || '',
    trackingNo: info.logistics_no || info.logisticsNo || info.returnNo || info.return_no || '',
    shippedAt: info.shipped_at || info.shippedAt || order.create_time || ''
  }
}

function getPackageStatus(order = {}) {
  const status = order.status || 'pending'
  if (status === 'completed') return { status: 5, statusText: '已完成', tone: 'ok', reached: 4 }
  if (status === 'shipped') return { status: 4, statusText: '已关联工单', tone: 'ok', reached: 4 }
  if (['inspecting', 'fixing'].includes(status)) return { status: 3, statusText: '处理中', tone: 'warn', reached: 3 }
  if (status === 'received') return { status: 2, statusText: '已登记待检测', tone: 'warn', reached: 2 }
  return { status: 1, statusText: '已提交待签收', tone: 'warn', reached: 1 }
}

function buildPackageTimeline(order = {}, matchedType = 'out', fullAccess = false) {
  const shipInfo = getShipInfo(order, matchedType)
  const rows = [
    {
      title: matchedType === 'back' ? '回寄发货' : '客户寄出',
      desc: `${shipInfo.company || '物流'} ${shipInfo.trackingNo}`.trim(),
      time: formatTimelineTime(shipInfo.shippedAt),
      pending: false
    }
  ]

  if (order.status && order.status !== 'pending') {
    rows.push({
      title: '售后已登记',
      desc: `已关联工单 ${order.order_no || order._id || ''}`.trim(),
      time: formatTimelineTime(order.update_time || order.create_time),
      pending: false
    })
  }

  if (fullAccess) {
    rows.push(...normalizeOrderTimeline(order.timeline))
  } else {
    rows.push({
      title: '隐私保护',
      desc: '填写收件人手机号后四位后，可查看完整处理记录。',
      time: '',
      pending: true
    })
  }

  return rows
}

// 单段物流（寄出 out / 回寄 back）：公司+单号+进度(0揽收/1运输/2签收)+时间轴
function buildPackageSegment(order = {}, type = 'out', fullAccess = false) {
  const info = getShipInfo(order, type)
  const status = order.status || 'pending'
  let reached = 0
  let statusText = ''
  let tone = 'muted'
  let available = Boolean(info.trackingNo)
  if (type === 'out') {
    if (['received', 'inspecting', 'fixing', 'shipped', 'completed'].includes(status)) { reached = 2; statusText = '厂家已签收'; tone = 'ok'; available = true }
    else if (status === 'sent') { reached = 1; statusText = '运输中'; tone = 'warn'; available = true }
    else if (info.trackingNo) { reached = 1; statusText = '运输中'; tone = 'warn'; available = true }
    else { reached = 0; statusText = '待寄出'; tone = 'muted'; available = false }
  } else {
    if (status === 'completed') { reached = 2; statusText = '客户已签收'; tone = 'ok'; available = true }
    else if (status === 'shipped') { reached = 1; statusText = '运输中'; tone = 'warn'; available = true }
    else { reached = 0; statusText = '待回寄'; tone = 'muted'; available = Boolean(info.trackingNo) }
  }
  return {
    type,
    company: info.company,
    trackingNo: info.trackingNo,
    status: statusText,
    tone,
    reached,
    available,
    timeline: available ? buildPackageTimeline(order, type, fullAccess) : []
  }
}

async function findOrderByTrackingNo(trackingNo) {
  const checks = [
    { field: 'ship_out_info.logistics_no', type: 'out' },
    { field: 'ship_out_info.logisticsNo', type: 'out' },
    { field: 'ship_back_info.logistics_no', type: 'back' },
    { field: 'ship_back_info.logisticsNo', type: 'back' },
    { field: 'ship_back_info.return_no', type: 'back' },
    { field: 'ship_back_info.returnNo', type: 'back' }
  ]

  for (const item of checks) {
    const res = await db.collection('cicada_orders')
      .where({ [item.field]: trackingNo })
      .limit(1)
      .get()
    if (res.data && res.data[0]) {
      return { order: res.data[0], matchedType: item.type }
    }
  }

  return null
}

function genOrderNo() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const datePart = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return 'DR' + datePart + crypto.randomBytes(4).toString('hex').toUpperCase()
}

async function checkRateLimit(scope, identity, config) {
  if (!identity || !config) return

  const now = Date.now()
  const key = `${scope}:${identity}`
  const col = db.collection('cicada_rate_limits')
  const found = await col.where({ key }).limit(1).get()
  const record = found.data[0]

  if (!record || now > record.reset_time) {
    if (record) {
      await col.doc(record._id).update({
        count: 1,
        reset_time: now + config.windowMs,
        update_time: now
      })
    } else {
      await col.add({
        key,
        scope,
        identity,
        count: 1,
        reset_time: now + config.windowMs,
        create_time: now,
        update_time: now
      })
    }
    return
  }

  if (record.count >= config.max) {
    throw new Error('操作过于频繁，请稍后再试')
  }

  await col.doc(record._id).update({
    count: db.command.inc(1),
    update_time: now
  })
}

function randomNonce(size = 16) {
  return crypto.randomBytes(size).toString('hex')
}

function signWechatPayMessage(message, privateKey) {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(message)
  signer.end()
  return signer.sign(privateKey, 'base64')
}

function buildWechatPayAuthorization(method, url, body = '', config) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const nonce = randomNonce()
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = signWechatPayMessage(message, config.privateKey)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.serialNo}"`
}

function buildRequestPaymentParams(prepayId, config) {
  const timeStamp = String(Math.floor(Date.now() / 1000))
  const nonceStr = randomNonce()
  const packageValue = `prepay_id=${prepayId}`
  const paySign = signWechatPayMessage(`${config.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`, config.privateKey)
  return {
    provider: 'wxpay',
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: 'RSA',
    paySign
  }
}

function normalizeOutTradeNo(value = '') {
  return normalizeText(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
}

function genOutTradeNo(order = {}) {
  const base = normalizeOutTradeNo(order.order_no || order._id || `DR${Date.now()}`)
  const suffix = randomNonce(3).toUpperCase()
  return `${base.slice(0, Math.max(1, 31 - suffix.length))}P${suffix}`
}

function getOrderPayAmountFen(order = {}) {
  return Math.round((Number(order.total_price || order.totalPrice || 0) || 0) * 100)
}

async function requestWechatPay(method, url, body = null, config = getWechatPayConfig()) {
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
    const message = res.data && (res.data.message || res.data.code)
      ? `${res.data.message || res.data.code}`
      : `微信支付请求失败(${res.status})`
    throw new Error(message)
  }

  return { data: res.data || {}, config }
}

async function queryWechatPayTransaction(outTradeNo, config = getWechatPayConfig()) {
  const normalized = normalizeOutTradeNo(outTradeNo)
  if (!normalized) throw new Error('缺少微信支付商户订单号')
  const url = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(normalized)}?mchid=${encodeURIComponent(config.mchId)}`
  const { data } = await requestWechatPay('GET', url, null, config)
  return data
}

function decryptWechatPayResource(resource = {}) {
  if (!resource || resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error('微信支付通知加密算法不支持')
  }
  const apiV3Key = getWechatPayApiV3Key()
  if (!apiV3Key) throw new Error('微信支付暂未配置：WX_PAY_API_V3_KEY')
  const key = Buffer.from(apiV3Key, 'utf8')
  if (key.length !== 32) throw new Error('微信支付 APIv3 密钥长度必须为32字节')

  const ciphertext = Buffer.from(normalizeText(resource.ciphertext), 'base64')
  const authTag = ciphertext.slice(ciphertext.length - 16)
  const encrypted = ciphertext.slice(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(normalizeText(resource.nonce), 'utf8'))
  const associatedData = normalizeText(resource.associated_data)
  if (associatedData) decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  return JSON.parse(decrypted)
}

function parseHttpBody(ctx) {
  const httpInfo = ctx && ctx.getHttpInfo && ctx.getHttpInfo()
  if (!httpInfo || !httpInfo.body) return null
  if (typeof httpInfo.body === 'object') return httpInfo.body
  return JSON.parse(httpInfo.body)
}

async function confirmWechatPaySuccess(outTradeNo, order = null) {
  const normalized = normalizeOutTradeNo(outTradeNo)
  if (!normalized) throw new Error('缺少微信支付商户订单号')
  const currentOrder = order || await findOrderByWechatOutTradeNo(normalized)
  if (!currentOrder) throw new Error('微信支付对应工单不存在')
  if (currentOrder.wechat_pay_out_trade_no && normalized !== currentOrder.wechat_pay_out_trade_no) {
    throw new Error('商户订单号与工单不匹配')
  }

  const config = getWechatPayConfig()
  const transaction = await queryWechatPayTransaction(normalized, config)
  if (transaction.trade_state !== 'SUCCESS') {
    throw new Error(transaction.trade_state_desc || '微信支付尚未完成')
  }
  const paidAmount = Number(transaction.amount && transaction.amount.total) || 0
  const expectedAmount = Number(currentOrder.wechat_pay_amount || getOrderPayAmountFen(currentOrder)) || 0
  if (!paidAmount || paidAmount !== expectedAmount) {
    throw new Error('微信支付金额与工单报价不一致，请联系售后核对')
  }

  if (currentOrder.payment_status === 'paid') {
    return { ...currentOrder, ...exposeQuoteFields(currentOrder), status: currentOrder.status || 'fixing' }
  }
  const updateData = await markOrderWechatPaid(currentOrder, transaction)
  return { ...updateData, ...exposeQuoteFields({ ...currentOrder, ...updateData }) }
}

function getPaymentTitle(order = {}) {
  const orderNo = order.order_no || order._id || ''
  return `维修费用-${orderNo}`.slice(0, 127)
}

function buildPaidTimeline(order = {}, now = Date.now(), amountFen = 0) {
  const timeline = Array.isArray(order.timeline) ? order.timeline : []
  return [
    ...timeline,
    {
      title: '微信支付已完成',
      desc: `客户已通过微信支付 ${((Number(amountFen) || 0) / 100).toFixed(2)} 元，系统已自动确认到账。`,
      time: now,
      done: true
    }
  ]
}

function assertOrderPayable(order = {}) {
  if (order.status === 'cancelled') throw new Error('已取消工单不可付款')
  if (order.status === 'completed') throw new Error('已完成工单不可付款')
  return true
}

async function markOrderWechatPaid(order = {}, transaction = {}) {
  assertOrderPayable(order)
  const now = Date.now()
  const amountFen = Number(transaction.amount && transaction.amount.total) || getOrderPayAmountFen(order)
  const updateData = {
    payment_status: 'paid',
    payment_method: 'wechat_pay',
    payment_paid_time: now,
    payment_update_time: now,
    wechat_pay_transaction_id: transaction.transaction_id || order.wechat_pay_transaction_id || '',
    wechat_pay_trade_state: transaction.trade_state || 'SUCCESS',
    wechat_pay_success_time: transaction.success_time || '',
    update_time: now,
    timeline: buildPaidTimeline(order, now, amountFen)
  }

  if (!['shipped', 'completed', 'cancelled'].includes(order.status)) {
    assertOrderStatusTransition(order.status, 'fixing')
    updateData.status = 'fixing'
  }

  await db.collection('cicada_orders').doc(order._id).update(updateData)
  await logOrderEvent({
    order,
    source: 'wechat_pay',
    action: 'wechat_pay_confirmed',
    actor: { _id: order.user_id || '', role: 'user' },
    before: {
      status: order.status || '',
      payment_status: order.payment_status || 'pending'
    },
    after: {
      status: updateData.status || order.status || '',
      payment_status: updateData.payment_status,
      payment_method: updateData.payment_method,
      amount_fen: amountFen
    }
  })
  await sendOrderSubscription({ ...order, ...updateData }, 'payment_confirmed', '微信支付已完成')
  return updateData
}

// 身份桥：按 (user_id / openid / 手机号) 匹配或自动创建 CRM 客户档案，返回 customer_id。
// 让小程序下单的用户与后台 cicada_customers 客户档案自动打通；失败不阻断下单，整体兜底。
async function ensureCustomerForUser(user = {}) {
  const userId = user._id
  if (!userId) return ''
  const customerCol = db.collection('cicada_customers')
  const phone = normalizeText(user.phone)
  const openid = normalizeText(user.openid)
  const now = Date.now()

  // 1) 已关联：user_id / openid 命中，直接复用
  const primaryOr = [{ user_id: userId }]
  if (openid) primaryOr.push({ openid })
  const primary = await customerCol.where(db.command.or(primaryOr)).limit(1).get()
  if (primary.data && primary.data[0]) return primary.data[0]._id

  // 2) 线下导入客户回填：手机号命中且尚未绑定小程序账号
  if (phone) {
    const byPhone = await customerCol.where({ phone }).limit(1).get()
    const matched = byPhone.data && byPhone.data[0]
    if (matched && !normalizeText(matched.user_id)) {
      await customerCol.doc(matched._id).update({
        user_id: userId,
        openid: openid || matched.openid || '',
        nickname: matched.nickname || normalizeText(user.nickname),
        update_time: now
      })
      return matched._id
    }
  }

  // 3) 自动建档（与后台 syncCustomersFromUsers 同构）
  const addRes = await customerCol.add({
    name: normalizeText(user.name || user.nickname || phone || '微信客户'),
    contact: normalizeText(user.name || user.nickname),
    phone,
    customer_type: 'clinic',
    source: 'miniapp',
    address: '',
    tags: [],
    user_id: userId,
    openid,
    nickname: normalizeText(user.nickname),
    avatar: normalizeText(user.avatar),
    status: 'active',
    create_time: now,
    update_time: now
  })
  return addRes.id || ''
}

// 设备档案沉淀：报修提交 / 维修完成时，按 (user_id, sn) 新增或更新设备档案。
// 设备沉淀失败不应阻断主流程，整体 try/catch 兜底。
async function upsertUserDevicesFromItems(user = {}, items = [], orderMeta = {}) {
  const userId = user._id
  if (!userId || !Array.isArray(items) || !items.length) return
  const now = Date.now()
  const customerId = normalizeText(orderMeta.customer_id)
  for (const item of items) {
    const sn = normalizeText(item && (item.sn || item.serial))
    if (!sn) continue // 无 SN 不沉淀，避免脏档案
    const snKey = normalizeSn(sn)
    try {
      // 优先按规范化键匹配（容错横杠/大小写/空格）；存量未回填时回退精确 SN
      let existRes = await db.collection('cicada_user_devices')
        .where({ sn_normalized: snKey, user_id: userId }).limit(1).get()
      if (!existRes.data || !existRes.data.length) {
        existRes = await db.collection('cicada_user_devices')
          .where({ sn, user_id: userId }).limit(1).get()
      }
      const existing = existRes.data && existRes.data[0]
      const buyDate = normalizeText(item.buy_date) || (existing && existing.buy_date) || ''
      const baseFields = {
        product_name: normalizeText(item.product_name) || (existing && existing.product_name) || '已登记设备',
        model: normalizeText(item.product_model) || (existing && existing.model) || '',
        buy_date: buyDate
      }
      // 质保沉淀：若设备尚无 warranty_expire，但有购机日期，则按默认质保月数推算并落库，
      // 使自助报修设备也具备在保/过保判定依据（此前该字段仅后台手工建档才写）。
      const existingExpire = existing && normalizeText(existing.warranty_expire)
      if (!existingExpire && buyDate) {
        const months = (existing && Number(existing.warranty_months) > 0)
          ? Number(existing.warranty_months)
          : DEFAULT_WARRANTY_MONTHS
        const derivedExpire = addMonthsToDateStr(buyDate, months)
        if (derivedExpire) {
          baseFields.warranty_expire = derivedExpire
          baseFields.warranty_months = months
        }
      }
      const trackFields = {
        last_order_no: orderMeta.order_no || (existing && existing.last_order_no) || '',
        last_order_id: orderMeta.order_id || (existing && existing.last_order_id) || '',
        last_repair_status: orderMeta.status || (existing && existing.last_repair_status) || '',
        last_repair_time: now,
        update_time: now
      }
      if (existing) {
        const updatePayload = {
          ...baseFields,
          ...trackFields,
          sn_normalized: snKey,
          repair_count: Number(existing.repair_count || 0) + (orderMeta.countRepair ? 1 : 0)
        }
        // 回填 customer_id，让小程序设备与后台 CRM 设备台账合流
        if (customerId && !normalizeText(existing.customer_id)) updatePayload.customer_id = customerId
        await db.collection('cicada_user_devices').doc(existing._id).update(updatePayload)
      } else {
        await db.collection('cicada_user_devices').add({
          user_id: userId,
          customer_id: customerId,
          sn,
          sn_normalized: snKey,
          ...baseFields,
          ...trackFields,
          repair_count: orderMeta.countRepair ? 1 : 0,
          source: 'mini_repair',
          create_time: now
        })
      }
    } catch (e) {
      // 忽略单条设备沉淀失败
    }
  }
}

// 下单时计算订单级质保结论：逐个 SN 优先查已建档设备，其次由提交的购机日期推算。
// 返回 { in_warranty, warranty_status, charge_type }；charge_type 仅为默认建议，
// 人为损坏等不在保情形由工程师在报价时最终判定（可覆盖）。
async function computeOrderWarranty(userId, items = []) {
  let anyInWarranty = false
  let anyEvaluated = false
  for (const item of items) {
    const sn = normalizeText(item && (item.sn || item.serial))
    let device = null
    if (sn && userId) {
      try {
        const snKey = normalizeSn(sn)
        let res = await db.collection('cicada_user_devices').where({ sn_normalized: snKey, user_id: userId }).limit(1).get()
        if (!res.data || !res.data.length) {
          res = await db.collection('cicada_user_devices').where({ sn, user_id: userId }).limit(1).get()
        }
        device = res.data && res.data[0]
      } catch (e) {
        device = null
      }
    }
    // 已建档设备用其质保数据；否则用本次提交的购机日期推算
    const source = device || { buy_date: item && item.buy_date }
    const expire = deriveWarrantyExpire(source)
    if (!expire) continue
    anyEvaluated = true
    const { inWarranty } = computeWarrantyStatus(expire, source.ext_warranty)
    if (inWarranty) anyInWarranty = true
  }
  if (!anyEvaluated) {
    return { in_warranty: false, warranty_status: 'unknown', charge_type: 'pending' }
  }
  return {
    in_warranty: anyInWarranty,
    warranty_status: anyInWarranty ? 'in_warranty' : 'expired',
    charge_type: anyInWarranty ? 'free' : 'paid'
  }
}

module.exports = {
  _before() {},

  async queryPackageStatus({ token = '', trackingNo = '', phoneLast4 = '' }) {
    try {
      const normalizedTrackingNo = normalizeText(trackingNo).replace(/\s/g, '')
      if (!normalizedTrackingNo) return { code: -1, msg: '请输入快递单号' }
      if (!/^[A-Za-z0-9-]{6,40}$/.test(normalizedTrackingNo)) {
        return { code: -1, msg: '快递单号格式不正确' }
      }

      const found = await findOrderByTrackingNo(normalizedTrackingNo)
      if (!found || !found.order) return { code: 0, data: null }

      const { order, matchedType } = found
      const shipBackInfo = order.ship_back_info || {}
      const storedLast4 = normalizePhoneLast4(
        shipBackInfo.phone || shipBackInfo.mobile || shipBackInfo.receiverPhone || shipBackInfo.receiver_phone
      )
      const inputLast4 = normalizePhoneLast4(phoneLast4)
      let isOwner = false

      if (token) {
        try {
          const user = await verifyUserToken(token)
          isOwner = user && order.user_id === user._id
        } catch (e) {
          isOwner = false
        }
      }

      const fullAccess = Boolean(isOwner || (storedLast4 && inputLast4 && storedLast4 === inputLast4))
      // 返回寄出 + 回寄两段，供前端双 tab 展示（matchedType 用于默认选中输入单号匹配的那段）
      return {
        code: 0,
        data: {
          trackingNo: normalizedTrackingNo,
          orderId: fullAccess ? (order.order_no || order._id || '') : '',
          matchedType,
          out: buildPackageSegment(order, 'out', fullAccess),
          back: buildPackageSegment(order, 'back', fullAccess)
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async createOrder(params) {
    let orderId = ''
    try {
      const { token, ship_out_info, ship_back_info, items } = params
      const user = await verifyUserToken(token)
      await checkRateLimit('create-order', user._id, CREATE_ORDER_LIMIT)
      if (!Array.isArray(items) || items.length === 0) {
        return { code: -1, msg: '请至少提交一个维修产品' }
      }
      if (items.some(item => !item || !item.product_name)) {
        return { code: -1, msg: '产品名称不能为空' }
      }

      const now = Date.now()
      const order_no = genOrderNo()
      // 身份桥：下单即匹配/建档 CRM 客户，并把 customer_id 落到工单上
      let customerId = ''
      try {
        customerId = await ensureCustomerForUser(user)
      } catch (customerErr) {
        customerId = ''
      }
      // 在保/过保自动判定：用于区分免费(在保质量问题)/收费(过保或人为损坏)维修
      const warranty = await computeOrderWarranty(user._id, items)
      const newOrder = {
        order_no,
        user_id: user._id,
        customer_id: customerId,
        status: 'pending',
        ship_out_info,
        ship_back_info,
        engineer_id: '',
        total_price: 0,
        in_warranty: warranty.in_warranty,
        warranty_status: warranty.warranty_status,
        charge_type: warranty.charge_type,
        timeline: [{ title: '提交报修单', desc: '您的报修申请已提交，等待客服审核', time: now, done: true }],
        update_time: now,
        create_time: now
      }
      const orderRes = await db.collection('cicada_orders').add(newOrder)

      orderId = orderRes.id

      await Promise.all(items.map(item => {
        const data = pickFields(item, [
          'product_name',
          'product_category',
          'product_model',
          'sn',
          'buy_date',
          'fault_desc',
          'media_urls',
          'voucher_urls',
          'image_urls',
          'video_urls',
          'fix_solution'
        ])
        data.media_urls = normalizeArray(data.media_urls)
        data.voucher_urls = normalizeArray(data.voucher_urls)
        data.image_urls = normalizeArray(data.image_urls)
        data.video_urls = normalizeArray(data.video_urls)
        data.sn_normalized = normalizeSn(data.sn) // 容错检索键
        return db.collection('cicada_order_items').add({ ...data, order_id: orderId })
      }))

      await logOrderEvent({
        order: { ...newOrder, _id: orderId },
        action: 'create_order',
        actor: user,
        before: {},
        after: {
          status: newOrder.status,
          item_count: items.length,
          ship_out_info,
          ship_back_info
        }
      })
      // 报修提交即沉淀设备档案（按 SN），并带上 customer_id 与 CRM 设备台账合流
      await upsertUserDevicesFromItems(user, items, { order_no, order_id: orderId, status: 'pending', countRepair: true, customer_id: customerId })
      await sendOrderSubscription({ ...newOrder, _id: orderId }, 'repair_submitted', '报修申请已提交')
      return { code: 0, msg: '提交成功', data: { order_id: orderId, order_no } }
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

  // 获取工单列表
  async getOrderList({ token, page = 1, pageSize = 10 }) {
    try {
      const user = await verifyUserToken(token)
      const pagination = normalizePage(page, pageSize)
      const res = await db.collection('cicada_orders')
        .where({ user_id: user._id })
        .orderBy('create_time', 'desc')
        .skip((pagination.page - 1) * pagination.pageSize)
        .limit(pagination.pageSize)
        .get()

      const orders = await Promise.all(res.data.map(async order => {
        const itemKeys = [order._id, order.order_no].filter(Boolean)
        const itemRes = itemKeys.length
          ? await db.collection('cicada_order_items')
            .where({ order_id: db.command.in(itemKeys) })
            .limit(20)
            .get()
          : { data: [] }
        const items = itemRes.data || []
        const firstItem = items[0] || {}
        const shipOutInfo = order.ship_out_info || {}
        return {
          ...order,
          ...exposeQuoteFields(order),
          items,
          product_name: firstItem.product_name || '',
          product_model: firstItem.product_model || '',
          fault_desc: firstItem.fault_desc || '',
          sn: firstItem.sn || '',
          buy_date: firstItem.buy_date || '',
          logistics_company: shipOutInfo.logistics_company || '',
          logistics_no: shipOutInfo.logistics_no || ''
        }
      }))

      return { code: 0, data: orders }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 工单状态统计（DB 端按状态聚合，供"我的"页角标使用）
  async getOrderStats({ token }) {
    try {
      const user = await verifyUserToken(token)
      const res = await db.collection('cicada_orders')
        .where({ user_id: user._id })
        .field({ status: true })
        .limit(1000)
        .get()

      const byStatus = {
        pending: 0, sent: 0, received: 0, inspecting: 0,
        fixing: 0, shipped: 0, completed: 0, cancelled: 0
      }
      ;(res.data || []).forEach(order => {
        const status = String(order.status || '').trim()
        if (Object.prototype.hasOwnProperty.call(byStatus, status)) byStatus[status] += 1
      })

      const total = (res.data || []).length
      // 前端分桶：待处理（已提交/运输中/已签收/检测中）、维修中、已发货
      const pending = byStatus.pending + byStatus.sent + byStatus.received + byStatus.inspecting
      const fixing = byStatus.fixing
      const shipped = byStatus.shipped
      const completed = byStatus.completed

      return { code: 0, data: { total, pending, fixing, shipped, completed, byStatus } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 开票记录列表（从订单的 invoice_info 派生，DB 端筛选 + 分页）
  async getInvoiceList({ token, page = 1, pageSize = 10 }) {
    try {
      const user = await verifyUserToken(token)
      const pagination = normalizePage(page, pageSize)
      const where = { user_id: user._id, 'invoice_info.need_invoice': true }
      const col = db.collection('cicada_orders')

      const [countRes, listRes] = await Promise.all([
        col.where(where).count(),
        col.where(where)
          .orderBy('update_time', 'desc')
          .skip((pagination.page - 1) * pagination.pageSize)
          .limit(pagination.pageSize)
          .field({ order_no: true, total_price: true, status: true, payment_status: true, invoice_info: true, create_time: true, update_time: true })
          .get()
      ])

      const list = (listRes.data || []).map(order => {
        const info = order.invoice_info || {}
        return {
          orderId: order._id,
          orderNo: order.order_no || '',
          amount: Number(order.total_price || 0),
          orderStatus: order.status || '',
          paymentStatus: order.payment_status || '',
          invoiceType: info.invoice_type || '',
          titleType: info.title_type || '',
          title: info.title || '',
          taxNo: info.tax_no || '',
          email: info.email || '',
          remark: info.remark || '',
          status: info.status || '待开票',
          fileUrl: info.file_url || info.invoice_url || '',
          invoiceUrl: info.invoice_url || info.file_url || '',
          invoiceNo: info.invoice_no || '',
          invoiceDate: info.invoice_date || '',
          applyTime: info.apply_time || order.create_time || 0,
          updateTime: info.update_time || order.update_time || 0
        }
      })

      return { code: 0, data: { list, total: countRes.total || 0, page: pagination.page, pageSize: pagination.pageSize } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 获取工单详情
  async getOrderDetail({ token, order_id }) {
    try {
      const user = await verifyUserToken(token)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      const order = await findOwnedOrder(user._id, order_id)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      const itemKeys = [order._id, order.order_no].filter(Boolean)
      const itemsRes = itemKeys.length
        ? await db.collection('cicada_order_items')
          .where({ order_id: db.command.in(itemKeys) })
          .get()
        : { data: [] }
      return { code: 0, data: { ...order, ...exposeQuoteFields(order), items: itemsRes.data } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 按 SN 识别设备：带出型号 / 是否在保 / 历史维修记录（用于报修表单自动填充）
  async lookupDeviceBySn({ token, sn }) {
    try {
      const user = await verifyUserToken(token)
      const serial = normalizeText(sn)
      if (!serial) return { code: -1, msg: '请输入设备序列号' }
      const snKey = normalizeSn(serial) // 容错检索键（大写、去空格/横杠）

      // 设备 SN 期望全局唯一（手动绑定 manageDevice 已做全局查重）：优先取当前用户名下设备，
      // 其次取任意匹配设备（仅返回型号/质保等非敏感信息，不泄露归属账号）。
      // 优先按规范化键匹配，存量未回填时回退精确 SN。
      const findDevice = async (extra = {}) => {
        let res = await db.collection('cicada_user_devices')
          .where({ sn_normalized: snKey, ...extra }).limit(1).get()
        if (!res.data || !res.data.length) {
          res = await db.collection('cicada_user_devices')
            .where({ sn: serial, ...extra }).limit(1).get()
        }
        return res.data && res.data[0]
      }
      let device = await findDevice({ user_id: user._id })
      if (!device) device = await findDevice()

      // 历史维修记录：当前用户名下、含该 SN 的工单（按规范化键，回退精确 SN）
      let itemRes = await db.collection('cicada_order_items')
        .where({ sn_normalized: snKey }).field({ order_id: true, fault_desc: true }).limit(50).get()
      if (!itemRes.data || !itemRes.data.length) {
        itemRes = await db.collection('cicada_order_items')
          .where({ sn: serial }).field({ order_id: true, fault_desc: true }).limit(50).get()
      }
      const orderIds = [...new Set((itemRes.data || []).map(i => i.order_id).filter(Boolean))]
      let history = []
      if (orderIds.length) {
        const ordersRes = await db.collection('cicada_orders')
          .where({ _id: db.command.in(orderIds), user_id: user._id })
          .field({ order_no: true, status: true, create_time: true })
          .orderBy('create_time', 'desc').limit(10).get()
        history = (ordersRes.data || []).map(o => ({
          id: o._id,
          orderNo: o.order_no,
          status: o.status,
          createTime: o.create_time
        }))
      }

      if (!device && !history.length) {
        return { code: 0, data: { found: false, sn: serial, history: [] } }
      }

      // 优先用已存到期日；无则由购机日期+质保月数推算，使仅有购机日期的设备也能判定在保
      const expireRaw = device ? deriveWarrantyExpire(device) : ''
      const { inWarranty, warrantyStatus } = computeWarrantyStatus(expireRaw, device && device.ext_warranty)

      return {
        code: 0,
        data: {
          found: Boolean(device),
          sn: serial,
          productName: device ? (device.product_name || '') : '',
          productCategory: device ? (device.product_category || '') : '',
          model: device ? (device.model || '') : '',
          buyDate: device ? (device.buy_date || '') : '',
          warrantyExpire: expireRaw || '',
          warrantyStatus,
          inWarranty,
          maintenanceCycle: device ? (device.maintenance_cycle || '') : '',
          history
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // SN 操作埋点：记录每次扫码/手动查询（写入全局操作日志 cicada_sn_logs）。
  // 失败静默，绝不阻断主流程。
  async logSnAction({ token, action, sn, matched, warranty_status, device_id } = {}) {
    try {
      const user = await verifyUserToken(token)
      const act = normalizeText(action)
      if (!['sn_scan', 'sn_query'].includes(act)) return { code: -1, msg: '操作类型不正确' }
      const serial = normalizeText(sn)
      if (!serial) return { code: -1, msg: '缺少 SN' }
      await db.collection('cicada_sn_logs').add({
        action: act,
        sn: serial,
        sn_normalized: normalizeSn(serial),
        source: 'client',
        actor_id: user._id || '',
        actor_role: 'client',
        actor_name: normalizeText(user.name || user.nickname || user.phone || ''),
        matched: Boolean(matched),
        device_id: normalizeText(device_id),
        warranty_status: normalizeText(warranty_status),
        create_time: Date.now()
      }).catch(() => {})
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 客户确认后台发布的维修报价
  async confirmQuote({ token, order_id }) {
    try {
      const user = await verifyUserToken(token)
      const order = await findOwnedOrder(user._id, order_id)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      if (!['issued', 'confirmed'].includes(order.quote_status)) {
        return { code: -1, msg: '当前工单暂无可确认报价' }
      }

      const now = Date.now()
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const updateData = {
        quote_status: 'confirmed',
        authorization_status: 'confirmed',
        authorization_time: now,
        update_time: now
      }

      if (order.quote_status !== 'confirmed' || order.authorization_status !== 'confirmed') {
        updateData.timeline = [
          ...timeline,
          {
            title: '客户已确认费用',
            desc: `客户已确认维修费用 ${Number(order.total_price || 0).toFixed(2)} 元。`,
            time: now,
            done: true
          }
        ]
      }

      await db.collection('cicada_orders').doc(order._id).update(updateData)
      await logOrderEvent({
        order,
        action: 'confirm_quote',
        actor: user,
        before: {
          quote_status: order.quote_status || 'pending',
          authorization_status: order.authorization_status || ''
        },
        after: {
          quote_status: updateData.quote_status,
          authorization_status: updateData.authorization_status,
          total_price: Number(order.total_price || 0)
        }
      })
      return { code: 0, data: { ...updateData, ...exposeQuoteFields({ ...order, ...updateData }) } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 客户拒绝后台发布的维修报价（仅 issued 可拒，已支付不可拒）
  async rejectQuote({ token, order_id, reason = '' }) {
    try {
      const user = await verifyUserToken(token)
      const order = await findOwnedOrder(user._id, order_id)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      if (order.quote_status !== 'issued') {
        return { code: -1, msg: '当前工单暂无可拒绝的报价' }
      }
      if (order.payment_status === 'paid') {
        return { code: -1, msg: '工单已支付，不能拒绝报价' }
      }

      const now = Date.now()
      const reasonText = normalizeText(reason)
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      // 归档路径：设备尚未拆检（pending/sent/received）→ 直接取消归档；
      // 已进入检测/维修（inspecting/fixing）→ 设备在维修中心，标记待回寄，由售后安排原路寄回后再结案。
      const returnableEarly = ['pending', 'sent', 'received']
      const canArchiveNow = returnableEarly.includes(order.status)
      const archiveNote = canArchiveNow
        ? '客户拒绝维修报价，工单已自动取消归档。'
        : '客户拒绝维修报价，设备将原路寄回，售后将尽快为您安排回寄后归档。'
      const updateData = {
        quote_status: 'rejected',
        authorization_status: '',
        update_time: now,
        timeline: [
          ...timeline,
          {
            title: '客户已拒绝维修报价',
            desc: reasonText ? `拒绝原因：${reasonText}` : archiveNote,
            time: now,
            done: true
          }
        ]
      }
      if (canArchiveNow) {
        updateData.status = 'cancelled'
        updateData.cancel_reason = reasonText || '客户拒绝维修报价'
        updateData.cancelled_at = now
      } else {
        // 待回寄归档标记：供后台“待回寄/待归档”待办筛选，避免拒修工单悬挂
        updateData.needs_return = true
        updateData.archive_status = 'pending_return'
      }

      await db.collection('cicada_orders').doc(order._id).update(updateData)
      await logOrderEvent({
        order,
        action: 'reject_quote',
        actor: user,
        before: { quote_status: order.quote_status || 'pending', status: order.status },
        after: { quote_status: updateData.quote_status, status: updateData.status || order.status, reason: reasonText }
      })
      return { code: 0, data: { ...updateData, ...exposeQuoteFields({ ...order, ...updateData }) } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 客户确认收货：已回寄(shipped) → 已完成(completed)，并沉淀设备档案
  async confirmReceipt({ token, order_id }) {
    try {
      const user = await verifyUserToken(token)
      const order = await findOwnedOrder(user._id, order_id)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      if (order.status === 'completed') {
        return { code: 0, data: { status: 'completed', ...exposeQuoteFields(order) } }
      }
      if (order.status !== 'shipped') {
        return { code: -1, msg: '当前工单尚未回寄，无法确认收货' }
      }
      assertOrderStatusTransition(order.status, 'completed')

      const now = Date.now()
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const updateData = {
        status: 'completed',
        received_confirm_time: now,
        update_time: now,
        timeline: [
          ...timeline,
          { title: '客户已确认收货', desc: '客户已确认收到回寄设备，工单完成。', time: now, done: true }
        ]
      }

      await db.collection('cicada_orders').doc(order._id).update(updateData)
      await logOrderEvent({
        order,
        action: 'confirm_receipt',
        actor: user,
        before: { status: order.status || '' },
        after: { status: updateData.status }
      })

      // 维修完成即沉淀/更新设备档案，带上 customer_id（旧单缺失时即时回填）
      let customerId = normalizeText(order.customer_id)
      if (!customerId) {
        try { customerId = await ensureCustomerForUser(user) } catch (customerErr) { customerId = '' }
      }
      const itemKeys = [order._id, order.order_no].filter(Boolean)
      const itemsRes = itemKeys.length
        ? await db.collection('cicada_order_items').where({ order_id: db.command.in(itemKeys) }).get()
        : { data: [] }
      await upsertUserDevicesFromItems(user, itemsRes.data || [], {
        order_no: order.order_no, order_id: order._id, status: 'completed', customer_id: customerId
      })

      // 与 admin 标记完成保持一致：触发工单完成 + 服务评价邀请订阅提醒
      await sendOrderSubscription({ ...order, ...updateData }, 'order_completed', '维修已完成')
      await sendOrderSubscription({ ...order, ...updateData }, 'review_invite', '邀请您对本次维修评价')

      return { code: 0, data: { ...updateData, ...exposeQuoteFields({ ...order, ...updateData }) } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 客户回访评价：仅已完成工单可评；不满意可联动生成投诉
  async submitOrderReview({ token, order_id, rating = 0, satisfaction = '', content = '', tags = [], to_complaint = false }) {
    try {
      const user = await verifyUserToken(token)
      const order = await findOwnedOrder(user._id, order_id)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      if (order.status !== 'completed') return { code: -1, msg: '工单完成后才能评价' }

      const score = Math.min(Math.max(Number(rating) || 0, 0), 5)
      if (!score) return { code: -1, msg: '请先选择评分' }

      const now = Date.now()
      const satisfied = score >= 4
      const review = {
        rating: score,
        satisfaction: normalizeText(satisfaction) || (satisfied ? '满意' : '不满意'),
        content: normalizeText(content).slice(0, 500),
        tags: normalizeArray(tags).map(tag => normalizeText(tag)).filter(Boolean).slice(0, 10),
        satisfied,
        create_time: now
      }
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const updateData = {
        review,
        review_time: now,
        update_time: now,
        timeline: [
          ...timeline,
          { title: '客户已评价回访', desc: `评分 ${score} 星 · ${review.satisfaction}`, time: now, done: true }
        ]
      }

      await db.collection('cicada_orders').doc(order._id).update(updateData)
      await logOrderEvent({
        order,
        action: 'submit_review',
        actor: user,
        before: { review: order.review || null },
        after: { rating: score, satisfaction: review.satisfaction }
      })

      // 不满意可联动生成投诉，自动带 rel_order_no
      let complaintId = ''
      if (!satisfied && to_complaint) {
        const fb = await db.collection('cicada_feedbacks').add({
          user_id: user._id,
          type: '投诉',
          status: '待处理',
          rel_order_no: order.order_no || '',
          content: review.content || `维修回访不满意（评分 ${score} 星），系统自动生成投诉。`,
          create_time: now,
          update_time: now
        }).catch(() => null)
        complaintId = fb && fb.id ? fb.id : ''
      }

      return { code: 0, data: { review, complaintId } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 我的设备档案列表（设备沉淀后的真实数据源）
  async listMyDevices({ token, page = 1, pageSize = 20 }) {
    try {
      const user = await verifyUserToken(token)
      const pagination = normalizePage(page, pageSize)
      const col = db.collection('cicada_user_devices')
      const where = { user_id: user._id }

      const [countRes, listRes] = await Promise.all([
        col.where(where).count(),
        col.where(where)
          .orderBy('update_time', 'desc')
          .skip((pagination.page - 1) * pagination.pageSize)
          .limit(pagination.pageSize)
          .get()
      ])

      const now = Date.now()
      const list = (listRes.data || []).map(device => {
        let warrantyStatus = 'unknown'
        let inWarranty = false
        const expireRaw = device.warranty_expire || ''
        if (expireRaw) {
          const expireTs = new Date(`${expireRaw}T23:59:59`).getTime()
          if (!Number.isNaN(expireTs)) {
            inWarranty = now <= expireTs
            warrantyStatus = inWarranty
              ? (Array.isArray(device.ext_warranty) && device.ext_warranty.length ? 'extended' : 'in_warranty')
              : 'expired'
          }
        }
        return {
          id: device._id,
          sn: device.sn || '',
          productName: device.product_name || '',
          productCategory: device.product_category || '',
          model: device.model || '',
          buyDate: device.buy_date || '',
          warrantyExpire: expireRaw,
          warrantyStatus,
          inWarranty,
          lastOrderNo: device.last_order_no || '',
          lastRepairStatus: device.last_repair_status || '',
          lastRepairTime: device.last_repair_time || 0,
          repairCount: Number(device.repair_count || 0)
        }
      })

      return { code: 0, data: { list, total: countRes.total || 0, page: pagination.page, pageSize: pagination.pageSize } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 微信小程序支付：确认报价并创建预支付订单
  async createWechatPayPayment({ token, order_id }) {
    try {
      const user = await verifyUserToken(token)
      const order = await findOwnedOrder(user._id, order_id)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      assertOrderPayable(order)
      if (!user.openid) return { code: -1, msg: '当前用户缺少微信 openid，请重新登录后再支付' }
      if (!['issued', 'confirmed'].includes(order.quote_status)) {
        return { code: -1, msg: '当前工单暂无可支付报价' }
      }
      if (order.payment_status === 'paid') {
        return { code: -1, msg: '该工单已支付，无需重复付款' }
      }
      if (order.payment_status === 'uploaded' || (Array.isArray(order.payment_proofs) && order.payment_proofs.length)) {
        return { code: -1, msg: '该工单已上传对公转账凭证，请等待后台核销' }
      }

      const amountFen = getOrderPayAmountFen(order)
      if (amountFen <= 0) return { code: -1, msg: '当前工单暂无待支付金额' }

      const payConfig = getWechatPayConfig()
      const existingOutTradeNo = normalizeOutTradeNo(order.wechat_pay_out_trade_no)
      const existingPrepayId = normalizeText(order.wechat_pay_prepay_id)
      const existingAmountFen = Number(order.wechat_pay_amount || 0) || 0
      const existingCreatedAt = Number(order.wechat_pay_create_time || 0) || 0
      const existingPayAlive = existingOutTradeNo &&
        existingPrepayId &&
        existingAmountFen === amountFen &&
        Date.now() - existingCreatedAt < 90 * 60 * 1000
      if (existingPayAlive) {
        return {
          code: 0,
          data: {
            outTradeNo: existingOutTradeNo,
            prepayId: existingPrepayId,
            payment: buildRequestPaymentParams(existingPrepayId, payConfig),
            ...exposeQuoteFields(order)
          }
        }
      }

      const outTradeNo = genOutTradeNo(order)
      const { data } = await requestWechatPay('POST', '/v3/pay/transactions/jsapi', {
        appid: payConfig.appId,
        mchid: payConfig.mchId,
        description: getPaymentTitle(order),
        out_trade_no: outTradeNo,
        notify_url: payConfig.notifyUrl,
        amount: {
          total: amountFen,
          currency: 'CNY'
        },
        payer: {
          openid: user.openid
        }
      }, payConfig)

      if (!data.prepay_id) return { code: -1, msg: '微信支付未返回预支付单号' }

      const now = Date.now()
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const confirmPatch = (order.quote_status !== 'confirmed' || order.authorization_status !== 'confirmed')
        ? {
            quote_status: 'confirmed',
            authorization_status: 'confirmed',
            authorization_time: now
          }
        : {}

      const updateData = {
        ...confirmPatch,
        payment_status: 'pending',
        wechat_pay_out_trade_no: outTradeNo,
        wechat_pay_prepay_id: data.prepay_id,
        wechat_pay_amount: amountFen,
        wechat_pay_create_time: now,
        update_time: now
      }

      if (confirmPatch.quote_status) {
        updateData.timeline = [
          ...timeline,
          {
            title: '客户已确认费用',
            desc: `客户已确认维修费用 ${(amountFen / 100).toFixed(2)} 元，并发起微信支付。`,
            time: now,
            done: true
          }
        ]
      }

      await db.collection('cicada_orders').doc(order._id).update(updateData)
      return {
        code: 0,
        data: {
          outTradeNo,
          prepayId: data.prepay_id,
          payment: buildRequestPaymentParams(data.prepay_id, payConfig),
          ...exposeQuoteFields({ ...order, ...updateData })
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 支付完成后由前端触发同步，服务端向微信查单后才标记已支付
  async syncWechatPayPayment({ token, order_id, out_trade_no = '' }) {
    try {
      const user = await verifyUserToken(token)
      const order = await findOwnedOrder(user._id, order_id)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      if (order.payment_status === 'paid') {
        return { code: 0, data: { ...exposeQuoteFields(order), status: order.status || 'fixing' } }
      }
      assertOrderPayable(order)

      const outTradeNo = normalizeOutTradeNo(out_trade_no || order.wechat_pay_out_trade_no)
      const data = await confirmWechatPaySuccess(outTradeNo, order)
      return { code: 0, data }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 微信支付异步通知兜底：解密通知后仍以服务端查单结果为准
  async wechatPayNotify(params = {}) {
    try {
      const body = params && params.resource ? params : (parseHttpBody(this) || {})
      const transaction = decryptWechatPayResource(body.resource || {})
      const outTradeNo = normalizeOutTradeNo(transaction.out_trade_no)
      if (!outTradeNo) throw new Error('微信支付通知缺少商户订单号')
      await confirmWechatPaySuccess(outTradeNo)
      return { code: 'SUCCESS', message: '成功' }
    } catch (e) {
      console.warn('wechat pay notify failed:', e)
      return { code: 'FAIL', message: e.message || '失败' }
    }
  },

  // 客户上传付款/对公转账凭证
  async uploadPaymentProof({ token, order_id, proof = {} }) {
    try {
      const user = await verifyUserToken(token)
      const order = await findOwnedOrder(user._id, order_id)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      assertOrderPayable(order)
      if (!Number(order.total_price || 0)) return { code: -1, msg: '当前工单暂无待支付金额' }

      const now = Date.now()
      const proofFileID = normalizeText(proof.fileID || proof.fileId)
      const proofPreviewUrl = normalizeText(proof.url || proof.path)
      const nextProof = {
        id: normalizeText(proof.id) || `pay-${now}`,
        url: proofFileID || proofPreviewUrl,
        fileID: proofFileID,
        path: normalizeText(proof.path),
        previewUrl: proofPreviewUrl,
        time: proof.time || formatTimelineTime(now),
        create_time: now
      }
      if (!nextProof.url && !nextProof.fileID && !nextProof.path) {
        return { code: -1, msg: '付款凭证不能为空' }
      }

      const proofs = Array.isArray(order.payment_proofs) ? order.payment_proofs : []
      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const confirmPatch = (order.quote_status !== 'confirmed' || order.authorization_status !== 'confirmed')
        ? {
            quote_status: 'confirmed',
            authorization_status: 'confirmed',
            authorization_time: now
          }
        : {}
      const updateData = {
        ...confirmPatch,
        payment_status: 'uploaded',
        payment_method: 'offline_transfer',
        payment_proofs: [...proofs, nextProof],
        timeline: [
          ...timeline,
          ...(confirmPatch.quote_status ? [{
            title: '客户已确认费用',
            desc: `客户已确认维修费用 ${Number(order.total_price || 0).toFixed(2)} 元。`,
            time: now,
            done: true
          }] : []),
          {
            title: '客户已上传付款凭证',
            desc: '等待后台核对到账。',
            time: now,
            done: true
          }
        ],
        update_time: now
      }

      await db.collection('cicada_orders').doc(order._id).update(updateData)
      await logOrderEvent({
        order,
        action: 'upload_payment_proof',
        actor: user,
        before: {
          payment_status: order.payment_status || 'pending',
          payment_proof_count: proofs.length
        },
        after: {
          payment_status: updateData.payment_status,
          payment_method: updateData.payment_method,
          payment_proof_count: updateData.payment_proofs.length
        }
      })
      return { code: 0, data: { ...updateData, ...exposeQuoteFields({ ...order, ...updateData }) } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 客户提交电子发票申请
  async applyInvoice({
    token,
    orderId = '',
    order_id = '',
    invoiceType = '电子普通发票',
    invoice_type = '',
    titleType = 'company',
    title_type = '',
    title = '',
    taxNo = '',
    tax_no = '',
    email = '',
    remark = ''
  }) {
    try {
      const user = await verifyUserToken(token)
      const targetOrderId = order_id || orderId
      const order = await findOwnedOrder(user._id, targetOrderId)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      if (order.status === 'cancelled') return { code: -1, msg: '已取消工单不可申请开票' }
      const billable = Number(order.total_price || 0) > 0 && order.payment_status === 'paid'
      if (!['completed', 'shipped'].includes(order.status) && !billable) {
        return { code: -1, msg: '维修完成或付款到账后才可申请开票' }
      }

      const invoiceTitle = normalizeText(title)
      const invoiceTitleType = normalizeText(title_type || titleType || 'company') || 'company'
      const invoiceTaxNo = normalizeText(tax_no || taxNo)
      const invoiceEmail = normalizeText(email)
      if (!invoiceTitle) return { code: -1, msg: '请填写发票抬头' }
      if (invoiceTitleType === 'company' && !invoiceTaxNo) return { code: -1, msg: '请填写税号' }
      if (!invoiceEmail) return { code: -1, msg: '请填写接收邮箱' }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceEmail)) return { code: -1, msg: '接收邮箱格式不正确' }

      const now = Date.now()
      const oldInvoice = order.invoice_info || {}
      const invoiceInfo = {
        ...oldInvoice,
        need_invoice: true,
        status: '待开票',
        invoice_type: normalizeText(invoice_type || invoiceType || '电子普通发票') || '电子普通发票',
        title_type: invoiceTitleType,
        title: invoiceTitle,
        tax_no: invoiceTaxNo,
        email: invoiceEmail,
        remark: normalizeText(remark),
        apply_time: oldInvoice.apply_time || now,
        update_time: now
      }

      const timeline = Array.isArray(order.timeline) ? order.timeline : []
      const updateData = {
        invoice_info: invoiceInfo,
        update_time: now,
        timeline: [
          ...timeline,
          {
            title: '客户已提交开票申请',
            desc: `${invoiceInfo.invoice_type}：${invoiceInfo.title}`,
            time: now,
            done: true
          }
        ]
      }

      const res = await db.collection('cicada_orders').doc(order._id).update(updateData)
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      await logOrderEvent({
        order,
        action: 'apply_invoice',
        actor: user,
        before: { invoice_info: oldInvoice },
        after: { invoice_info: invoiceInfo }
      })

      return { code: 0, data: invoiceInfo }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 取消工单（仅限 pending/received 状态）
  async cancelOrder({ token, order_id, reason = '' }) {
    try {
      const user = await verifyUserToken(token)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      const order = await findOwnedOrder(user._id, order_id)
      if (!order) return { code: -1, msg: '工单不存在或无权限' }
      if (!['pending', 'received'].includes(order.status)) {
        return { code: -1, msg: '当前状态不可取消' }
      }
      assertOrderStatusTransition(order.status, 'cancelled')
      const now = Date.now()
      const updateData = {
        status: 'cancelled',
        timeline: db.command.push({ title: '已取消', desc: reason || '用户主动取消', time: now, done: true }),
        update_time: now
      }
      await db.collection('cicada_orders').doc(order._id).update(updateData)
      await logOrderEvent({
        order,
        action: 'cancel_order',
        actor: user,
        before: { status: order.status || '' },
        after: {
          status: updateData.status,
          reason: reason || '用户主动取消'
        }
      })
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
