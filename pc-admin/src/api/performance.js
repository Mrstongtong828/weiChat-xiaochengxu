import request from '../utils/request.js'
import { API_BASE } from '../config/api.js'

const post = (action, data = {}) => {
  const token = localStorage.getItem('adminToken')
  return request.post(`${API_BASE.adminOrder}/${action}`, { token, ...data })
}

// 售后工程师绩效（按月完工工单统计），不传则默认当月
export const getEngineerPerformance = (params = {}) => post('getEngineerPerformance', params)
