import test from 'node:test'
import assert from 'node:assert/strict'

import { createManualOrderDraft, prepareManualOrderSubmission } from './manualOrder.js'

test('manual order submission validates, syncs shipping and removes view-only item state', () => {
  const draft = createManualOrderDraft({ today: '2026-08-20', createKey: () => 'device-1' })
  Object.assign(draft.customer, {
    customer_type: 'clinic',
    name: '示例牙科',
    contact: '张医生',
    phone: '13800138000',
    address: '杭州市示例路 1 号'
  })
  Object.assign(draft.items[0], {
    product_name: '高速手机',
    product_model: 'HS-1',
    sn: 'SN001',
    fault_desc: '异响',
    lookupLoading: true
  })

  const result = prepareManualOrderSubmission(draft, value => value)

  assert.equal(result.error, '')
  assert.equal(result.payload.ship_out_info.name, '张医生')
  assert.equal(result.payload.ship_out_info.received_at, '2026-08-20')
  assert.equal(result.payload.items[0].warranty_months, 12)
  assert.equal('key' in result.payload.items[0], false)
  assert.equal('lookupLoading' in result.payload.items[0], false)
})
