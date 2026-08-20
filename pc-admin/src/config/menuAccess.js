import { getStoredAdminUser, hasPermission } from '../utils/permissions.js'
import { ADMIN_NAV_ITEMS, getFirstAccessibleAdminNav } from './adminCatalog.js'

// 页面门禁与后端权限键保持一致；未登记页面默认放行。
export const MENU_PERMISSIONS = Object.fromEntries(ADMIN_NAV_ITEMS.map(item => [item.key, item.permission]))

export const getCurrentAdminRole = () => getStoredAdminUser().role || ''

export const canAccessMenu = (menu) => {
  const permission = MENU_PERMISSIONS[menu]
  return permission ? hasPermission(permission) : true
}

export const getFirstAccessibleMenu = () => getFirstAccessibleAdminNav(permission => hasPermission(permission))
