import assert from 'node:assert/strict'
import test from 'node:test'

import { summarizePaymentStage } from './paymentSummary.js'

test('summarizes payable orders between receipt and return shipment', () => {
  const summary = summarizePaymentStage([
    { statusEn: 'received', totalPrice: 300, paymentStatus: 'pending' },
    { statusEn: 'inspecting', totalPrice: 120, paymentStatus: 'uploaded' },
    { statusEn: 'fixing', totalPrice: 500, paymentStatus: 'paid' },
    { statusEn: 'fixing', totalPrice: 0, paymentStatus: 'not_required' },
    { statusEn: 'received', totalPrice: 0, paymentStatus: 'pending' },
    { statusEn: 'shipped', totalPrice: 200, paymentStatus: 'paid' }
  ])

  assert.deepEqual(summary, { pending: 2, paid: 1 })
})
