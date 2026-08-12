const test = require('node:test')
const assert = require('node:assert/strict')
const {
  assertManualPaymentConfirmationAllowed,
  getPaymentConfirmationStatusUpdate,
  resolveManualPaymentMethod
} = require('./payment-confirmation-policy')

const canTransition = (from, to) => to === 'fixing' && ['received', 'inspecting'].includes(from)

test('manual confirmation accepts bank-ledger reconciliation without a proof upload', () => {
  assert.equal(assertManualPaymentConfirmationAllowed({ payment_status: 'pending' }), true)
  assert.equal(assertManualPaymentConfirmationAllowed({ payment_status: 'uploaded' }), true)
  assert.equal(assertManualPaymentConfirmationAllowed({ payment_status: 'rejected' }), true)
  assert.throws(
    () => assertManualPaymentConfirmationAllowed({ payment_status: 'not_required' }),
    /当前付款状态不可人工确认到账/
  )
})

test('finance confirmation moves a received order into processing', () => {
  assert.deepEqual(getPaymentConfirmationStatusUpdate({ status: 'received' }, 123, canTransition), {
    status: 'fixing',
    status_update_time: 123,
    status_enter_time: 123
  })
})

test('finance confirmation moves an inspecting order into processing', () => {
  assert.equal(getPaymentConfirmationStatusUpdate({ status: 'inspecting' }, 123, canTransition).status, 'fixing')
})

test('finance confirmation does not rewind an order already past processing', () => {
  assert.deepEqual(getPaymentConfirmationStatusUpdate({ status: 'shipped' }, 123, canTransition), {})
  assert.deepEqual(getPaymentConfirmationStatusUpdate({ status: 'completed' }, 123, canTransition), {})
})

test('manual confirmation defaults to corporate payment', () => {
  assert.equal(resolveManualPaymentMethod({}, ''), 'offline_transfer')
  assert.equal(resolveManualPaymentMethod({ payment_method: 'bank_transfer' }, ''), 'bank_transfer')
})

test('manual confirmation rejects WeChat payment', () => {
  assert.throws(
    () => resolveManualPaymentMethod({ payment_method: 'wechat_pay' }, ''),
    /微信支付需由支付结果自动确认/
  )
  assert.throws(
    () => resolveManualPaymentMethod({ payment_method: 'wechat_pay' }, 'offline_transfer'),
    /微信支付需由支付结果自动确认/
  )
  assert.throws(
    () => resolveManualPaymentMethod({}, 'wechat_pay'),
    /财务手动确认仅支持对公支付/
  )
})
