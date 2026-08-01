const assert = require('node:assert/strict')
const test = require('node:test')
const {
  assertPaymentProofAllowed,
  normalizePaymentProof
} = require('./index')

test('rejects uploading a transfer proof after WeChat payment is paid', () => {
  assert.throws(() => assertPaymentProofAllowed({
    status: 'fixing',
    payment_status: 'paid',
    total_price: 100
  }), /已支付/)
})

test('rejects uploading a transfer proof without a payable quote', () => {
  for (const quoteStatus of ['pending', 'draft', 'rejected']) {
    assert.throws(() => assertPaymentProofAllowed({
      status: 'fixing',
      quote_status: quoteStatus,
      payment_status: 'pending',
      total_price: 100
    }), /可支付报价/)
  }
})

test('rejects duplicate proof uploads while finance verification is pending', () => {
  assert.throws(() => assertPaymentProofAllowed({
    status: 'fixing',
    quote_status: 'confirmed',
    payment_status: 'uploaded',
    total_price: 100
  }), /等待核销/)
})

test('allows a rejected transfer proof to be uploaded again', () => {
  assert.doesNotThrow(() => assertPaymentProofAllowed({
    status: 'fixing',
    quote_status: 'confirmed',
    payment_status: 'rejected',
    total_price: 100
  }))
})

test('rejects local temporary paths as payment proof authority', () => {
  assert.throws(() => normalizePaymentProof({
    path: 'wxfile://tmp/payment-proof.jpg',
    url: 'wxfile://tmp/payment-proof.jpg'
  }), /云文件/)
})

test('normalizes a cloud payment proof without persisting local preview fields', () => {
  const result = normalizePaymentProof({
    id: 'pay-1',
    fileID: 'cloud://env.bucket/payment-proof.jpg',
    path: 'wxfile://tmp/payment-proof.jpg',
    previewUrl: 'wxfile://tmp/payment-proof.jpg',
    time: '2026-07-28'
  }, 1785196800000)

  assert.deepEqual(result, {
    id: 'pay-1',
    url: 'cloud://env.bucket/payment-proof.jpg',
    fileID: 'cloud://env.bucket/payment-proof.jpg',
    time: '2026-07-28',
    create_time: 1785196800000
  })
})
