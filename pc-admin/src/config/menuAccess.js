import { getStoredAdminUser, hasPermission } from '../utils/permissions.js'

// 页面门禁与后端权限键保持一致；未登记页面默认放行。
export const MENU_PERMISSIONS = {
  home: 'view_dashboard',
  workorder: 'view_order',
  customers: 'view_customer',
  inventory: 'view_inventory',
  finance: 'view_settlement',
  settlement: 'view_settlement',
  logistics: 'view_order',
  invoices: 'update_invoice',
  faultdb: 'manage_kb',
  users: 'view_staff',
  feedback: 'view_feedback',
  audit: 'view_audit_log',
  settings: 'manage_settings'
}

export const getCurrentAdminRole = () => getStoredAdminUser().role || ''

export const canAccessMenu = (menu) => {
  const permission = MENU_PERMISSIONS[menu]
  return permission ? hasPermission(permission) : true
}

export const getFirstAccessibleMenu = () => Object.keys(MENU_PERMISSIONS).find(canAccessMenu) || ''
