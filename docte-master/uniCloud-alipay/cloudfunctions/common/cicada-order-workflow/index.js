const ORDER_STATUS = ['pending', 'sent', 'received', 'inspecting', 'fixing', 'shipped', 'completed', 'cancelled']

const ORDER_STATUS_LABELS = {
  pending: '已提交',
  sent: '运输中',
  received: '已签收',
  inspecting: '检测中',
  fixing: '处理中',
  shipped: '已回寄',
  completed: '已完成',
  cancelled: '已取消'
}

const ORDER_STATUS_TRANSITIONS = {
  pending: ['sent', 'received', 'cancelled'],
  sent: ['received', 'cancelled'],
  received: ['inspecting', 'fixing', 'cancelled'],
  inspecting: ['fixing', 'shipped', 'cancelled'],
  fixing: ['shipped', 'completed', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: []
}

const ROLE_LABELS = {
  superadmin: '超级管理员',
  admin: '管理员',
  engineer: '工程师',
  finance: '财务',
  support: '客服'
}

const ALL_ROLES = Object.keys(ROLE_LABELS)

const PERMISSIONS = {
  view_order: ALL_ROLES,
  export_order: ALL_ROLES,
  get_stats: ALL_ROLES,
  get_workflow_config: ALL_ROLES,
  update_status: ['admin', 'engineer'],
  import_logistics: ['admin', 'engineer'],
  issue_quote: ['admin', 'support'],
  confirm_payment: ['admin', 'finance'],
  update_invoice: ['admin', 'finance'],
  view_payment_proof: ['admin', 'finance'],
  manage_inventory: ['admin', 'engineer'],
  view_settlement: ['admin', 'finance'],
  update_remarks: ['admin', 'engineer', 'support'],
  add_timeline: ['admin', 'engineer', 'support'],
  manage_staff: ['admin'],
  manage_settings: ['admin'],
  manage_kb: ['admin', 'engineer'],
  view_audit_log: ['admin', 'finance'],
  view_feedback: ['admin', 'engineer', 'finance', 'support'],
  handle_feedback: ['admin', 'support']
}

function normalizeRole(role = '') {
  return String(role || '').trim()
}

function isKnownRole(role = '') {
  return ALL_ROLES.includes(normalizeRole(role))
}

function getRoleLabel(role = '') {
  return ROLE_LABELS[normalizeRole(role)] || normalizeRole(role) || '未知角色'
}

function getUserRole(user = {}) {
  return normalizeRole(user.role)
}

function hasRolePermission(role = '', action = '') {
  const normalizedRole = normalizeRole(role)
  if (normalizedRole === 'superadmin' || normalizedRole === 'admin') return true
  const allowedRoles = PERMISSIONS[action] || []
  return allowedRoles.includes(normalizedRole)
}

function assertRolePermission(user = {}, action = '') {
  const role = getUserRole(user)
  if (!hasRolePermission(role, action)) {
    throw new Error(`${getRoleLabel(role)}无权限执行该操作`)
  }
  return true
}

function normalizeStatus(status = '') {
  return String(status || '').trim()
}

function isKnownOrderStatus(status = '') {
  return ORDER_STATUS.includes(normalizeStatus(status))
}

function getOrderStatusLabel(status = '') {
  const normalizedStatus = normalizeStatus(status)
  return ORDER_STATUS_LABELS[normalizedStatus] || normalizedStatus || '未知状态'
}

function getAllowedStatusTransitions(status = '') {
  const normalizedStatus = normalizeStatus(status)
  return ORDER_STATUS_TRANSITIONS[normalizedStatus] || []
}

function canTransitionOrderStatus(fromStatus = '', toStatus = '') {
  const from = normalizeStatus(fromStatus)
  const to = normalizeStatus(toStatus)
  if (!isKnownOrderStatus(from) || !isKnownOrderStatus(to)) return false
  if (from === to) return true
  return getAllowedStatusTransitions(from).includes(to)
}

function assertOrderStatusTransition(fromStatus = '', toStatus = '') {
  const from = normalizeStatus(fromStatus)
  const to = normalizeStatus(toStatus)
  if (!isKnownOrderStatus(to)) throw new Error('工单状态不正确')
  if (!isKnownOrderStatus(from)) throw new Error('当前工单状态不正确')
  if (!canTransitionOrderStatus(from, to)) {
    throw new Error(`${getOrderStatusLabel(from)}工单不能改为${getOrderStatusLabel(to)}`)
  }
  return true
}

function getWorkflowConfigForRole(role = '') {
  const normalizedRole = normalizeRole(role)
  const permissions = Object.fromEntries(
    Object.keys(PERMISSIONS).map(action => [action, hasRolePermission(normalizedRole, action)])
  )
  return {
    role: normalizedRole,
    roleLabel: getRoleLabel(normalizedRole),
    roles: ALL_ROLES.map(item => ({ role: item, label: ROLE_LABELS[item] })),
    statuses: ORDER_STATUS.map(status => ({ status, label: ORDER_STATUS_LABELS[status] })),
    transitions: ORDER_STATUS_TRANSITIONS,
    permissions
  }
}

module.exports = {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  ROLE_LABELS,
  ALL_ROLES,
  PERMISSIONS,
  isKnownRole,
  getRoleLabel,
  hasRolePermission,
  assertRolePermission,
  isKnownOrderStatus,
  getOrderStatusLabel,
  getAllowedStatusTransitions,
  canTransitionOrderStatus,
  assertOrderStatusTransition,
  getWorkflowConfigForRole
}
