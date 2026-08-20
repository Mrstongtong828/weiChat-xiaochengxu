import assert from 'node:assert/strict'
import test from 'node:test'

import { getRoleCompatibilityError, getStoredPermissions, hasPermission, savePermissionSession, shouldDisplayLocalError } from './permissions.js'

const createStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  }
}

test('管理员始终通过前端权限门禁', () => {
  const storage = createStorage({ adminUser: JSON.stringify({ role: 'admin', permissions: [] }) })
  assert.equal(hasPermission('manage_staff', storage), true)
})

test('普通员工只通过账号已保存的权限', () => {
  const storage = createStorage({ adminUser: JSON.stringify({ role: 'support', permissions: ['view_order'] }) })
  assert.equal(hasPermission('view_order', storage), true)
  assert.equal(hasPermission('issue_quote', storage), false)
})

test('刷新权限时保留账号资料并替换旧权限', () => {
  const storage = createStorage({ adminUser: JSON.stringify({ _id: 'u1', name: '客服一', role: 'support', permissions: ['view_order'] }) })
  const next = savePermissionSession({ role: 'support', permissions: [] }, storage)
  assert.equal(next.name, '客服一')
  assert.deepEqual(getStoredPermissions(storage), [])
})

test('新角色未出现在后端权限目录时提示先部署云函数', () => {
  const catalog = { roleTemplates: { engineer: ['view_order'] } }
  assert.match(getRoleCompatibilityError('maintenance', catalog), /后台云函数/)
  assert.equal(getRoleCompatibilityError('engineer', catalog), '')
})

test('请求层已经提示的错误不在页面重复弹出', () => {
  assert.equal(shouldDisplayLocalError({ __displayed: true }), false)
  assert.equal(shouldDisplayLocalError(new Error('本地错误')), true)
})
