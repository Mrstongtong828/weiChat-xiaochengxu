const test = require('node:test')
const assert = require('node:assert/strict')
const { getOrderDeleteBlockReason } = require('./order-delete-policy')

test('only cancelled or completed orders can be deleted', () => {
  assert.equal(getOrderDeleteBlockReason({ status: 'cancelled' }), '')
  assert.equal(getOrderDeleteBlockReason({ status: 'completed' }), '')
})

test('orders in other statuses cannot be deleted', () => {
  for (const status of ['pending', 'sent', 'received', 'inspecting', 'fixing', 'shipped']) {
    assert.equal(getOrderDeleteBlockReason({ status }), '仅已取消或已完成的工单可以删除')
  }
})

test('already deleted orders cannot be deleted again', () => {
  assert.equal(getOrderDeleteBlockReason({ status: 'cancelled', is_deleted: true }), '工单已删除')
})

test('financial or operational records no longer block deletion', () => {
  assert.equal(getOrderDeleteBlockReason({ status: 'cancelled', payment_status: 'paid' }), '')
  assert.equal(getOrderDeleteBlockReason({ status: 'completed', invoice_info: { need_invoice: true } }), '')
  assert.equal(getOrderDeleteBlockReason({ status: 'completed', inventory_deducted: true }), '')
  assert.equal(getOrderDeleteBlockReason({ status: 'cancelled', ship_out_info: { logistics_no: 'SF123' } }), '')
  assert.equal(getOrderDeleteBlockReason({ status: 'completed', quote_status: 'issued', total_price: 100 }), '')
})
