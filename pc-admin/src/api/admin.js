import request from '../utils/request.js'
import { API_BASE } from '../config/api.js'

// 管理员登录
export const adminLogin = (username, password) => {
  return request.post(`${API_BASE.adminSys}/adminLogin`, {
    username,
    password
  })
}

// 修改当前登录账号密码
export const changeMyPassword = (token, oldPassword, newPassword) => {
  return request.post(`${API_BASE.adminSys}/changeMyPassword`, {
    token,
    oldPassword,
    newPassword
  })
}

// 获取员工列表
export const getStaffList = (token) => {
  return request.post(`${API_BASE.adminSys}/manageStaff`, {
    token,
    action: 'list'
  })
}

// 添加员工
export const addStaff = (token, staff) => {
  return request.post(`${API_BASE.adminSys}/manageStaff`, {
    token,
    action: 'add',
    staff
  })
}

// 编辑员工
export const editStaff = (token, staff) => {
  return request.post(`${API_BASE.adminSys}/manageStaff`, {
    token,
    action: 'edit',
    staff
  })
}

// 禁用/启用员工
export const disableStaff = (token, staffId, disabled) => {
  return request.post(`${API_BASE.adminSys}/manageStaff`, {
    token,
    action: 'disable',
    staff: { _id: staffId, disabled }
  })
}

// 管理员重置员工密码为系统默认密码
export const resetUserPassword = (token, userId) => {
  return request.post(`${API_BASE.adminSys}/resetUserPassword`, {
    token,
    userId
  })
}

// 获取反馈统计
export const getFeedbackStats = (token) => {
  return request.post(`${API_BASE.adminSys}/getFeedbackStats`, { token })
}

// 获取反馈列表
export const getFeedbackList = (token, status) => {
  return request.post(`${API_BASE.adminSys}/getFeedbackList`, { token, status })
}

// 保存配置
export const saveSettings = (token, settings) => {
  return request.post(`${API_BASE.adminSys}/saveSettings`, { token, settings })
}

// 获取配置
export const getSettings = (token) => {
  return request.post(`${API_BASE.adminSys}/getSettings`, { token })
}

// 获取教程列表
export const getGuides = (token) => {
  return request.post(`${API_BASE.adminSys}/getGuides`, { token })
}

// 更新教程
export const updateGuide = (token, guide_id, payload, legacyFileUrl) => {
  const data = typeof payload === 'object'
    ? { ...payload }
    : { file_name: payload, file_url: legacyFileUrl }
  return request.post(`${API_BASE.adminSys}/updateGuide`, { token, guide_id, ...data })
}

// 上传教程文件（fileContent 为 base64 字符串）
export const uploadGuideFile = (token, fileContent, fileName, fileType) => {
  return request.post(`${API_BASE.adminSys}/uploadGuideFile`, { token, fileContent, fileName, fileType })
}
