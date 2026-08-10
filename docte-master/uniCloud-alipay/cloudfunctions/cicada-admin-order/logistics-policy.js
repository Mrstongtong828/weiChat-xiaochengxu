function getReturnShipmentBlockReason(order = {}) {
  // Payment reconciliation is independent from the physical repair workflow.
  // Staff may return an unrepaired or unpaid device while the balance remains pending.
  return ''
}

function getTrackingSegments(order = {}, trackingNo = '') {
  const no = String(trackingNo || '').trim()
  if (!no) return []
  const out = order.ship_out_info || {}
  const back = order.ship_back_info || {}
  const segments = []
  if ([out.logistics_no, out.logisticsNo].some(value => String(value || '').trim() === no)) segments.push('out')
  if ([back.logistics_no, back.logisticsNo, back.return_no, back.returnNo].some(value => String(value || '').trim() === no)) segments.push('back')
  return segments
}

function findTrackingConflict(orders = [], trackingNo = '', currentOrderId = '', targetSegment = 'back') {
  for (const order of Array.isArray(orders) ? orders : []) {
    const sameOrder = String(order._id || '') === String(currentOrderId || '')
    const segments = getTrackingSegments(order, trackingNo)
    if (!sameOrder || segments.some(segment => segment !== targetSegment)) return order
  }
  return null
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

module.exports = { findTrackingConflict, getReturnShipmentBlockReason, getTrackingSegments, reconcileTrackCache }
