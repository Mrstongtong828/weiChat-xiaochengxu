import test from 'node:test'
import assert from 'node:assert/strict'

import { ADMIN_NAV_ITEMS, getAdminRoleKey, getAdminRoleLabel, getFirstAccessibleAdminNav } from './adminCatalog.js'

test('navigation catalog keeps routes, menu labels and permissions in one record', () => {
  const workorders = ADMIN_NAV_ITEMS.find(item => item.key === 'workorder')
  assert.deepEqual(
    { path: workorders.path, title: workorders.title, permission: workorders.permission, sidebar: workorders.sidebar },
    { path: 'workorder', title: '报修工单处理中心', permission: 'view_order', sidebar: true }
  )
  assert.equal(getFirstAccessibleAdminNav(permission => permission === 'view_inventory'), 'inventory')
})

test('role catalog provides stable key and label conversion', () => {
  assert.equal(getAdminRoleLabel('maintenance'), '后台维护人员')
  assert.equal(getAdminRoleKey('后台维护人员'), 'maintenance')
  assert.equal(getAdminRoleKey('未知角色', 'engineer'), 'engineer')
})
