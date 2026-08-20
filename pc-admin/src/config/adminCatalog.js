export const ADMIN_NAV_ITEMS = [
  { key: 'home', path: 'home', name: 'Home', title: '工作台首页', menuLabel: '工作台首页', icon: 'HomeFilled', permission: 'view_dashboard', sidebar: true, sidebarOrder: 1 },
  { key: 'workorder', path: 'workorder', name: 'WorkOrder', title: '报修工单处理中心', menuLabel: '报修工单管理', icon: 'Document', permission: 'view_order', sidebar: true, sidebarOrder: 2 },
  { key: 'customers', path: 'customers', name: 'CustomerManagement', title: '客户管理', menuLabel: '客户管理', icon: 'Avatar', permission: 'view_customer', sidebar: true, sidebarOrder: 6 },
  { key: 'inventory', path: 'inventory', name: 'InventoryManagement', title: '配件库存管理', menuLabel: '配件库存管理', icon: 'Box', permission: 'view_inventory', sidebar: true, sidebarOrder: 5 },
  { key: 'finance', path: 'finance', name: 'FinanceCenter', title: '财务中心（对账流水 · 开票管理）', menuLabel: '财务中心', icon: 'Money', permission: 'view_settlement', sidebar: true, sidebarOrder: 3 },
  { key: 'settlement', path: 'settlement', name: 'SettlementManagement', title: '结算管理', permission: 'view_settlement' },
  { key: 'logistics', path: 'logistics', name: 'LogisticsMonitor', title: '物流管理（批量导入 · 异常预警 · 台账）', menuLabel: '物流管理', icon: 'Van', permission: 'view_order', sidebar: true, sidebarOrder: 4 },
  { key: 'invoices', path: 'invoices', name: 'InvoiceManagement', title: '开票管理（申请·开票·归档）', permission: 'update_invoice' },
  { key: 'faultdb', path: 'faultdb', name: 'FaultDB', title: '产品分类与故障预设', menuLabel: '产品故障知识库', icon: 'Warning', permission: 'manage_kb', sidebar: true, sidebarOrder: 7 },
  { key: 'users', path: 'users', name: 'Users', title: '用户管理', menuLabel: '用户管理', icon: 'Setting', permission: 'view_staff', accountMenu: true },
  { key: 'feedback', path: 'feedback', name: 'Feedback', title: '客户投诉与建议列表', menuLabel: '投诉与建议', icon: 'ChatDotSquare', permission: 'view_feedback', sidebar: true, sidebarOrder: 8 },
  { key: 'audit', path: 'audit', name: 'AuditLog', title: '工单操作审计日志（合规备查）', menuLabel: '操作审计日志', icon: 'Files', permission: 'view_audit_log', accountMenu: true },
  { key: 'settings', path: 'settings', name: 'Settings', title: '小程序图文及政策配置', menuLabel: '小程序配置', icon: 'Setting', permission: 'manage_settings', sidebar: true, sidebarOrder: 9 }
]

export const ADMIN_ROLES = [
  { key: 'superadmin', label: '超级管理员', fullAccess: true },
  { key: 'admin', label: '管理员', fullAccess: true },
  { key: 'engineer', label: '工程师' },
  { key: 'finance', label: '财务' },
  { key: 'support', label: '客服' },
  { key: 'maintenance', label: '后台维护人员' }
]

const navByKey = new Map(ADMIN_NAV_ITEMS.map(item => [item.key, item]))
const roleByKey = new Map(ADMIN_ROLES.map(role => [role.key, role]))
const roleByLabel = new Map(ADMIN_ROLES.map(role => [role.label, role]))

export const getAdminNavItem = (key) => navByKey.get(key)
export const getAdminNavTitle = (key, fallback = '检修管理后台') => getAdminNavItem(key)?.title || fallback
export const getSidebarAdminNav = () => ADMIN_NAV_ITEMS.filter(item => item.sidebar).sort((a, b) => a.sidebarOrder - b.sidebarOrder)
export const getAccountAdminNav = () => ADMIN_NAV_ITEMS.filter(item => item.accountMenu)
export const getFirstAccessibleAdminNav = (canAccessPermission) => (
  ADMIN_NAV_ITEMS.find(item => canAccessPermission(item.permission, item))?.key || ''
)

export const getAdminRoleLabel = (key, fallback = '') => roleByKey.get(key)?.label || fallback || key || ''
export const getAdminRoleKey = (label, fallback = '') => roleByLabel.get(label)?.key || fallback
export const isFullAccessAdminRole = (keyOrLabel) => {
  const role = roleByKey.get(keyOrLabel) || roleByLabel.get(keyOrLabel)
  return Boolean(role?.fullAccess)
}
