function appendTimeline(timeline = [], node) {
  const rows = Array.isArray(timeline) ? timeline : []
  if (rows.some(item => item && item.title === node.title && item.desc === node.desc)) return rows
  return [...rows, node]
}

function loadWorkflow() {
  try {
    return require('cicada-order-workflow')
  } catch (packageError) {
    return require('../common/cicada-order-workflow')
  }
}

const { canTransitionOrderStatus } = loadWorkflow()

function findTrackingMatches(orders = [], trackingNo = '') {
  const no = String(trackingNo || '').trim()
  const matches = new Map()
  for (const order of Array.isArray(orders) ? orders : []) {
    const out = order.ship_out_info || {}
    const back = order.ship_back_info || {}
    if ([out.logistics_no, out.logisticsNo].some(value => String(value || '').trim() === no)) {
      matches.set(String(order._id) + ':out', { order, segment: 'out' })
    }
    if ([back.logistics_no, back.logisticsNo, back.return_no, back.returnNo].some(value => String(value || '').trim() === no)) {
      matches.set(String(order._id) + ':back', { order, segment: 'back' })
    }
  }
  return [...matches.values()]
}

function toTrackTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  const parsed = Date.parse(String(value).replace(/-/g, '/'))
  return Number.isNaN(parsed) ? 0 : parsed
}

function trackFingerprint(cache = {}) {
  const tracks = Array.isArray(cache.tracks) ? cache.tracks : []
  return JSON.stringify({
    trackingNo: cache.trackingNo || '',
    state: cache.state || '',
    status: cache.status || '',
    lastTrackAt: cache.lastTrackAt || '',
    tracks: tracks.map(item => [item.time || '', item.desc || '', item.statusCode || ''])
  })
}

function reconcileTrackCache(existing = {}, incoming = {}) {
  if (trackFingerprint(existing) === trackFingerprint(incoming)) {
    return { accepted: false, reason: 'duplicate', cache: existing }
  }
  const existingTime = toTrackTime(existing.lastTrackAt)
  const incomingTime = toTrackTime(incoming.lastTrackAt)
  if (existingTime && incomingTime && incomingTime < existingTime) {
    return { accepted: false, reason: 'stale', cache: existing }
  }
  return { accepted: true, reason: 'newer', cache: { ...existing, ...incoming } }
}

function shouldNotifyInboundDelivery(segment = '', existing = {}, next = {}) {
  return segment === 'out'
    && String(existing.state || '') !== '3'
    && String(next.state || '') === '3'
}

function buildInboundLifecycleUpdate(order, cache, now) {
  const state = String(cache.state || '')
  const update = {}
  if (canTransitionOrderStatus(order.status, 'sent') && order.status === 'pending' && ['0', '1', '3', '5', '7'].includes(state)) {
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
    update.arrival_confirm_status = order.arrival_confirm_status === 'confirmed' || order.status === 'received'
      ? 'confirmed'
      : 'pending'
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
  buildInboundLifecycleUpdate,
  findTrackingMatches,
  reconcileTrackCache,
  shouldNotifyInboundDelivery
}
