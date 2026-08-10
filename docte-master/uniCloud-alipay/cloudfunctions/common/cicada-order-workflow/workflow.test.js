const assert = require('node:assert/strict')
const test = require('node:test')

const { canTransitionOrderStatus } = require('./index')

test('已签收设备可以不进入维修直接回寄', () => {
  assert.equal(canTransitionOrderStatus('received', 'shipped'), true)
})
