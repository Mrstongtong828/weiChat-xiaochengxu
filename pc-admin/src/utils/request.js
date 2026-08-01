import axios from 'axios'
import { ElMessage } from 'element-plus'
import { handleSessionExpired } from './adminSession.js'
import { getErrorMessage } from './errorMessage.js'

const request = axios.create({
  timeout: 10000
})

const authFailurePattern = /(鉴权失败|无权限|Token已过期|token expired|unauthorized|登录已过期|请重新登录)/i

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
    const token = localStorage.getItem('adminToken')
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
      if (isAuthFailure(res, errMsg)) {
        handleSessionExpired(errMsg)
        return rejectWithDisplayedError(errMsg)
      }
      ElMessage.error(errMsg)
      return rejectWithDisplayedError(errMsg)
    }
    return res.data !== undefined ? res.data : res
  },
  error => {
    console.error('请求错误:', error)
    const responseData = error.response && error.response.data
    const errMsg = getErrorMessage(responseData, error.message || '网络错误')
    if (isAuthFailure({ ...(responseData || {}), status: error.response && error.response.status }, errMsg)) {
      handleSessionExpired(errMsg)
      return rejectWithDisplayedError(errMsg)
    }
    ElMessage.error(errMsg)
    return rejectWithDisplayedError(errMsg)
  }
)

export default request
