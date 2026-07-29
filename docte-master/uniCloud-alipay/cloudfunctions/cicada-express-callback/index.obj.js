const db = uniCloud.database()

function loadExpressProvider() {
  try {
    return require('cicada-express-provider')
  } catch (packageError) {
    return require('../common/cicada-express-provider')
  }
}

const expressProvider = loadExpressProvider()
const { buildInboundLifecycleUpdate, findTrackingMatches, reconcileTrackCache } = require('./logistics-lifecycle')

function parseFormBody(rawBody = '') {
  return String(rawBody).split('&').reduce((result, pair) => {
    const index = pair.indexOf('=')
    const key = decodeURIComponent(index >= 0 ? pair.slice(0, index) : pair)
    const value = decodeURIComponent((index >= 0 ? pair.slice(index + 1) : '').replace(/\+/g, ' '))
    if (key) result[key] = value
    return result
  }, {})
}

function getParams(ctx, params = {}) {
  const httpInfo = ctx && ctx.getHttpInfo && ctx.getHttpInfo()
  if (!httpInfo || httpInfo.body === undefined || httpInfo.body === null) return params
  if (typeof httpInfo.body === 'object' && !Buffer.isBuffer(httpInfo.body)) return httpInfo.body
  const rawBody = Buffer.isBuffer(httpInfo.body) ? httpInfo.body.toString('utf8') : String(httpInfo.body)
  const contentType = String((httpInfo.headers && (httpInfo.headers['content-type'] || httpInfo.headers['Content-Type'])) || '').toLowerCase()
  if (contentType.includes('application/json')) return JSON.parse(rawBody || '{}')
  return parseFormBody(rawBody)
}

async function findOrder(trackingNo) {
  const fields = [
    { field: 'ship_out_info.logistics_no', segment: 'out' },
    { field: 'ship_out_info.logisticsNo', segment: 'out' },
    { field: 'ship_back_info.logistics_no', segment: 'back' },
    { field: 'ship_back_info.logisticsNo', segment: 'back' },
    { field: 'ship_back_info.return_no', segment: 'back' },
    { field: 'ship_back_info.returnNo', segment: 'back' }
  ]
  const result = await db.collection('cicada_orders').where(db.command.or(
    fields.map(item => ({ [item.field]: trackingNo }))
  )).limit(20).get()
  const matches = findTrackingMatches(result.data, trackingNo)
  if (!matches.length) return null
  if (matches.length > 1) throw new Error('同一运单号匹配到多个工单或物流段，已拒绝自动更新')
  return matches[0]
}

module.exports = {
  _before() {},

  async notify(params = {}) {
    try {
      const callback = expressProvider.parseCallback(getParams(this, params))
      const found = await findOrder(callback.trackingNo)
      if (!found) return { result: true, returnCode: '200', message: '成功' }
      const now = Date.now()
      const existingCache = ((found.order.track_cache || {})[found.segment]) || {}
      const reconciled = reconcileTrackCache(existingCache, callback.cache)
      if (!reconciled.accepted) {
        return { result: true, returnCode: '200', message: reconciled.reason === 'stale' ? '忽略过期推送' : '重复推送' }
      }
      const trackCache = { ...(found.order.track_cache || {}), [found.segment]: reconciled.cache }
      const lifecycleUpdate = found.segment === 'out'
        ? buildInboundLifecycleUpdate(found.order, reconciled.cache, now)
        : {}
      const updateData = {
        track_cache: trackCache,
        logistics_track_update_time: now,
        ...lifecycleUpdate
      }
      if (Object.keys(lifecycleUpdate).length) updateData.update_time = now
      await db.collection('cicada_orders').doc(found.order._id).update(updateData)
      return { result: true, returnCode: '200', message: '成功' }
    } catch (error) {
      console.warn('kuaidi100 callback failed:', error)
      return { result: false, returnCode: '500', message: error.message || '失败' }
    }
  }
}
