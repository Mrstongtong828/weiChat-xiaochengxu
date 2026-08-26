export const getStoredAdminUser = (storage = globalThis.localStorage) => {
  try {
    return JSON.parse(storage?.getItem('adminUser') || '{}') || {}
  } catch (error) {
    return {}
  }
}

export const getStoredPermissions = (storage = globalThis.localStorage) => {
  const user = getStoredAdminUser(storage)
  return Array.isArray(user.permissions) ? user.permissions : []
}

export const hasPermission = (permission, storage = globalThis.localStorage) => {
  if (!permission) return true
  const user = getStoredAdminUser(storage)
  if (['admin', 'superadmin'].includes(user.role)) return true
  return Array.isArray(user.permissions) && user.permissions.includes(permission)
}

export const savePermissionSession = (payload = {}, storage = globalThis.localStorage) => {
  const current = getStoredAdminUser(storage)
  const next = {
    ...current,
    role: payload.role || current.role || '',
    roleDisplay: payload.roleDisplay || current.roleDisplay || '',
    permissions: Array.isArray(payload.permissions) ? [...new Set(payload.permissions)] : [],
    permissionVersion: Number(payload.permissionVersion || 1)
  }
  storage?.setItem('adminUser', JSON.stringify(next))
  return next
}

export const PERMISSION_CHANGED_EVENT = 'cicada:admin-permission-changed'

export const notifyPermissionChanged = (target = globalThis.window) => {
  if (target?.dispatchEvent && typeof globalThis.CustomEvent === 'function') {
    target.dispatchEvent(new CustomEvent(PERMISSION_CHANGED_EVENT))
  }
}

export const getRoleCompatibilityError = (role, catalog = {}) => {
  const normalizedRole = String(role || '').trim()
  if (!normalizedRole) return ''
  const templates = catalog && catalog.roleTemplates
  if (templates && Object.prototype.hasOwnProperty.call(templates, normalizedRole)) return ''
  return '后台云函数尚未部署该角色，请先更新后台权限云函数后再保存'
}

export const shouldDisplayLocalError = (error) => !Boolean(error && error.__displayed)
