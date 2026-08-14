const {
  buildSubscriptionData,
  getSubscriptionTemplateKey
} = loadSubscriptionMessageModule()

function loadSubscriptionMessageModule() {
  try {
    return require('cicada-subscription-message')
  } catch (packageError) {
    return require('../cicada-subscription-message')
  }
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim()
}

function normalizeTrackingNo(info = {}) {
  return normalizeText(
    info.logistics_no || info.logisticsNo || info.return_no || info.returnNo || info.tracking_no || info.trackingNo
  ).replace(/\s/g, '').toUpperCase()
}

function buildSubscriptionDedupeKey(order = {}, scene = '') {
  const orderId = normalizeText(order._id || order.order_id || order.order_no)
  if (!orderId) return ''
  if (scene === 'quote_issued') return `quote_issued:${orderId}`
  if (scene === 'order_received') {
    return `order_received:${orderId}:${normalizeTrackingNo(order.ship_out_info || {}) || 'NO_TRACKING'}`
  }
  if (scene === 'order_shipped') {
    return `order_shipped:${orderId}:${normalizeTrackingNo(order.ship_back_info || {}) || 'NO_TRACKING'}`
  }
  return ''
}

function createSubscriptionNotifier({
  db,
  httpclient,
  getEnvValue,
  logger = console,
  now = Date.now
} = {}) {
  if (!db || !httpclient || typeof getEnvValue !== 'function') {
    throw new Error('订阅消息通知器缺少数据库、HTTP客户端或环境变量读取器')
  }

  let accessTokenCache = { token: '', expireAt: 0 }

  function getTemplateId(scene = '') {
    const key = getSubscriptionTemplateKey(scene)
    return normalizeText(getEnvValue(
      `WX_SUBSCRIBE_TEMPLATE_${key}`,
      `WECHAT_SUBSCRIBE_TEMPLATE_${key}`
    ))
  }

  function getWechatAppConfig() {
    const appId = normalizeText(getEnvValue('WX_APPID', 'WECHAT_APPID'))
    const secret = normalizeText(getEnvValue('WX_SECRET', 'WECHAT_SECRET'))
    if (!appId || !secret) throw new Error('未配置 WX_APPID/WX_SECRET')
    return { appId, secret }
  }

  async function getWechatAccessToken() {
    if (accessTokenCache.token && now() < accessTokenCache.expireAt) return accessTokenCache.token
    const config = getWechatAppConfig()
    const response = await httpclient.request(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.secret)}`,
      { method: 'GET', dataType: 'json' }
    )
    const data = response.data || {}
    if (!data.access_token) throw new Error(data.errmsg || '获取微信access_token失败')
    accessTokenCache = {
      token: data.access_token,
      expireAt: now() + Math.max(Number(data.expires_in || 7200) - 300, 60) * 1000
    }
    return accessTokenCache.token
  }

  async function sendWechatMessage(payload = {}) {
    const accessToken = await getWechatAccessToken()
    const response = await httpclient.request(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        dataType: 'json',
        data: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      }
    )
    const data = response.data || {}
    if (data.errcode && data.errcode !== 0) {
      throw new Error(data.errmsg || `订阅消息发送失败(${data.errcode})`)
    }
    return data
  }

  async function hasSentDedupeKey(dedupeKey) {
    if (!dedupeKey) return false
    try {
      const result = await db.collection('cicada_subscription_logs')
        .where({ dedupe_key: dedupeKey, status: 'sent' })
        .limit(1)
        .get()
      return Boolean(result.data && result.data.length)
    } catch (error) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('查询订阅消息幂等日志失败:', error && error.message)
      }
      return false
    }
  }

  async function enrichSubscriptionOrder(order = {}) {
    const hasDevice = normalizeText(order.product_model || order.device_model || order.product_name || order.device_name)
    const hasSerial = normalizeText(order.sn || order.serial_no || order.device_sn)
    if (hasDevice && hasSerial) return order
    const orderKeys = [...new Set([order._id, order.order_no].filter(Boolean))]
    if (!orderKeys.length || !db.command || typeof db.command.in !== 'function') return order
    try {
      const result = await db.collection('cicada_order_items')
        .where({ order_id: db.command.in(orderKeys) })
        .limit(1)
        .get()
      const item = result.data && result.data[0]
      if (!item) return order
      return {
        ...order,
        product_name: order.product_name || item.product_name || '',
        product_model: order.product_model || item.product_model || '',
        sn: order.sn || item.sn || '',
        fix_solution: order.fix_solution || item.fix_solution || ''
      }
    } catch (error) {
      return order
    }
  }

  async function writeLog(payload = {}) {
    try {
      await db.collection('cicada_subscription_logs').add({
        ...payload,
        create_time: now()
      })
    } catch (error) {
      if (logger && typeof logger.error === 'function') {
        logger.error('写订阅消息日志失败:', error && error.message)
      }
    }
  }

  async function sendOrderSubscription(order = {}, scene = '', remark = '', options = {}) {
    const templateId = getTemplateId(scene)
    const dedupeKey = normalizeText(options.dedupeKey) || buildSubscriptionDedupeKey(order, scene)
    const logBase = {
      order_id: normalizeText(order._id),
      order_no: normalizeText(order.order_no),
      user_id: normalizeText(order.user_id),
      scene,
      template_id: templateId,
      ...(dedupeKey ? { dedupe_key: dedupeKey } : {})
    }
    const logResult = async (status, failReason = '', openid = '') => {
      await writeLog({
        ...logBase,
        ...(openid ? { openid } : {}),
        status,
        ...(failReason ? { fail_reason: failReason } : {})
      })
      return { status, dedupeKey, ...(failReason ? { failReason } : {}) }
    }

    if (!templateId) return logResult('skipped', '未配置订阅消息模板ID')
    if (dedupeKey && await hasSentDedupeKey(dedupeKey)) {
      return { status: 'duplicate', dedupeKey }
    }

    try {
      if (!order.user_id) return logResult('skipped', '用户缺少openid')
      const userResult = await db.collection('cicada_users').doc(order.user_id).get()
      const user = userResult.data && userResult.data[0]
      if (!user || !user.openid) return logResult('skipped', '用户缺少openid')
      const messageOrder = await enrichSubscriptionOrder(order)
      await sendWechatMessage({
        touser: user.openid,
        template_id: templateId,
        page: `pages/index/index?module=track&orderId=${encodeURIComponent(order.order_no || order._id || '')}`,
        data: buildSubscriptionData(messageOrder, scene, remark)
      })
      return logResult('sent', '', user.openid)
    } catch (error) {
      return logResult('failed', error.message || String(error))
    }
  }

  return { getTemplateId, sendOrderSubscription }
}

module.exports = {
  buildSubscriptionDedupeKey,
  createSubscriptionNotifier
}
