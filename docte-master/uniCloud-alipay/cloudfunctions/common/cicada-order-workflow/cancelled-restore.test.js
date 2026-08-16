const test = require('node:test')
const assert = require('node:assert/strict')

const { getCancelledOrderRestoreStatus } = require('./index')

test('restores from the status saved when an administrator cancelled the order', () => {
  assert.equal(getCancelledOrderRestoreStatus({
    status: 'cancelled',
    cancelled_from_status: 'fixing'
  }), 'fixing')
})

test('restores legacy orders from an administrator status-change event', () => {
  assert.equal(getCancelledOrderRestoreStatus(
    { status: 'cancelled' },
    [{ action: 'update_status', before: { status: 'received' }, after: { status: 'cancelled' } }]
  ), 'received')
})

test('does not restore a customer rejection without an administrator cancellation marker', () => {
  assert.equal(getCancelledOrderRestoreStatus(
    { status: 'cancelled', quote_status: 'rejected' },
    [{ action: 'reject_quote', before: { status: 'pending' }, after: { status: 'cancelled' } }]
  ), '')
})

test('does not restore terminal or invalid saved statuses', () => {
  assert.equal(getCancelledOrderRestoreStatus({
    status: 'cancelled',
    cancelled_from_status: 'completed'
  }), '')
})
