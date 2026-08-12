const assert = require('node:assert/strict')
const test = require('node:test')

const {
  DEFAULT_PRODUCT_WARRANTY_MONTHS,
  appendWarrantyExtension,
  buildRepairWarrantyExtension,
  computeWarrantyState,
  getBaseWarrantyExpire,
  isFreeCoverageReason
} = require('./index')

test('uses invoice date first and defaults the unified warranty to 12 months', () => {
  assert.equal(DEFAULT_PRODUCT_WARRANTY_MONTHS, 12)
  assert.equal(getBaseWarrantyExpire({ invoice_received_date: '2026-01-15' }), '2027-01-15')
  assert.equal(getBaseWarrantyExpire({ invoice_received_date: '2026-01-15', warranty_months: 60 }), '2027-01-15')
  assert.equal(getBaseWarrantyExpire({ invoice_received_date: '2024-02-29' }), '2025-02-28')
  assert.equal(getBaseWarrantyExpire({ invoice_received_date: '2025-02-30' }), '')
  assert.equal(getBaseWarrantyExpire({
    invoice_received_date: '2026-01-15',
    warranty_expire: '2026-09-30'
  }), '2026-09-30')
})

test('falls back to factory date plus 30 days and honors an active repair extension', () => {
  assert.equal(getBaseWarrantyExpire({ manufacture_date: '2025-01-01' }), '2026-01-31')
  const state = computeWarrantyState({
    manufacture_date: '2024-01-01',
    ext_warranty: [{ order_id: 'R1', scope: 'same_fault_same_replaced_part', new_expire: '2026-08-31' }]
  }, new Date('2026-08-11T12:00:00').getTime())
  assert.deepEqual({ status: state.warranty_status, expire: state.expire }, { status: 'expired', expire: '2025-01-31' })
  const matched = computeWarrantyState({
    manufacture_date: '2024-01-01',
    repair_warranty_match: true,
    ext_warranty: [{ order_id: 'R1', scope: 'same_fault_same_replaced_part', new_expire: '2026-08-31' }]
  }, new Date('2026-08-11T12:00:00').getTime())
  assert.deepEqual({ status: matched.warranty_status, expire: matched.expire }, { status: 'extended', expire: '2026-08-31' })
})

test('creates one scoped three-month extension only for paid repairs with replacement parts', () => {
  const extension = buildRepairWarrantyExtension({
    _id: 'order-1',
    order_no: 'R-1',
    total_price: 100,
    payment_status: 'paid',
    quote_warranty_months: 60,
    quote_detail: { parts: [{ part_code: 'P-1', name: '主板', quantity: 1, device_sn: 'SN-1', warranty_eligible: true }] }
  }, [{ sn: 'SN-1', fault_desc: '无输出' }], new Date('2026-08-11T12:00:00').getTime())
  assert.equal(extension.new_expire, '2026-11-11')
  assert.equal(extension.months, 3)
  assert.equal(extension.scope, 'same_fault_same_replaced_part')
  assert.equal(buildRepairWarrantyExtension({ total_price: 0, payment_status: 'not_required', quote_detail: { parts: [{ name: '主板', quantity: 1, warranty_eligible: true }] } }, [{ sn: 'SN-1' }]), null)
  assert.equal(appendWarrantyExtension([extension], extension).length, 1)
})

test('free coverage requires an original quality issue or a manually matched repair warranty', () => {
  assert.equal(isFreeCoverageReason('quality_issue'), true)
  assert.equal(isFreeCoverageReason('repair_warranty'), true)
  assert.equal(isFreeCoverageReason('human_damage'), false)
  assert.equal(isFreeCoverageReason(''), false)
})

test('multi-device repair extensions only include eligible parts assigned to that device', () => {
  const order = {
    _id: 'order-2',
    total_price: 200,
    payment_status: 'paid',
    quote_detail: {
      parts: [
        { part_code: 'A', name: '主板', quantity: 1, device_sn: 'SN-A', warranty_eligible: true },
        { part_code: 'B', name: '电机', quantity: 1, device_sn: 'SN-B', warranty_eligible: true },
        { part_code: 'C', name: '第三方件', quantity: 1, device_sn: 'SN-A', warranty_eligible: false }
      ]
    }
  }
  const extension = buildRepairWarrantyExtension(order, [{ sn: 'sn-a', fault_desc: '无输出' }], new Date('2026-08-11T12:00:00').getTime())
  assert.deepEqual(extension.part_codes, ['A'])
  assert.equal(extension.device_sn, 'sn-a')
  assert.equal(buildRepairWarrantyExtension(order, [{ sn: 'SN-C' }]), null)
})
