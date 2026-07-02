// 后台各页面允许访问的角色（前端门禁，与后端权限点对应）。
// superadmin 始终放行；未在表中的页面默认放行。
export const MENU_ROLES = {
  home: ['superadmin', 'admin', 'engineer', 'finance', 'support'],
  workorder: ['superadmin', 'admin', 'engineer', 'finance', 'support'],
  customers: ['superadmin', 'admin', 'support'],
  inventory: ['superadmin', 'admin', 'engineer'],
  finance: ['superadmin', 'admin', 'finance'],
  settlement: ['superadmin', 'admin', 'finance'],
  logistics: ['superadmin', 'admin', 'engineer', 'support'],
  invoices: ['superadmin', 'admin', 'finance'],
  faultdb: ['superadmin', 'admin', 'engineer'],
  users: ['superadmin', 'admin'],
  feedback: ['superadmin', 'admin', 'support'],
  summary: ['superadmin', 'admin', 'finance'],
  audit: ['superadmin', 'admin', 'finance'],
  settings: ['superadmin', 'admin']
}

export const getCurrentAdminRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}')
    return user.role || ''
  } catch (e) {
    return ''
  }
}

export const canAccessMenu = (menu, role = getCurrentAdminRole()) => {
  const allowed = MENU_ROLES[menu]
  if (!allowed) return true
  if (role === 'superadmin') return true
  return allowed.includes(role)
}
