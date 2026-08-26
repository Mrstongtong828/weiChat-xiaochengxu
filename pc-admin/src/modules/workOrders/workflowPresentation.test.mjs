import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getRecommendedWorkflowTab,
  getWorkflowStageIndex,
  isRepairStageReady
} from './workflowPresentation.js'

test('keeps an issued paid quote on the quote tab until the customer is authorized', () => {
  const order = {
    status: '已签收',
    quoteStatus: 'issued',
    paymentStatus: 'pending',
    totalPrice: 580
  }

  assert.equal(getRecommendedWorkflowTab(order), 'quote')
  assert.equal(getWorkflowStageIndex(order), 2)
})

test('shows repair after a phone-confirmed customer authorization without changing order status', () => {
  const order = {
    status: '已签收',
    quoteStatus: 'confirmed',
    authorizationStatus: 'confirmed',
    paymentStatus: 'pending',
    totalPrice: 580
  }

  assert.equal(isRepairStageReady(order), true)
  assert.equal(getRecommendedWorkflowTab(order), 'repair')
  assert.equal(getWorkflowStageIndex(order), 3)
})

test('shows repair for a verified warranty-free quote without a separate payment step', () => {
  const order = {
    status: '已签收',
    quoteStatus: 'issued',
    paymentStatus: 'not_required',
    chargeType: 'free',
    inWarranty: true,
    warrantyStatus: 'in_warranty'
  }

  assert.equal(isRepairStageReady(order), true)
  assert.equal(getRecommendedWorkflowTab(order), 'repair')
  assert.equal(getWorkflowStageIndex(order), 3)
})

test('keeps returned orders at the return stage', () => {
  assert.equal(getWorkflowStageIndex({ status: '已回寄', returnNo: 'SF1234567890' }), 4)
})
