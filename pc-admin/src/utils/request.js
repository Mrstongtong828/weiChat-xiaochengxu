import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getAdminToken, handleSessionExpired } from './adminSession.js'
import { getErrorMessage } from './errorMessage.js'
import { notifyPermissionChanged } from './permissions.js'

const request = axios.create({
  timeout: 10000
})

const authFailurePattern = /(鉴权失败|Token已过期|token expired|unauthorized|登录已过期|请重新登录)/i
const permissionFailurePattern = /无权限/i

const isAuthFailure = (payload, message = '') => {
  const status = payload && (payload.status || payload.statusCode || payload.code)
  if (status === 401) return true
  return authFailurePattern.test(String(message || getErrorMessage(payload, '')))
}

const rejectWithDisplayedError = (message) => {
  const error = new Error(message)
  error.__displayed = true
  return Promise.reject(error)
}

request.interceptors.request.use(
  config => {
    const token = getAdminToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

request.interceptors.response.use(
  response => {
    const res = response.data
    if (res.code !== 0) {
      const errMsg = getErrorMessage(res)
      if (permissionFailurePattern.test(errMsg)) notifyPermissionChanged()
      if (isAuthFailure(res, errMsg)) {
        handleSessionExpired(errMsg)
        return rejectWithDisplayedError(errMsg)
      }
      const suppressErrorMessage = response.config && response.config.suppressErrorMessage === true
      if (!suppressErrorMessage) ElMessage.error(errMsg)
      return rejectWithDisplayedError(errMsg)
    }
    return res.data !== undefined ? res.data : res
  },
  error => {
    console.error('请求错误:', error)
    const responseData = error.response && error.response.data
    const errMsg = getErrorMessage(responseData, error.message || '网络错误')
    if (permissionFailurePattern.test(errMsg)) notifyPermissionChanged()
    if (isAuthFailure({ ...(responseData || {}), status: error.response && error.response.status }, errMsg)) {
      handleSessionExpired(errMsg)
      return rejectWithDisplayedError(errMsg)
    }
    const suppressErrorMessage = error.config && error.config.suppressErrorMessage === true
    if (!suppressErrorMessage) ElMessage.error(errMsg)
    return rejectWithDisplayedError(errMsg)
  }
)

export default request
