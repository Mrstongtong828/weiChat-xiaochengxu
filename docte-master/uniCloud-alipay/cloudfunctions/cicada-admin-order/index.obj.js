const db = uniCloud.database()
const dbCmd = db.command

async function verifyAdminToken(token) {
  if (!token) throw new Error('鉴权失败：非管理人员禁止访问该接口')
  const res = await db.collection('cicada_users').where({ token }).limit(1).get()
  const user = res.data[0]
  if (!user || user.disabled || !['admin', 'engineer'].includes(user.role)) {
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

const ORDER_STATUS = ['pending', 'sent', 'received', 'inspecting', 'fixing', 'shipped', 'completed', 'cancelled']
const SUBSCRIPTION_SCENE_LABELS = {
  repair_submitted: '报修已提交',
  order_received: '设备已签收',
  quote_issued: '维修报价已发布',
  payment_confirmed: '付款已确认',
  order_shipped: '设备已回寄',
  order_completed: '工单已完成'
}
const SUBSCRIPTION_CONFIG_SCENES = [
  { scene: 'repair_submitted', title: '报修提交提醒' },
  { scene: 'order_received', title: '设备签收提醒' },
  { scene: 'quote_issued', title: '维修报价提醒' },
  { scene: 'payment_confirmed', title: '付款到账提醒' },
  { scene: 'order_shipped', title: '回寄发货提醒' },
  { scene: 'order_completed', title: '工单完成提醒' }
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

function buildQuoteData(quote = {}, now) {
  const status = normalizeText(quote.status || quote.quote_status || quote.quoteStatus || 'draft') || 'draft'
  if (!QUOTE_STATUS.includes(status)) {
    throw new Error('报价状态不正确')
  }

  const quoteItems = normalizeQuoteItems(quote.items || quote.quote_items || quote.quoteItems)
  const partsFee = quoteItems.reduce((sum, item) => sum + item.parts_fee, 0)
  const laborFee = quoteItems.reduce((sum, item) => sum + item.labor_fee, 0)
  const totalPrice = partsFee + laborFee

  if ((status === 'draft' || status === 'issued') && (!quoteItems.length || totalPrice <= 0)) {
    throw new Error('请填写有效报价项目和金额')
  }

  return {
    quote_items: quoteItems,
    parts_fee: partsFee,
    labor_fee: laborFee,
    total_price: totalPrice,
    quote_status: status,
    quote_remark: normalizeText(quote.remark || quote.quote_remark || quote.quoteRemark),
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

async function fetchOrderBatches(matchCond = {}, { withItems = false } = {}) {
  const batchSize = 500
  const orders = []
  let offset = 0

  while (true) {
    let query = db.collection('cicada_orders')
      .aggregate()
      .match(matchCond)
      .sort({ create_time: -1 })
      .skip(offset)
      .limit(batchSize)

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
    if (batch.length < batchSize) break
    offset += batchSize
  }

  return orders
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
    await verifyAdminToken(token)
  },

  // 获取后台工单列表（支持筛选/分页）
  async getAdminOrderList(params) {
    try {
      let status, page = 1, pageSize = 20, keyword = '', deviceModel = '', invoiceStatus = '', todoType = '', responseMode = 'array'
      if (params && Object.keys(params).length) {
        ({ status, page = 1, pageSize = 20, keyword = '', deviceModel = '', invoiceStatus = '', todoType = '', responseMode = 'array' } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ status, page = 1, pageSize = 20, keyword = '', deviceModel = '', invoiceStatus = '', todoType = '', responseMode = 'array' } = body)
        }
      }
      if (status && !ORDER_STATUS.includes(status)) return { code: -1, msg: '工单状态不正确' }
      const pagination = normalizePage(page, pageSize)
      const normalizedKeyword = normalizeText(keyword).toLowerCase()
      const normalizedDeviceModel = normalizeText(deviceModel)
      const normalizedInvoiceStatus = normalizeInvoiceStatusFilter(invoiceStatus)

      // 构建匹配条件
      const matchCond = {}
      if (status) matchCond.status = status

      // 使用聚合查询联表获取工单项目；筛选和分页在云函数侧完成，避免前端固定只取前100条。
      const rawOrders = await fetchOrderBatches(matchCond, { withItems: true })

      // 处理返回数据，提取第一项的字段到外层
      const orders = await Promise.all(rawOrders.map(async order => {
        // 提取 lookup 关联到的第一条详情数据
        const itemDetail = (order.itemsList && order.itemsList.length > 0) ? order.itemsList[0] : {}
        const orderWithProofs = await enrichPaymentProofs(order)

        return {
          ...orderWithProofs,
          // 把详情里的字段平铺到最外层
          product_name: itemDetail.product_name || '',
          product_model: itemDetail.product_model || '',
          fault_desc: itemDetail.fault_desc || '',
          media_urls: itemDetail.media_urls || [],
          sn: itemDetail.sn || '',
          buy_date: itemDetail.buy_date || '',
          fix_solution: itemDetail.fix_solution || '',
          // 保留原始的 itemsList 数组供前端使用
          itemsList: order.itemsList || []
        }
      }))

      const filteredOrders = orders.filter(order => {
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
          (!normalizedInvoiceStatus || orderInvoiceStatus === normalizedInvoiceStatus)
      })

      const total = filteredOrders.length
      const start = (pagination.page - 1) * pagination.pageSize
      const list = filteredOrders.slice(start, start + pagination.pageSize)
      const deviceModels = [...new Set(filteredOrders
        .flatMap(order => (order.itemsList || []).map(item => normalizeText(item.product_model)))
        .filter(Boolean))]
        .sort()

      return {
        code: 0,
        data: responseMode === 'page'
          ? { list, total, page: pagination.page, pageSize: pagination.pageSize, deviceModels }
          : list
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 获取单条订单详情
  async getAdminOrderDetail(params) {
    try {
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
      const orderData = {
        ...orderWithProofs,
        product_name: itemDetail.product_name || '',
        product_model: itemDetail.product_model || '',
        fault_desc: itemDetail.fault_desc || '',
        media_urls: itemDetail.media_urls || [],
        sn: itemDetail.sn || '',
        buy_date: itemDetail.buy_date || '',
        fix_solution: itemDetail.fix_solution || '',
        itemsList: order.itemsList || []
      }

      return { code: 0, data: orderData }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 分配工程师
  async assignEngineer(params) {
    try {
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
      const res = await db.collection('cicada_orders').doc(order_id).update({
        engineer_id,
        update_time: Date.now()
      })
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 更新工单状态
  async updateOrderStatus(params) {
    try {
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
      const res = await db.collection('cicada_orders').doc(order_id).update({
        status,
        update_time: Date.now()
      })
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      const sceneMap = {
        received: 'order_received',
        shipped: 'order_shipped',
        completed: 'order_completed'
      }
      if (sceneMap[status] && order.status !== status) {
        await sendOrderSubscription({ ...order, status }, sceneMap[status])
      }
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 批量导入物流单：inbound=客户寄入签收，return=后台回寄发货
  async batchImportLogistics(params) {
    try {
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
        const res = await db.collection('cicada_orders').doc(order._id).update(updateData)
        if (!res.updated) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '更新失败' })
          continue
        }

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

        const res = await db.collection('cicada_orders').doc(order._id).update(updateData)
        if (!res.updated) {
          results.push({ ...item, success: false, reason: '更新失败' })
          continue
        }

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

        const res = await db.collection('cicada_orders').doc(order._id).update(updateData)
        if (!res.updated) {
          summary.fail += 1
          summary.errors.push({ orderNo: item.orderNo, reason: '更新失败' })
          continue
        }

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
      const { orderId, order_id, adminRemark, printRemark } = pickParam(this, params)
      const targetOrderId = order_id || orderId
      if (!targetOrderId) return { code: -1, msg: '缺少工单ID' }

      const now = Date.now()
      const remarkData = {
        admin_remark: normalizeText(adminRemark),
        print_remark: normalizeText(printRemark),
        update_time: now
      }

      const res = await db.collection('cicada_orders').doc(targetOrderId).update(remarkData)
      if (!res.updated) return { code: -1, msg: '工单不存在' }

      return { code: 0, data: remarkData }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 内部开票状态登记；真实税控/财务系统开票需要后续对接第三方接口
  async updateInvoiceStatus(params) {
    try {
      const { order_id, status, invoice = {} } = pickParam(this, params)
      const nextStatus = normalizeInvoiceStatusValue(status)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      if (!INVOICE_STATUS.includes(nextStatus)) return { code: -1, msg: '发票状态不正确' }

      const now = Date.now()
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }
      const oldInvoice = order.invoice_info || {}
      const invoiceInfo = {
        ...oldInvoice,
        need_invoice: nextStatus !== '无需开票',
        status: nextStatus,
        title: normalizeText(invoice.title) || oldInvoice.title || '',
        tax_no: normalizeText(invoice.tax_no || invoice.taxNo) || oldInvoice.tax_no || '',
        remark: normalizeText(invoice.remark) || oldInvoice.remark || '',
        update_time: now
      }

      const res = await db.collection('cicada_orders').doc(order_id).update({
        invoice_info: invoiceInfo,
        update_time: now
      })
      if (!res.updated) return { code: -1, msg: '工单更新失败' }

      return { code: 0, data: invoiceInfo }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 后台手动填写/发布维修报价
  async updateOrderQuote(params) {
    try {
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
      const { order_id, status } = pickParam(this, params)
      if (!order_id) return { code: -1, msg: '缺少工单ID' }
      const paymentStatus = normalizeText(status || 'paid')
      if (!PAYMENT_STATUS.includes(paymentStatus)) return { code: -1, msg: '付款状态不正确' }

      const now = Date.now()
      const found = await db.collection('cicada_orders').doc(order_id).get()
      const order = found.data && found.data[0]
      if (!order) return { code: -1, msg: '工单不存在' }

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

      if (paymentStatus === 'paid' && order.payment_status !== 'paid') {
        await sendOrderSubscription({ ...order, ...updateData }, 'payment_confirmed', '付款已确认')
      }
      return { code: 0, data: updateData }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 追加工单时间线节点
  async addTimeline(params) {
    try {
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
      const res = await db.collection('cicada_orders').doc(order_id).update({
        timeline: dbCmd.push({ title, desc, time: Date.now(), done: true }),
        update_time: Date.now()
      })
      if (!res.updated) return { code: -1, msg: '工单不存在' }
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 获取统计数据
  async getStatistics(params) {
    try {
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
      const orders = await fetchOrderBatches({ status: dbCmd.neq('cancelled') })
      const groups = [
        { key: 'inbound', title: '待签收', desc: '客户已提交或运输中的工单', count: 0 },
        { key: 'quote', title: '待报价', desc: '已签收/处理中但未发布报价', count: 0 },
        { key: 'payment', title: '待核销', desc: '客户已上传付款凭证', count: 0 },
        { key: 'invoice', title: '待开票', desc: '客户已提交发票申请', count: 0 },
        { key: 'return', title: '待回寄', desc: '已付款但尚未回寄', count: 0 },
        { key: 'exception', title: '异常工单', desc: '需要人工介入处理', count: 0 }
      ]

      groups.forEach(group => {
        group.count = orders.filter(order => matchesTodoType(order, group.key)).length
      })

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
