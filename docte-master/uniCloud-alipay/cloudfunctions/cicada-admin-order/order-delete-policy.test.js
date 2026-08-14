const test = require('node:test')
const assert = require('node:assert/strict')
const { getOrderDeleteBlockReason } = require('./order-delete-policy')

test('a submitted order without inbound logistics can be deleted', () => {
  assert.equal(getOrderDeleteBlockReason({ status: 'pending' }), '')
})

test('an order with any inbound tracking number cannot be deleted', () => {
  for (const field of ['logistics_no', 'logisticsNo', 'tracking_no', 'trackingNo']) {
    assert.equal(
      getOrderDeleteBlockReason({ status: 'pending', ship_out_info: { [field]: 'SF123456' } }),
      '工单已有寄入快递单号，不能删除'
    )
  }
})

test('orders with protected financial or operational records cannot be deleted', () => {
  const cases = [
    [{ payment_status: 'paid' }, '工单已有付款或付款凭证记录'],
    [{ payment_proofs: [{ file_id: 'proof-1' }] }, '工单已有付款或付款凭证记录'],
    [{ refund_status: 'processing' }, '工单已有退款记录'],
    [{ invoice_info: { need_invoice: true } }, '工单已有开票申请或发票记录'],
    [{ inventory_deducted: true }, '工单已有库存处理记录'],
    [{ quote_status: 'issued' }, '工单已有正式报价记录']
  ]

  for (const [fields, reason] of cases) {
    assert.equal(getOrderDeleteBlockReason({ status: 'pending', ...fields }), reason)
  }
})
