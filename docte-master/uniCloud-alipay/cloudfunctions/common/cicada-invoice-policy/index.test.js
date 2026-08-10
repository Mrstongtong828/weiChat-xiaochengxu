const test = require('node:test')
const assert = require('node:assert/strict')

const {
  getInvoiceRequestBlockReason,
  isCorporateTransferPayment
} = require('./index')

test('only corporate transfers enter the invoice workflow', () => {
  assert.equal(isCorporateTransferPayment('offline_transfer'), true)
  assert.equal(isCorporateTransferPayment('bank_transfer'), true)
  assert.equal(isCorporateTransferPayment('wechat_pay'), false)
  assert.equal(isCorporateTransferPayment(''), false)
})

test('a paid corporate transfer can request a manual invoice', () => {
  assert.equal(getInvoiceRequestBlockReason({
    payment_method: 'offline_transfer',
    payment_status: 'paid',
    total_price: 1280
  }), '')
})

test('wechat payment is excluded from the invoice workflow', () => {
  assert.equal(getInvoiceRequestBlockReason({
    payment_method: 'wechat_pay',
    payment_status: 'paid',
    total_price: 1280
  }), '仅对公转账订单支持申请开票')
})

test('corporate transfer must be confirmed before invoicing', () => {
  assert.equal(getInvoiceRequestBlockReason({
    payment_method: 'offline_transfer',
    payment_status: 'uploaded',
    total_price: 1280
  }), '需财务先确认对公款项到账后才能开票')
})

test('zero-value corporate transfers do not enter the invoice workflow', () => {
  assert.equal(getInvoiceRequestBlockReason({
    payment_method: 'offline_transfer',
    payment_status: 'paid',
    total_price: 0
  }), '开票金额需大于 0')
})
