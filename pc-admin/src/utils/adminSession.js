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

  // 使用 hash 路由（createWebHashHistory），真实路由在 # 之后，
  // 因此判断和跳转都要针对 hash，不能用 pathname / 无 # 的路径。
  if (!/^#\/login\b/.test(window.location.hash)) {
    window.location.replace(`${window.location.pathname}#/login`)
  }
}

export const resetSessionExpiredNotice = () => {
  sessionExpiredNotified = false
}
