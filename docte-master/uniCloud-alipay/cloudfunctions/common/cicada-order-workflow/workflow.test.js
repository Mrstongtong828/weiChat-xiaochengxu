const assert = require('node:assert/strict')
const test = require('node:test')

const { canTransitionOrderStatus, PERMISSIONS, hasRolePermission, getRepairStartBlockReason } = require('./index')

test('已签收设备可以不进入维修直接回寄', () => {
  assert.equal(canTransitionOrderStatus('received', 'shipped'), true)
})

test('超级管理员拥有全部工单权限', () => {
  Object.keys(PERMISSIONS).forEach(action => {
    assert.equal(hasRolePermission('superadmin', action), true, action)
  })
})

test('维修开始前必须完成报价、授权和付款/免付核验', () => {
  assert.equal(getRepairStartBlockReason({}), '维修前必须先确认维修方案')
  assert.equal(getRepairStartBlockReason({ quote_status: 'confirmed', authorization_status: 'confirmed', total_price: 100, payment_status: 'pending' }), '收费维修必须先确认款项到账')
  assert.equal(getRepairStartBlockReason({ quote_status: 'confirmed', authorization_status: 'confirmed', total_price: 0, payment_status: 'not_required', charge_type: 'free', in_warranty: true, warranty_status: 'in_warranty' }), '')
})

test('保修期内质保免费方案已发布为免付款时无需客户在线确认即可维修/回寄', () => {
  assert.equal(getRepairStartBlockReason({
    total_price: 0,
    payment_status: 'not_required',
    charge_type: 'free',
    in_warranty: true,
    warranty_status: 'in_warranty'
  }), '')
})

test('收费工单到账后无需客户在线确认即可维修/回寄', () => {
  assert.equal(getRepairStartBlockReason({
    total_price: 120,
    payment_status: 'paid',
    charge_type: 'paid'
  }), '')
})
