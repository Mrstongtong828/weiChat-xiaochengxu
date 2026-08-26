import test from 'node:test'
import assert from 'node:assert/strict'

import { needsReceivedPartsStatusSync, selectPreferredDrawerStatus } from './receivedPartsStatus.js'

test('confirmed received parts recover a stale submitted order before other transitions', () => {
  const order = {
    status: '已提交',
    statusEn: 'pending',
    receivedPartsReceipt: { status: 'confirmed' }
  }

  assert.equal(needsReceivedPartsStatusSync(order), true)
  assert.equal(selectPreferredDrawerStatus({
    order,
    allowedStatuses: ['运输中', '已签收', '已取消'],
    activeTab: 'return'
  }), '已签收')
})

test('confirmed received parts recover a stale transported order', () => {
  assert.equal(needsReceivedPartsStatusSync({
    statusEn: 'sent',
    received_parts_receipt: { status: 'confirmed' }
  }), true)
})

test('return tab prefers return shipment after receipt status is synchronized', () => {
  const order = {
    status: '已签收',
    statusEn: 'received',
    receivedPartsReceipt: { status: 'confirmed' }
  }

  assert.equal(needsReceivedPartsStatusSync(order), false)
  assert.equal(selectPreferredDrawerStatus({
    order,
    allowedStatuses: ['检测中', '处理中', '已回寄', '已取消'],
    activeTab: 'return'
  }), '已回寄')
})

test('ordinary orders keep the first workflow transition', () => {
  assert.equal(selectPreferredDrawerStatus({
    order: { status: '已提交', statusEn: 'pending' },
    allowedStatuses: ['运输中', '已签收', '已取消'],
    activeTab: 'base'
  }), '运输中')
})
