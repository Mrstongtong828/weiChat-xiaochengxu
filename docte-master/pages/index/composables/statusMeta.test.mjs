import assert from 'node:assert/strict'
import test from 'node:test'

import { countStatusBreakdown, countStatusBuckets, getRepairProgressNodes, getStatusBucket } from './statusMeta.js'

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

test('付费工单在财务确认到账前不提前进入维修进度', () => {
  const nodes = getRepairProgressNodes({
    id: 'order-1', statusKey: 'fixing', quoteStatus: 'confirmed', paymentStatus: 'uploaded', totalFee: 100
  })
  assert.equal(nodes[1].state, 'current')
  assert.equal(nodes[2].state, 'pending')
})
