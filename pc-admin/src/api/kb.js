import request from '../utils/request.js'
import { API_BASE } from '../config/api.js'

// 获取分类列表
export const getCategoryList = (token) => {
  return request.post(`${API_BASE.adminKb}/manageCategories`, {
    token,
    action: 'list'
  })
}

// 添加分类
export const addCategory = (token, data) => {
  return request.post(`${API_BASE.adminKb}/manageCategories`, {
    token,
    action: 'add',
    data
  })
}

// 编辑分类
export const editCategory = (token, id, data) => {
  return request.post(`${API_BASE.adminKb}/manageCategories`, {
    token,
    action: 'update',
    id,
    data
  })
}

// 删除分类
export const deleteCategory = (token, id) => {
  return request.post(`${API_BASE.adminKb}/manageCategories`, {
    token,
    action: 'delete',
    id
  })
}

// 获取故障库列表
export const getFaultList = (token) => {
  return request.post(`${API_BASE.adminKb}/manageFaultKb`, {
    token,
    action: 'list'
  })
}

// 添加故障
export const addFault = (token, data) => {
  return request.post(`${API_BASE.adminKb}/manageFaultKb`, {
    token,
    action: 'add',
    data
  })
}

// 编辑故障
export const editFault = (token, id, data) => {
  return request.post(`${API_BASE.adminKb}/manageFaultKb`, {
    token,
    action: 'update',
    id,
    data
  })
}

// 删除故障
export const deleteFault = (token, id) => {
  return request.post(`${API_BASE.adminKb}/manageFaultKb`, {
    token,
    action: 'delete',
    id
  })
}
