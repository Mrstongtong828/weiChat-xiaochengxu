import test from 'node:test'
import assert from 'node:assert/strict'
import { preserveOrderSnapshot, preserveReceivedOrderSnapshot } from './orderListSnapshot.js'

test('preserves a just-confirmed return shipment over a stale list row', () => {
  const snapshot = {
    _id: 'order-1',
    statusEn: 'shipped',
    status: '已回寄',
    returnCompany: '顺丰速运',
    returnNo: 'SF1234567890',
    updateTime: '2026/08/27 01:35:00'
  }
  const staleRows = [{
    _id: 'order-1',
    statusEn: 'fixing',
    status: '处理中',
    updateTime: '2026/08/27 01:34:00'
  }]

  assert.deepEqual(preserveOrderSnapshot(staleRows, snapshot), [snapshot])
})

test('does not replace a later completed row with an older shipment snapshot', () => {
  const completedRows = [{ _id: 'order-1', statusEn: 'completed', status: '已完成' }]
  const shipmentSnapshot = { _id: 'order-1', statusEn: 'shipped', status: '已回寄', returnNo: 'SF1234567890' }

  assert.equal(preserveOrderSnapshot(completedRows, shipmentSnapshot), completedRows)
})

test('preserves a confirmed receipt over a stale inbound row', () => {
  const rows = [{ _id: 'order-1', statusEn: 'sent', status: '运输中' }]
  const snapshot = { _id: 'order-1', statusEn: 'received', status: '已签收' }

  assert.deepEqual(preserveReceivedOrderSnapshot(rows, snapshot), [snapshot])
})

test('returns rows unchanged when no receipt snapshot is provided', () => {
  const rows = [{ _id: 'order-1', statusEn: 'sent', status: '运输中' }]

  assert.equal(preserveReceivedOrderSnapshot(rows, null), rows)
})

test('preserves a phone-confirmed authorization when a same-status list response is stale', () => {
  const rows = [{
    _id: 'order-1',
    statusEn: 'received',
    quoteStatus: 'issued',
    authorizationStatus: '',
    updateTime: '2026/08/27 01:34:00'
  }]
  const snapshot = {
    _id: 'order-1',
    statusEn: 'received',
    quoteStatus: 'confirmed',
    authorizationStatus: 'confirmed',
    updateTime: '2026/08/27 01:35:00'
  }

  assert.deepEqual(preserveOrderSnapshot(rows, snapshot), [snapshot])
})
