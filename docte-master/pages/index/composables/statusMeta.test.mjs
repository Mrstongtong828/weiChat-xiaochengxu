import assert from 'node:assert/strict'
import test from 'node:test'

import { countStatusBreakdown, countStatusBuckets, deriveDisplayStatus, getRepairProgressNodes, getStatusBucket } from './statusMeta.js'

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
