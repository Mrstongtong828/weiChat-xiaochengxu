function getReturnShipmentBlockReason(order = {}) {
  const isFree = order.charge_type === 'free'
    || order.charge_type === 'warranty'
    || order.warranty_status === 'in_warranty'
  if (isFree) return ''
  if (order.payment_status !== 'paid') {
    return '该工单尚未确认到账（payment_status≠paid），未支付不可录入发货物流'
  }
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

module.exports = { findTrackingConflict, getReturnShipmentBlockReason, getTrackingSegments }
