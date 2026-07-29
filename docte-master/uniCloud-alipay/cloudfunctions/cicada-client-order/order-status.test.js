const assert = require('node:assert/strict')
const test = require('node:test')

const { getMiniStatusBucket } = require('./order-status')

test('云端把检测中和维修中的工单统一统计为处理中', () => {
  assert.equal(getMiniStatusBucket('inspecting'), 'fixing')
  assert.equal(getMiniStatusBucket('fixing'), 'fixing')
})

test('云端不为结束的工单生成待办角标', () => {
  assert.equal(getMiniStatusBucket('completed'), '')
  assert.equal(getMiniStatusBucket('cancelled'), '')
})
