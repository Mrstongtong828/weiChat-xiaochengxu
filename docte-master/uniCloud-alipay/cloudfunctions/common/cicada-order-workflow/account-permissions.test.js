const assert = require('node:assert/strict')
const test = require('node:test')

const {
  ALL_PERMISSION_KEYS,
  ROLE_PERMISSION_TEMPLATES,
  getEffectivePermissions,
  getPermissionCatalogForManager,
  hasUserPermission,
  sanitizePermissions
} = require('./index')

test('管理员始终拥有目录中的全部权限', () => {
  assert.deepEqual(getEffectivePermissions({ role: 'admin', permissions: [] }), ALL_PERMISSION_KEYS)
  assert.deepEqual(getEffectivePermissions({ role: 'superadmin' }), ALL_PERMISSION_KEYS)
})

test('旧维修账号按新模板只能维修和查看配件', () => {
  const permissions = getEffectivePermissions({ role: 'engineer' })
  assert.equal(permissions.includes('edit_repair_record'), true)
  assert.equal(permissions.includes('view_inventory'), true)
  assert.equal(permissions.includes('issue_quote'), false)
  assert.equal(permissions.includes('edit_inventory'), false)
  assert.equal(permissions.includes('export_customer'), false)
})

test('客服模板可处理签收与回寄但不能报价和导出', () => {
  const permissions = getEffectivePermissions({ role: 'support' })
  for (const key of ['confirm_inbound_arrival', 'edit_received_parts', 'confirm_received_parts', 'edit_repair_record', 'record_return_logistics']) {
    assert.equal(permissions.includes(key), true, key)
  }
  assert.equal(permissions.includes('issue_quote'), false)
  assert.equal(permissions.includes('export_customer'), false)
  assert.equal(permissions.includes('export_order'), false)
})

test('账号权限数组是明确覆盖，空数组不会回退到角色模板', () => {
  assert.deepEqual(getEffectivePermissions({ role: 'support', permissions: [] }), [])
  assert.deepEqual(getEffectivePermissions({ role: 'support', permissions: ['view_order'] }), ['view_order'])
})

test('非法和重复权限会被过滤', () => {
  assert.deepEqual(sanitizePermissions(['view_order', 'unknown', 'view_order', '', null]), ['view_order'])
})

test('权限目录只暴露安全元数据和角色模板', () => {
  const catalog = getPermissionCatalogForManager()
  assert.equal(Array.isArray(catalog.groups), true)
  assert.deepEqual(catalog.roleTemplates.support, ROLE_PERMISSION_TEMPLATES.support)
  assert.equal(catalog.groups.some(group => group.permissions.some(item => item.key === 'edit_staff')), true)
  assert.equal(hasUserPermission({ role: 'support', permissions: ['view_order'] }, 'issue_quote'), false)
})

test('库存与账号管理的高风险动作可分别授权', () => {
  const keys = new Set(ALL_PERMISSION_KEYS)
  ;[
    'stock_in_inventory', 'stock_out_inventory', 'adjust_inventory',
    'view_staff', 'create_staff', 'edit_staff', 'toggle_staff', 'reset_staff_password'
  ].forEach(key => assert.equal(keys.has(key), true, `缺少权限键 ${key}`))

  const inboundOnly = { role: 'support', permissions: ['view_inventory', 'stock_in_inventory'] }
  assert.equal(hasUserPermission(inboundOnly, 'stock_in_inventory'), true)
  assert.equal(hasUserPermission(inboundOnly, 'stock_out_inventory'), false)
  assert.equal(hasUserPermission(inboundOnly, 'adjust_inventory'), false)
})

test('后台维护人员默认只开放后台内容维护与基础查询', () => {
  const permissions = getEffectivePermissions({ role: 'maintenance' })
  for (const key of [
    'view_dashboard', 'get_stats', 'get_workflow_config', 'view_order',
    'view_inventory', 'view_customer', 'manage_kb', 'manage_settings'
  ]) {
    assert.equal(permissions.includes(key), true, key)
  }
  for (const key of [
    'issue_quote', 'confirm_payment', 'export_order', 'export_customer',
    'adjust_inventory', 'view_staff', 'edit_staff'
  ]) {
    assert.equal(permissions.includes(key), false, key)
  }
})
