import request from '../utils/request.js'
import { API_BASE } from '../config/api.js'

export const getSettlementList = (token, params = {}) => {
  return request.post(`${API_BASE.adminOrder}/getSettlementList`, {
    token,
    ...params
  })
}
