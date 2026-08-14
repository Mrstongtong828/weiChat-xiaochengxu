import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getSubscriptionScenesForAction,
  selectSubscriptionTemplateIds
} from './subscription-prompt.js'

test('报修提交同时申请受理、签收和报价模板', () => {
  assert.deepEqual(getSubscriptionScenesForAction('repair_submit'), [
    'repair_submit',
    'device_receive_ship',
    'payment_quote'
  ])
})

test('报价决定和质保确认申请回寄物流模板', () => {
  assert.deepEqual(getSubscriptionScenesForAction('quote_reject'), ['device_receive_ship'])
  assert.deepEqual(getSubscriptionScenesForAction('warranty_confirm'), ['device_receive_ship'])
})

test('支付动作补充支付结果和回寄物流模板授权', () => {
  assert.deepEqual(getSubscriptionScenesForAction('wechat_pay'), ['payment_quote', 'device_receive_ship'])
  assert.deepEqual(getSubscriptionScenesForAction('payment_proof'), ['payment_quote', 'device_receive_ship'])
})

test('按动作筛选已配置模板并去重', () => {
  const templates = [
    { scene: 'repair_submit', templateId: 'repair-id' },
    { scene: 'device_receive_ship', templateId: 'ship-id' },
    { scene: 'payment_quote', templateId: 'quote-id' },
    { scene: 'payment_quote', templateId: 'quote-id' },
    { scene: 'process_tip', templateId: 'process-id' }
  ]
  assert.deepEqual(selectSubscriptionTemplateIds(templates, 'repair_submit'), [
    'repair-id',
    'ship-id',
    'quote-id'
  ])
  assert.deepEqual(selectSubscriptionTemplateIds(templates, 'unknown'), [])
})
