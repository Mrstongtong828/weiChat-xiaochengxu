const db = uniCloud.database()

function loadExpressProvider() {
  try {
    return require('cicada-express-provider')
  } catch (packageError) {
    return require('../common/cicada-express-provider')
  }
}

const expressProvider = loadExpressProvider()

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
  for (const item of fields) {
    const result = await db.collection('cicada_orders').where({ [item.field]: trackingNo }).limit(1).get()
    if (result.data && result.data[0]) return { order: result.data[0], segment: item.segment }
  }
  return null
}

function appendTimeline(timeline = [], node) {
  const rows = Array.isArray(timeline) ? timeline : []
  if (rows.some(item => item && item.title === node.title && item.desc === node.desc)) return rows
  return [...rows, node]
}

function buildInboundLifecycleUpdate(order, cache, now) {
  const state = String(cache.state || '')
  const update = {}
  if (order.status === 'pending' && ['0', '1', '3', '5', '7'].includes(state)) {
    update.status = 'sent'
    update.timeline = appendTimeline(order.timeline, {
      title: '快递已揽收',
      desc: '设备正在寄往维修中心',
      time: now,
      done: true
    })
  }
  if (state === '3') {
    const shipOut = order.ship_out_info || {}
    update.ship_out_info = { ...shipOut, delivered_at: cache.lastTrackAt || now }
    update.arrival_confirm_status = order.arrival_confirm_status === 'confirmed' ? 'confirmed' : 'pending'
    update.arrival_detected_at = order.arrival_detected_at || now
    update.timeline = appendTimeline(update.timeline || order.timeline, {
      title: '物流已签收，待确认入库',
      desc: '包裹已到达维修中心，工作人员正在核对设备',
      time: cache.lastTrackAt || now,
      done: true
    })
  }
  return update
}

module.exports = {
  _before() {},

  async notify(params = {}) {
    try {
      const callback = expressProvider.parseCallback(getParams(this, params))
      const found = await findOrder(callback.trackingNo)
      if (!found) return { result: true, returnCode: '200', message: '成功' }
      const now = Date.now()
      const trackCache = { ...(found.order.track_cache || {}), [found.segment]: callback.cache }
      const lifecycleUpdate = found.segment === 'out'
        ? buildInboundLifecycleUpdate(found.order, callback.cache, now)
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
