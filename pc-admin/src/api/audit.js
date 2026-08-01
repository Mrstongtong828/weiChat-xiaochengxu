import request from '../utils/request.js'
import { API_BASE } from '../config/api.js'

const post = (action, data = {}) => {
  const token = localStorage.getItem('adminToken')
  return request.post(`${API_BASE.adminOrder}/${action}`, { token, ...data })
}

// 工单操作审计日志（医疗器械合规备查）
export const getOrderEvents = (params) => post('getOrderEvents', params)
