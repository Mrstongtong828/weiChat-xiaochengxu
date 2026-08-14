import test from 'node:test'
import assert from 'node:assert/strict'
import { transformOrder } from './orderTransform.js'

test('admin order rows preserve the server-side delete eligibility reason', () => {
  const row = transformOrder({
    _id: 'order-1',
    order_no: 'DR202608140001',
    status: 'pending',
    delete_block_reason: '工单已有寄入快递单号，不能删除'
  })

  assert.equal(row.deleteBlockReason, '工单已有寄入快递单号，不能删除')
})
