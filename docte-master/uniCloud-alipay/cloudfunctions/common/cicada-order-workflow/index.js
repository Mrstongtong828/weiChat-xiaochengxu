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
  received: ['inspecting', 'fixing', 'shipped', 'cancelled'],
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
  create_order: ['admin', 'engineer', 'support'],
  export_order: ALL_ROLES,
  get_stats: ALL_ROLES,
  get_workflow_config: ALL_ROLES,
  delete_order: ['admin'],
  update_status: ['admin', 'engineer'],
  import_logistics: ['admin', 'engineer'],
  issue_quote: ['admin', 'engineer'],
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

function getRepairStartBlockReason(order = {}) {
  const quoteStatus = normalizeStatus(order.quote_status || order.quoteStatus)
  const authorizationStatus = normalizeStatus(order.authorization_status || order.authorizationStatus)
  const paymentStatus = normalizeStatus(order.payment_status || order.paymentStatus)
  const chargeType = normalizeStatus(order.charge_type || order.chargeType)
  const warrantyStatus = normalizeStatus(order.warranty_status || order.warrantyStatus)
  const total = Number(order.total_price || order.totalPrice || 0) || 0
  const inWarranty = Boolean(order.in_warranty || order.inWarranty)

  // 保修期内质保免费：方案已发布为免付款即视为客户确认，无需再在线确认，保证维修与回寄时效。
  const warrantyFreeSettled = total <= 0
    && chargeType === 'free'
    && paymentStatus === 'not_required'
    && inWarranty
    && ['in_warranty', 'extended'].includes(warrantyStatus)
  if (warrantyFreeSettled) return ''

  // 收费单已到账即客户确认：付款后无需再等报价/授权确认，可直接进入维修与回寄。
  if (total > 0 && paymentStatus === 'paid') return ''

  if (quoteStatus !== 'confirmed') return '维修前必须先确认维修方案'
  if (authorizationStatus !== 'confirmed') return '维修前必须取得客户授权'
  if (total > 0 && paymentStatus !== 'paid') return '收费维修必须先确认款项到账'
  if (total <= 0 && (paymentStatus !== 'not_required' || chargeType !== 'free')) {
    return '零元维修必须先确认质保免费方案'
  }
  return ''
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
  getWorkflowConfigForRole,
  getRepairStartBlockReason
}
