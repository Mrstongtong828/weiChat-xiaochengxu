const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildInboundLifecycleUpdate,
  findTrackingMatches,
  reconcileTrackCache,
  shouldNotifyInboundDelivery
} = require('./logistics-lifecycle')

test('较旧的回调不能覆盖较新的签收轨迹', () => {
  const existing = { trackingNo: 'SF1', state: '3', status: '已签收', lastTrackAt: '2026-07-29 12:00:00', source: 'push' }
  const incoming = { trackingNo: 'SF1', state: '0', status: '运输中', lastTrackAt: '2026-07-29 10:00:00', source: 'push' }
  const result = reconcileTrackCache(existing, incoming)
  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'stale')
  assert.equal(result.cache.state, '3')
})

test('重复推送不触发重复落库', () => {
  const cache = { trackingNo: 'SF1', state: '3', lastTrackAt: '2026-07-29 12:00:00', source: 'push', tracks: [{ time: '2026-07-29 12:00:00', desc: '已签收' }] }
  const result = reconcileTrackCache(cache, { ...cache })
  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'duplicate')
})

test('新轨迹保留原有订阅状态', () => {
  const existing = { trackingNo: 'SF1', state: '1', lastTrackAt: '2026-07-29 09:00:00', subscriptionStatus: 'subscribed', subscribedAt: 123 }
  const incoming = { trackingNo: 'SF1', state: '3', lastTrackAt: '2026-07-29 12:00:00', source: 'push' }
  const result = reconcileTrackCache(existing, incoming)
  assert.equal(result.accepted, true)
  assert.equal(result.cache.state, '3')
  assert.equal(result.cache.subscriptionStatus, 'subscribed')
  assert.equal(result.cache.subscribedAt, 123)
})

test('只有寄入物流首次进入签收状态时触发客户通知', () => {
  assert.equal(shouldNotifyInboundDelivery('out', { state: '1' }, { state: '3' }), true)
  assert.equal(shouldNotifyInboundDelivery('out', { state: '3' }, { state: '3' }), false)
  assert.equal(shouldNotifyInboundDelivery('back', { state: '1' }, { state: '3' }), false)
  assert.equal(shouldNotifyInboundDelivery('out', { state: '1' }, { state: '0' }), false)
})

test('物流签收只标记待入库，不直接把工单改为已签收', () => {
  const update = buildInboundLifecycleUpdate({ status: 'sent', timeline: [] }, {
    state: '3',
    lastTrackAt: '2026-07-29 12:00:00'
  }, 456)
  assert.equal(update.status, undefined)
  assert.equal(update.arrival_confirm_status, 'pending')
  assert.equal(update.timeline.at(-1).title, '物流已签收，待确认入库')
})

test('人工已经确认入库后，晚到的签收回调保持已确认', () => {
  const update = buildInboundLifecycleUpdate({ status: 'received', timeline: [] }, {
    state: '3',
    lastTrackAt: '2026-07-29 12:00:00'
  }, 456)
  assert.equal(update.status, undefined)
  assert.equal(update.arrival_confirm_status, 'confirmed')
})

test('运单匹配会识别跨工单和跨物流段歧义', () => {
  const matches = findTrackingMatches([
    { _id: 'order-1', ship_out_info: { logistics_no: 'YT1234567890' } },
    { _id: 'order-2', ship_back_info: { returnNo: 'YT1234567890' } }
  ], 'YT1234567890')
  assert.deepEqual(matches.map(item => item.order._id + ':' + item.segment), ['order-1:out', 'order-2:back'])
})
