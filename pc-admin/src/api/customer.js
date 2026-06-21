import request from '../utils/request.js'
import { API_BASE } from '../config/api.js'

const post = (action, data = {}) => {
  const token = localStorage.getItem('adminToken')
  return request.post(`${API_BASE.adminCustomer}/${action}`, { token, ...data })
}

// 客户档案
export const getCustomerPermissionConfig = () => post('getPermissionConfig')
export const listCustomers = (params) => post('listCustomers', params)
export const getCustomerDetail = (customer_id) => post('getCustomerDetail', { customer_id })
export const getCustomerPhone = (customer_id) => post('getCustomerPhone', { customer_id })
export const createCustomer = (customer) => post('createCustomer', { customer })
export const updateCustomer = (customer_id, customer) => post('updateCustomer', { customer_id, customer })
export const cancelCustomer = (customer_id) => post('cancelCustomer', { customer_id })
export const listDealers = () => post('listDealers')
export const syncCustomersFromUsers = () => post('syncCustomersFromUsers')

// 设备
export const listCustomerDevices = (customer_id) => post('listCustomerDevices', { customer_id })
export const saveCustomerDevice = (customer_id, device) => post('saveCustomerDevice', { customer_id, device })
export const deleteCustomerDevice = (customer_id, device_id) => post('deleteCustomerDevice', { customer_id, device_id })

// 历史工单 / 操作日志
export const listCustomerOrders = (customer_id) => post('listCustomerOrders', { customer_id })
export const getCustomerLogs = (customer_id) => post('getCustomerLogs', { customer_id })

// 标签库
export const listTags = () => post('listTags')
export const saveTag = (tag) => post('saveTag', { tag })
export const deleteTag = (tag_id) => post('deleteTag', { tag_id })
export const batchTag = (customer_ids, tags, op) => post('batchTag', { customer_ids, tags, op })

// 批量导入导出
export const exportCustomers = (params) => post('exportCustomers', params)
export const batchImportCustomers = (rows) => post('batchImportCustomers', { rows })
