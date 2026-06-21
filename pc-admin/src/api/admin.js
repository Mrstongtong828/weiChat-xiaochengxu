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

// 获取反馈列表（支持状态/类型/紧急度/关键词筛选 + 分页）
export const getFeedbackList = (token, params = {}) => {
  return request.post(`${API_BASE.adminSys}/getFeedbackList`, { token, ...params })
}

// 分配负责人
export const assignFeedback = (token, id, handlerId) => {
  return request.post(`${API_BASE.adminSys}/assignFeedback`, { token, id, handler_id: handlerId })
}

// 设置紧急等级
export const setFeedbackUrgency = (token, id, urgency) => {
  return request.post(`${API_BASE.adminSys}/setFeedbackUrgency`, { token, id, urgency })
}

// 绑定 / 改绑 / 解绑投诉关联工单（order_no 传空即解绑）
export const linkFeedbackOrder = (token, id, orderNo) => {
  return request.post(`${API_BASE.adminSys}/linkFeedbackOrder`, { token, id, order_no: orderNo })
}

// 处理记录 + 官方回复（回复对客户可见）
export const replyFeedback = (token, payload = {}) => {
  return request.post(`${API_BASE.adminSys}/replyFeedback`, { token, ...payload })
}

// 回访登记
export const recordFeedbackVisit = (token, payload = {}) => {
  return request.post(`${API_BASE.adminSys}/recordFeedbackVisit`, { token, ...payload })
}

// 结案（需先完成回访）
export const closeFeedback = (token, id) => {
  return request.post(`${API_BASE.adminSys}/closeFeedback`, { token, id })
}

// 升级投诉
export const upgradeFeedback = (token, id, note) => {
  return request.post(`${API_BASE.adminSys}/upgradeFeedback`, { token, id, note })
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

// 新增自定义教程
export const createGuide = (token, payload = {}) => {
  return request.post(`${API_BASE.adminSys}/createGuide`, { token, ...payload })
}

// 删除教程
export const deleteGuide = (token, guide_id) => {
  return request.post(`${API_BASE.adminSys}/deleteGuide`, { token, guide_id })
}

// 上传教程文件（fileContent 为 base64 字符串）
export const uploadGuideFile = (token, fileContent, fileName, fileType) => {
  return request.post(`${API_BASE.adminSys}/uploadGuideFile`, { token, fileContent, fileName, fileType })
}

// 通用文件上传（fileContent 为 base64 字符串，dir 指定云存储目录，如 compliance/ tutorials/ print/）
export const uploadFile = (token, fileContent, fileName, fileType, dir) => {
  return request.post(`${API_BASE.adminSys}/uploadFile`, { token, fileContent, fileName, fileType, dir })
}

// 解析云存储 fileID 列表为临时可访问地址（预览资质图片/logo），返回 { fileID: tempUrl }
export const getTempFileURL = (token, fileList) => {
  return request.post(`${API_BASE.adminSys}/getTempFileURL`, { token, fileList })
}
