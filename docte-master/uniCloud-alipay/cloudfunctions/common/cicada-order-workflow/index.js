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

const RESTORABLE_CANCELLED_ORDER_STATUSES = Object.entries(ORDER_STATUS_TRANSITIONS)
  .filter(([, transitions]) => transitions.includes('cancelled'))
  .map(([status]) => status)

const ROLE_LABELS = {
  superadmin: '超级管理员',
  admin: '管理员',
  engineer: '工程师',
  finance: '财务',
  support: '客服',
  maintenance: '后台维护人员'
}

const ALL_ROLES = Object.keys(ROLE_LABELS)

const PERMISSION_DEFINITIONS = [
  { key: 'view_dashboard', label: '查看工作台', group: '工作台' },
  { key: 'get_stats', label: '查看业务统计', group: '工作台' },
  { key: 'get_workflow_config', label: '读取工单权限配置', group: '工作台' },
  { key: 'view_order', label: '查看工单', group: '工单' },
  { key: 'create_order', label: '新建工单', group: '工单' },
  { key: 'delete_order', label: '删除工单', group: '工单', risk: true },
  { key: 'export_order', label: '导出工单', group: '工单', risk: true },
  { key: 'edit_order_remarks', label: '编辑工单备注', group: '工单' },
  { key: 'edit_order_items', label: '编辑设备与维修项目', group: '工单' },
  { key: 'edit_repair_record', label: '填写维修记录', group: '工单' },
  { key: 'edit_received_parts', label: '填写收件配件明细', group: '工单' },
  { key: 'confirm_received_parts', label: '确认收件配件签收', group: '工单' },
  { key: 'confirm_inbound_arrival', label: '确认设备签收入库', group: '工单' },
  { key: 'record_return_logistics', label: '填写回寄物流', group: '工单' },
  { key: 'import_inbound_logistics', label: '批量导入签收物流', group: '工单', risk: true },
  { key: 'import_return_logistics', label: '批量导入回寄物流', group: '工单', risk: true },
  { key: 'update_order_status', label: '修改工单状态', group: '工单', risk: true },
  { key: 'restore_cancelled_order', label: '恢复已取消工单', group: '工单', risk: true },
  { key: 'issue_quote', label: '填写或发布报价', group: '工单', risk: true },
  { key: 'add_timeline', label: '追加工单时间线', group: '工单' },
  { key: 'assign_engineer', label: '指派维修工程师', group: '工单' },
  { key: 'view_inventory', label: '查看配件与库存', group: '配件库存' },
  { key: 'edit_inventory', label: '新增或编辑配件', group: '配件库存' },
  { key: 'stock_in_inventory', label: '配件采购入库', group: '配件库存', risk: true },
  { key: 'stock_out_inventory', label: '配件手工出库', group: '配件库存', risk: true },
  { key: 'adjust_inventory', label: '库存盘点与调整', group: '配件库存', risk: true },
  { key: 'import_inventory', label: '导入配件库存', group: '配件库存', risk: true },
  { key: 'export_inventory', label: '导出配件库存', group: '配件库存', risk: true },
  { key: 'view_inventory_cost', label: '查看配件采购成本', group: '配件库存', risk: true },
  { key: 'view_customer', label: '查看客户资料', group: '客户' },
  { key: 'edit_customer', label: '新增或编辑客户', group: '客户' },
  { key: 'view_customer_phone', label: '查看完整手机号', group: '客户', risk: true },
  { key: 'manage_customer_device', label: '管理客户设备', group: '客户' },
  { key: 'import_customer', label: '导入客户资料', group: '客户', risk: true },
  { key: 'export_customer', label: '导出客户资料', group: '客户', risk: true },
  { key: 'cancel_customer', label: '注销客户', group: '客户', risk: true },
  { key: 'confirm_payment', label: '确认付款与退款', group: '财务', risk: true },
  { key: 'update_invoice', label: '管理发票', group: '财务' },
  { key: 'view_payment_proof', label: '查看付款凭证', group: '财务', risk: true },
  { key: 'view_settlement', label: '查看财务与结算', group: '财务' },
  { key: 'view_staff', label: '查看员工账号', group: '账号管理', risk: true },
  { key: 'create_staff', label: '新增员工账号', group: '账号管理', risk: true },
  { key: 'edit_staff', label: '编辑员工与权限', group: '账号管理', risk: true },
  { key: 'toggle_staff', label: '启用或禁用员工', group: '账号管理', risk: true },
  { key: 'reset_staff_password', label: '重置员工密码', group: '账号管理', risk: true },
  { key: 'view_engineer_performance', label: '查看工程师绩效', group: '系统' },
  { key: 'manage_settings', label: '管理系统设置', group: '系统', risk: true },
  { key: 'manage_kb', label: '管理知识库', group: '系统' },
  { key: 'view_audit_log', label: '查看审计日志', group: '系统', risk: true },
  { key: 'view_feedback', label: '查看客户反馈', group: '系统' },
  { key: 'handle_feedback', label: '处理客户反馈', group: '系统' }
]

const ALL_PERMISSION_KEYS = PERMISSION_DEFINITIONS.map(item => item.key)

const ROLE_PERMISSION_TEMPLATES = {
  superadmin: ALL_PERMISSION_KEYS,
  admin: ALL_PERMISSION_KEYS,
  engineer: [
    'view_dashboard', 'get_stats', 'get_workflow_config', 'view_order',
    'edit_order_items', 'edit_repair_record', 'view_inventory'
  ],
  finance: [
    'view_dashboard', 'get_stats', 'get_workflow_config', 'view_order',
    'confirm_payment', 'update_invoice', 'view_payment_proof', 'view_settlement', 'view_audit_log'
  ],
  support: [
    'view_dashboard', 'get_stats', 'get_workflow_config', 'view_order',
    'confirm_inbound_arrival', 'edit_received_parts', 'confirm_received_parts',
    'edit_order_items', 'edit_repair_record', 'record_return_logistics',
    'view_customer', 'view_feedback', 'handle_feedback'
  ],
  maintenance: [
    'view_dashboard', 'get_stats', 'get_workflow_config', 'view_order',
    'view_inventory', 'view_customer', 'manage_kb', 'manage_settings'
  ]
}

function sanitizePermissions(input = []) {
  if (!Array.isArray(input)) return []
  const allowed = new Set(ALL_PERMISSION_KEYS)
  return [...new Set(input.map(value => String(value || '').trim()).filter(key => allowed.has(key)))]
}

function getEffectivePermissions(user = {}) {
  const role = normalizeRole(user.role)
  if (role === 'superadmin' || role === 'admin') return [...ALL_PERMISSION_KEYS]
  if (Object.prototype.hasOwnProperty.call(user, 'permissions') && Array.isArray(user.permissions)) {
    return sanitizePermissions(user.permissions)
  }
  return [...(ROLE_PERMISSION_TEMPLATES[role] || [])]
}

function hasUserPermission(user = {}, action = '') {
  return getEffectivePermissions(user).includes(String(action || '').trim())
}

function assertUserPermission(user = {}, action = '') {
  if (!hasUserPermission(user, action)) {
    throw new Error(`${getRoleLabel(user.role)}无权限执行该操作`)
  }
  return true
}

function getPermissionCatalogForManager() {
  const groupNames = [...new Set(PERMISSION_DEFINITIONS.map(item => item.group))]
  return {
    version: 1,
    roles: ALL_ROLES.map(role => ({ role, label: ROLE_LABELS[role] })),
    roleTemplates: Object.fromEntries(Object.entries(ROLE_PERMISSION_TEMPLATES).map(([role, permissions]) => [role, [...permissions]])),
    groups: groupNames.map(name => ({
      name,
      permissions: PERMISSION_DEFINITIONS.filter(item => item.group === name).map(item => ({ ...item }))
    }))
  }
}

// 旧调用方仍按 role 查询时使用的兼容映射；新鉴权必须使用账号对象。
const PERMISSIONS = Object.fromEntries(ALL_PERMISSION_KEYS.map(action => [
  action,
  ALL_ROLES.filter(role => (ROLE_PERMISSION_TEMPLATES[role] || []).includes(action))
]))

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

function isRestorableCancelledOrderStatus(status = '') {
  return RESTORABLE_CANCELLED_ORDER_STATUSES.includes(normalizeStatus(status))
}

function getCancelledOrderRestoreStatus(order = {}, events = []) {
  if (normalizeStatus(order.status) !== 'cancelled') return ''
  const savedStatus = normalizeStatus(order.cancelled_from_status || order.cancelledFromStatus)
  if (isRestorableCancelledOrderStatus(savedStatus)) return savedStatus

  const cancellationEvent = (Array.isArray(events) ? events : []).find(event => (
    normalizeStatus(event && event.action) === 'update_status'
    && normalizeStatus(event && event.after && event.after.status) === 'cancelled'
    && isRestorableCancelledOrderStatus(event && event.before && event.before.status)
  ))
  return cancellationEvent ? normalizeStatus(cancellationEvent.before.status) : ''
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

function getWorkflowConfigForUser(user = {}) {
  const role = normalizeRole(user.role)
  const effective = new Set(getEffectivePermissions(user))
  return {
    role,
    roleLabel: getRoleLabel(role),
    roles: ALL_ROLES.map(item => ({ role: item, label: ROLE_LABELS[item] })),
    statuses: ORDER_STATUS.map(status => ({ status, label: ORDER_STATUS_LABELS[status] })),
    transitions: ORDER_STATUS_TRANSITIONS,
    permissions: Object.fromEntries(ALL_PERMISSION_KEYS.map(action => [action, effective.has(action)])),
    permissionVersion: 1
  }
}

module.exports = {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  RESTORABLE_CANCELLED_ORDER_STATUSES,
  ROLE_LABELS,
  ALL_ROLES,
  PERMISSION_DEFINITIONS,
  ALL_PERMISSION_KEYS,
  ROLE_PERMISSION_TEMPLATES,
  PERMISSIONS,
  isKnownRole,
  getRoleLabel,
  hasRolePermission,
  assertRolePermission,
  sanitizePermissions,
  getEffectivePermissions,
  hasUserPermission,
  assertUserPermission,
  getPermissionCatalogForManager,
  isKnownOrderStatus,
  getOrderStatusLabel,
  getAllowedStatusTransitions,
  canTransitionOrderStatus,
  assertOrderStatusTransition,
  getCancelledOrderRestoreStatus,
  isRestorableCancelledOrderStatus,
  getWorkflowConfigForRole,
  getWorkflowConfigForUser,
  getRepairStartBlockReason
}
