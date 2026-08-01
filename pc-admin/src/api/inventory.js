import request from '../utils/request.js'
import { API_BASE } from '../config/api.js'

export const getPartList = (token, params = {}) => {
  return request.post(`${API_BASE.adminOrder}/listParts`, {
    token,
    ...params
  })
}

export const savePart = (token, part = {}) => {
  return request.post(`${API_BASE.adminOrder}/savePart`, {
    token,
    part
  })
}

export const exportParts = (token, params = {}) => {
  return request.post(`${API_BASE.adminOrder}/exportParts`, {
    token,
    ...params
  })
}

export const batchImportParts = (token, rows = [], mode = 'upsert') => {
  return request.post(`${API_BASE.adminOrder}/batchImportParts`, {
    token,
    rows,
    mode
  })
}

export const updatePartStatus = (token, partId, enabled) => {
  return request.post(`${API_BASE.adminOrder}/updatePartStatus`, {
    token,
    part_id: partId,
    enabled
  })
}

export const batchUpdatePartStatus = (token, partIds = [], enabled = false) => {
  return request.post(`${API_BASE.adminOrder}/batchUpdatePartStatus`, {
    token,
    part_ids: partIds,
    enabled
  })
}

export const getInventoryFlows = (token, params = {}) => {
  return request.post(`${API_BASE.adminOrder}/listInventoryFlows`, {
    token,
    ...params
  })
}

export const useOrderParts = (token, orderId) => {
  return request.post(`${API_BASE.adminOrder}/useOrderParts`, {
    token,
    order_id: orderId
  })
}

// 恢复卡在 outbound_processing/outbound_failed 的工单库存状态。
export const recoverOrderInventory = (token, orderId, action = 'inspect', confirm = false) => {
  return request.post(`${API_BASE.adminOrder}/recoverOrderInventory`, {
    token,
    order_id: orderId,
    action,
    confirm
  })
}
