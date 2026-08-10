const assert = require('node:assert/strict')
const test = require('node:test')

const { findTrackingConflict, getReturnShipmentBlockReason } = require('./logistics-policy')

test('收费工单未确认到账时也允许后台回寄发货', () => {
  assert.equal(getReturnShipmentBlockReason({
    total_price: 120,
    charge_type: 'paid',
    payment_status: 'pending'
  }), '')
})

test('付款状态和收费类型不影响后台回寄', () => {
  assert.equal(getReturnShipmentBlockReason({ total_price: 120, charge_type: 'paid', payment_status: 'paid' }), '')
  assert.equal(getReturnShipmentBlockReason({ total_price: 0, charge_type: 'free', payment_status: 'pending' }), '')
  assert.equal(getReturnShipmentBlockReason({ total_price: 0, charge_type: 'warranty', warranty_status: 'in_warranty' }), '')
})

test('质保状态未知的零金额工单也允许后台回寄', () => {
  assert.equal(getReturnShipmentBlockReason({
    total_price: 0,
    charge_type: 'pending',
    warranty_status: 'unknown',
    payment_status: 'pending'
  }), '')
})

test('同一工单同一物流段允许幂等保存相同运单号', () => {
  const order = { _id: 'order-1', ship_back_info: { logistics_no: 'SF1234567890' } }
  assert.equal(findTrackingConflict([order], 'SF1234567890', 'order-1', 'back'), null)
})

test('跨工单或跨物流段复用运单号会被识别为冲突', () => {
  const otherOrder = { _id: 'order-2', ship_back_info: { returnNo: 'SF1234567890' } }
  const sameOrderOtherSegment = { _id: 'order-1', ship_out_info: { logisticsNo: 'SF1234567890' } }
  assert.equal(findTrackingConflict([otherOrder], 'SF1234567890', 'order-1', 'back'), otherOrder)
  assert.equal(findTrackingConflict([sameOrderOtherSegment], 'SF1234567890', 'order-1', 'back'), sameOrderOtherSegment)
})
