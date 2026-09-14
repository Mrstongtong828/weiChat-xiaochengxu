import test from 'node:test'
import assert from 'node:assert/strict'
import { transformOrder, transformOrders } from './orderTransform.js'

test('admin order rows preserve the server-side delete eligibility reason', () => {
  const row = transformOrder({
    _id: 'order-1',
    order_no: 'DR202608140001',
    status: 'pending',
    delete_block_reason: '工单已有寄入快递单号，不能删除'
  })

  assert.equal(row.deleteBlockReason, '工单已有寄入快递单号，不能删除')
})

test('收件日期使用签收时间并按签收日期倒序排列', () => {
  const rows = transformOrders([
    { _id: 'old', order_no: 'OLD', status: 'received', create_time: 3000, arrival_confirmed_at: '2026-08-10T10:00:00+08:00' },
    { _id: 'new', order_no: 'NEW', status: 'received', create_time: 1000, arrival_confirmed_at: '2026-08-12T10:00:00+08:00' }
  ])

  assert.deepEqual(rows.map(row => row.id), ['NEW', 'OLD'])
  assert.equal(rows[0].receivedDate, '2026-08-12')
})
