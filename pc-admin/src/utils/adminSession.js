import { ElMessage } from 'element-plus'

let sessionExpiredNotified = false

export const clearAdminSession = () => {
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminUser')
}

export const handleSessionExpired = (message = '登录已过期，请重新登录') => {
  clearAdminSession()

  if (!sessionExpiredNotified) {
    sessionExpiredNotified = true
    ElMessage.warning(message)
  }

  if (window.location.pathname !== '/login') {
    window.location.replace('/login')
  }
}

export const resetSessionExpiredNotice = () => {
  sessionExpiredNotified = false
}
