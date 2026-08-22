import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveOrderFaultFallback, resolveRepairFaultDescription } from './repairRecordDefaults.js'

test('customer fault description becomes the editable repair default', () => {
  assert.equal(
    resolveRepairFaultDescription({ fault_desc: '有时转、有时不转，注油后仍不正常' }),
    '有时转、有时不转，注油后仍不正常'
  )
})

test('saved engineer description takes priority over the customer wording', () => {
  assert.equal(
    resolveRepairFaultDescription({
      fault: '马达间歇性停转，清洁注油后故障仍存在',
      fault_desc: '有时转有时不转'
    }),
    '马达间歇性停转，清洁注油后故障仍存在'
  )
})

test('legacy order-level customer fault is only used for the first product', () => {
  const order = { fault: '客户反馈设备间歇性停转' }

  assert.equal(resolveOrderFaultFallback(order, 0), '客户反馈设备间歇性停转')
  assert.equal(resolveOrderFaultFallback(order, 1), '')
})
