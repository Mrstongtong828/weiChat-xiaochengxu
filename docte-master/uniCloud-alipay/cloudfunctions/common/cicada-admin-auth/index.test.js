const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createAdminAuthError,
  toAdminErrorResponse,
  normalizeAdminAuthResult
} = require('./index')

test('maps explicit and legacy authentication failures to 401', () => {
  assert.deepEqual(
    toAdminErrorResponse(createAdminAuthError('鉴权失败：Token已过期')),
    { code: 401, msg: '鉴权失败：Token已过期' }
  )
  assert.deepEqual(
    normalizeAdminAuthResult({ code: -1, msg: 'Token已过期' }),
    { code: 401, msg: 'Token已过期' }
  )
})

test('keeps ordinary business and permission errors unchanged', () => {
  assert.deepEqual(toAdminErrorResponse(new Error('工单状态不正确')), { code: -1, msg: '工单状态不正确' })
  assert.deepEqual(
    normalizeAdminAuthResult({ code: -1, msg: '无权限执行该操作' }),
    { code: -1, msg: '无权限执行该操作' }
  )
})
