import request from '../utils/request.js'
import { API_BASE } from '../config/api.js'

// 获取工单列表
export const getOrderList = (token, status, page = 1, pageSize = 20, filters = {}) => {
  return request.post(`${API_BASE.adminOrder}/getAdminOrderList`, {
    token,
    status,
    page,
    pageSize,
    keyword: filters.keyword || '',
    deviceModel: filters.deviceModel || '',
    invoiceStatus: filters.invoiceStatus || '',
    warrantyStatus: filters.warrantyStatus || '',
    todoType: filters.todoType || '',
    slaLevel: filters.slaLevel || '',
    responseMode: filters.responseMode || 'array'
  })
}

// 保存工单产品/设备信息（SN 回填后落库，并重算在保快照）
export const saveOrderItems = (token, orderId, items) => {
  return request.post(`${API_BASE.adminOrder}/saveOrderItems`, {
    token,
    order_id: orderId,
    items
  })
}

// 获取当前角色可用工单流程与权限
export const getWorkflowConfig = (token) => {
  return request.post(`${API_BASE.adminOrder}/getWorkflowConfig`, { token })
}

// 分配工程师
export const assignEngineer = (token, orderId, engineerId) => {
  return request.post(`${API_BASE.adminOrder}/assignEngineer`, {
    token,
    order_id: orderId,
    engineer_id: engineerId
  })
}

// 更新工单状态
export const updateOrderStatus = (token, orderId, status) => {
  return request.post(`${API_BASE.adminOrder}/updateOrderStatus`, {
    token,
    order_id: orderId,
    status
  })
}

// 批量导入回寄运单号
export const batchImportReturnLogistics = (token, rows) => {
  return request.post(`${API_BASE.adminOrder}/batchImportReturnLogistics`, {
    token,
    rows
  })
}

// 批量回寄发货
export const batchUpdateShipping = (token, shippingList) => {
  return request.post(`${API_BASE.adminOrder}/batchUpdateShipping`, {
    token,
    shippingList
  })
}

// 批量导入物流单：type=inbound 表示客户寄入签收，type=return 表示后台回寄发货
export const batchImportLogistics = (token, type, rows, importDate = '') => {
  return request.post(`${API_BASE.adminOrder}/batchImportLogistics`, {
    token,
    type,
    rows,
    importDate
  })
}

// 更新工单备注
export const updateRemarks = (token, orderId, adminRemark, printRemark) => {
  return request.post(`${API_BASE.adminOrder}/updateRemarks`, {
    token,
    orderId,
    adminRemark,
    printRemark
  })
}

// 更新开票状态登记
export const updateInvoiceStatus = (token, orderId, status, invoice = {}) => {
  return request.post(`${API_BASE.adminOrder}/updateInvoiceStatus`, {
    token,
    order_id: orderId,
    status,
    invoice
  })
}

// 一键开票（财务确认到账后，调用开票服务商 API 自动开票并回填）
export const issueInvoice = (token, orderId) => {
  return request.post(`${API_BASE.adminOrder}/issueInvoice`, {
    token,
    order_id: orderId
  })
}

// 更新/发布维修报价
export const updateOrderQuote = (token, orderId, quote = {}) => {
  return request.post(`${API_BASE.adminOrder}/updateOrderQuote`, {
    token,
    order_id: orderId,
    quote
  })
}

// 更新付款核销状态
export const updatePaymentStatus = (token, orderId, status) => {
  return request.post(`${API_BASE.adminOrder}/updatePaymentStatus`, {
    token,
    order_id: orderId,
    status
  })
}

export const rejectPaymentProof = (token, orderId, reason) => {
  return request.post(`${API_BASE.adminOrder}/updatePaymentStatus`, {
    token,
    order_id: orderId,
    status: 'rejected',
    reason
  })
}

// 微信支付退款（限 admin/finance）。amount 为退款金额(元)，留空则全额退款
export const refundOrderPayment = (token, orderId, reason = '', amount) => {
  return request.post(`${API_BASE.adminOrder}/refundOrderPayment`, {
    token,
    order_id: orderId,
    reason,
    amount
  })
}

// 添加时间线
export const addTimeline = (token, orderId, title, desc) => {
  return request.post(`${API_BASE.adminOrder}/addTimeline`, {
    token,
    order_id: orderId,
    title,
    desc
  })
}

// 获取统计数据
export const getStatistics = (token) => {
  return request.post(`${API_BASE.adminOrder}/getStatistics`, { token })
}

// 获取后台待办中心统计
export const getTodoSummary = (token) => {
  return request.post(`${API_BASE.adminOrder}/getTodoSummary`, { token })
}

// 物流异常预警列表（48h未揽收 / 72h停滞）
export const getLogisticsExceptions = (token) => {
  return request.post(`${API_BASE.adminOrder}/getLogisticsExceptions`, { token })
}

// 物流台账（两段物流汇总，分页拉全量用于导出）
export const getLogisticsLedger = (token, filters = {}) => {
  return request.post(`${API_BASE.adminOrder}/getLogisticsLedger`, {
    token,
    status: filters.status || '',
    keyword: filters.keyword || '',
    page: filters.page || 1,
    pageSize: filters.pageSize || 20
  })
}

// 四流台账（订单+物流+支付+发票，分页拉全量统一导出）
export const getFourFlowLedger = (token, filters = {}) => {
  return request.post(`${API_BASE.adminOrder}/getFourFlowLedger`, {
    token,
    status: filters.status || '',
    keyword: filters.keyword || '',
    billableOnly: filters.billableOnly || false,
    page: filters.page || 1,
    pageSize: filters.pageSize || 20
  })
}

// 开票申请列表（分页，支持导出全量）
export const getInvoiceApplications = (token, filters = {}) => {
  return request.post(`${API_BASE.adminOrder}/getInvoiceApplications`, {
    token,
    status: filters.status || '',
    keyword: filters.keyword || '',
    page: filters.page || 1,
    pageSize: filters.pageSize || 20
  })
}

// 批量导入开票结果（按工单号回填发票号/日期/链接/状态）
export const batchImportInvoices = (token, rows) => {
  return request.post(`${API_BASE.adminOrder}/batchImportInvoices`, { token, rows })
}

// 获取服务数据总结
export const getDashboardSummary = (token, filters = {}) => {
  return request.post(`${API_BASE.adminOrder}/getDashboardSummary`, {
    token,
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    granularity: filters.granularity || 'day'
  })
}
