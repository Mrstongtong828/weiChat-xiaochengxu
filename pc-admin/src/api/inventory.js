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

export const updatePartStatus = (token, partId, enabled) => {
  return request.post(`${API_BASE.adminOrder}/updatePartStatus`, {
    token,
    part_id: partId,
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
