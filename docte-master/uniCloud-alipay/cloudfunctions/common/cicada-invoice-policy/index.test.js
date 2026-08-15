const test = require('node:test')
const assert = require('node:assert/strict')

const {
  INVOICE_ITEM_NAME,
  INVOICE_TAX_CATEGORY,
  getInvoiceRequestBlockReason,
  isCorporateTransferPayment,
  isInvoicePaymentMethod
} = require('./index')

test('invoice tax classification and item are fixed for repair services', () => {
  assert.equal(INVOICE_TAX_CATEGORY, '修理修配劳务')
  assert.equal(INVOICE_ITEM_NAME, '牙科设备检修服务费')
})

test('wechat pay and corporate transfers enter the invoice workflow', () => {
  assert.equal(isCorporateTransferPayment('offline_transfer'), true)
  assert.equal(isCorporateTransferPayment('bank_transfer'), true)
  assert.equal(isInvoicePaymentMethod('wechat_pay'), true)
  assert.equal(isInvoicePaymentMethod('offline_transfer'), true)
  assert.equal(isInvoicePaymentMethod(''), false)
})

test('a paid corporate transfer can request a manual invoice', () => {
  assert.equal(getInvoiceRequestBlockReason({
    status: 'completed',
    payment_method: 'offline_transfer',
    payment_status: 'paid',
    total_price: 1280
  }), '')
})

test('canonical completed status is accepted when a display status is also present', () => {
  assert.equal(getInvoiceRequestBlockReason({
    status: '处理中',
    status_en: 'completed',
    payment_method: 'bank_transfer',
    payment_status: 'paid',
    total_price: 680
  }), '')
})

test('a paid WeChat Pay order can request a manual invoice', () => {
  assert.equal(getInvoiceRequestBlockReason({
    status: 'completed',
    payment_method: 'wechat_pay',
    payment_status: 'paid',
    total_price: 1280
  }), '')
})

test('unfinished corporate orders cannot request an invoice', () => {
  assert.equal(getInvoiceRequestBlockReason({
    status: 'shipped',
    payment_method: 'offline_transfer',
    payment_status: 'paid',
    total_price: 1280
  }), '检修服务完成并结单后才能申请开票')
})

test('completed corporate transfer must be confirmed before invoicing', () => {
  assert.equal(getInvoiceRequestBlockReason({
    status: 'completed',
    payment_method: 'offline_transfer',
    payment_status: 'uploaded',
    total_price: 1280
  }), '需财务先确认对公款项到账后才能开票')
})

test('completed WeChat Pay order must be confirmed before invoicing', () => {
  assert.equal(getInvoiceRequestBlockReason({
    status: 'completed',
    payment_method: 'wechat_pay',
    payment_status: 'pending',
    total_price: 1280
  }), '需先确认微信支付到账后才能开票')
})

test('zero-value corporate transfers do not enter the invoice workflow', () => {
  assert.equal(getInvoiceRequestBlockReason({
    status: 'completed',
    payment_method: 'offline_transfer',
    payment_status: 'paid',
    total_price: 0
  }), '开票金额需大于 0')
})
