import assert from 'node:assert/strict'
import test from 'node:test'

import { countStatusBreakdown, countStatusBuckets, deriveDisplayStatus, getRepairProgressNodes, getStatusBucket, isWarrantyFreeOrderSnapshot } from './statusMeta.js'

test('待处理工单显示为待寄出，同时保留报修已提交的进度节点', () => {
  assert.equal(deriveDisplayStatus({ status: 'pending' }), '待寄出')
  assert.equal(getRepairProgressNodes({ id: 'R001', statusKey: 'pending' })[0].label, '报修已提交')
})

test('检测中的工单提醒用户订单正在处理中', () => {
  assert.equal(getStatusBucket({ status: 'inspecting' }), 'fixing')
  assert.deepEqual(countStatusBuckets([{ status: 'inspecting' }]), {
    all: 1,
    pending: 0,
    fixing: 1,
    shipped: 0
  })
})

test('结束的工单保留在全部记录中但不产生状态提醒', () => {
  assert.deepEqual(countStatusBuckets([
    { status: 'completed' },
    { status: 'cancelled' }
  ]), {
    all: 2,
    pending: 0,
    fixing: 0,
    shipped: 0
  })
})

test('原始状态统计不受旧版汇总字段影响', () => {
  assert.deepEqual(countStatusBreakdown({
    pending: 1,
    inspecting: 2,
    fixing: 1,
    completed: 4,
    cancelled: 1
  }), {
    all: 9,
    pending: 1,
    fixing: 3,
    shipped: 0
  })
})

test('paid and warranty-free orders advance to the repair stage', () => {
  const paidNodes = getRepairProgressNodes({ id: 'R002', statusKey: 'inspecting', paymentStatus: 'paid' })
  const warrantyNodes = getRepairProgressNodes({ id: 'R003', statusKey: 'inspecting', payment_status: 'not_required' })

  assert.equal(paidNodes[2].state, 'current')
  assert.equal(warrantyNodes[2].state, 'current')
})

test('付费工单在财务确认到账前不提前进入维修进度', () => {
  const nodes = getRepairProgressNodes({
    id: 'R004', statusKey: 'fixing', quoteStatus: 'confirmed', paymentStatus: 'uploaded', totalFee: 100
  })

  assert.equal(nodes[1].state, 'current')
  assert.equal(nodes[2].state, 'pending')
})

test('客户选择不维修后显示待回寄而不是待付款或维修中', () => {
	assert.equal(deriveDisplayStatus({ status: 'received', quoteStatus: 'rejected' }), '不维修待回寄')
	assert.equal(deriveDisplayStatus({ status: 'fixing', quote_status: 'rejected' }), '不维修待回寄')
})

test('质保免费方案发布为免付款即视为确认，不进入付款状态', () => {
	const warrantyFree = {
		status: 'fixing',
		chargeType: 'free',
		inWarranty: true,
		warrantyStatus: 'in_warranty',
		totalFee: 0,
		paymentStatus: 'not_required'
	}

	assert.equal(deriveDisplayStatus({ ...warrantyFree, quoteStatus: 'issued' }), '维修中')
	assert.equal(deriveDisplayStatus({ ...warrantyFree, quoteStatus: 'confirmed' }), '维修中')
})

test('只有后端确认无需付款的零元质保方案才按免费流程展示', () => {
	const snapshot = {
		chargeType: 'free',
		inWarranty: true,
		warrantyStatus: 'in_warranty',
		totalFee: 0,
		paymentStatus: 'not_required',
		quoteStatus: 'issued'
	}

	assert.equal(isWarrantyFreeOrderSnapshot(snapshot), true)
	assert.equal(isWarrantyFreeOrderSnapshot({ ...snapshot, totalFee: 88 }), false)
	assert.equal(isWarrantyFreeOrderSnapshot({ ...snapshot, paymentStatus: 'pending' }), false)
	assert.equal(isWarrantyFreeOrderSnapshot({ ...snapshot, paymentStatus: '' }), false)
	assert.equal(isWarrantyFreeOrderSnapshot({ ...snapshot, quoteStatus: 'rejected' }), false)
	assert.equal(isWarrantyFreeOrderSnapshot({ ...snapshot, quoteStatus: 'confirmed' }), true)
})
