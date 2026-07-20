const test = require('node:test')
const assert = require('node:assert/strict')

const { createAdminAuthError, toAdminErrorResponse } = require('./auth-error')

test('maps explicit admin authentication errors to business code 401', () => {
  const response = toAdminErrorResponse(createAdminAuthError('鉴权失败：Token已过期'))
  assert.deepEqual(response, { code: 401, msg: '鉴权失败：Token已过期' })
})

test('keeps ordinary cloud-object errors on business code -1', () => {
  const response = toAdminErrorResponse(new Error('工单状态不正确'))
  assert.deepEqual(response, { code: -1, msg: '工单状态不正确' })
})

test('recognizes legacy authentication errors by message during rollout', () => {
  const response = toAdminErrorResponse(new Error('鉴权失败：非管理人员禁止访问该接口'))
  assert.equal(response.code, 401)
})
