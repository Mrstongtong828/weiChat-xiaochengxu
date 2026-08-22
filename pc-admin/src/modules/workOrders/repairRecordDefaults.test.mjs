import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveRepairFaultDescription } from './repairRecordDefaults.js'

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
