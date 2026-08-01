const assert = require('node:assert/strict')
const test = require('node:test')

global.uniCloud = { database: () => ({}) }

const { resolvePackageAccess } = require('./index.obj').__test__

test('工单所有者可以查询并查看完整物流详情', () => {
  assert.deepEqual(resolvePackageAccess(true, false), { allowed: true, fullAccess: true })
})

test('手机号后四位匹配只能查询脱敏物流详情', () => {
  assert.deepEqual(resolvePackageAccess(false, true), { allowed: true, fullAccess: false })
})

test('无所有权且手机号后四位不匹配时不返回物流', () => {
  assert.deepEqual(resolvePackageAccess(false, false), { allowed: false, fullAccess: false })
})
