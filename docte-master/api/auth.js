import { clearAuthSession, getToken, unwrapCloudResult } from './cloudHelpers.js'
import { importCloudObject } from '@/utils/cloud.js'

let userCloudObject = null

const getCloudObject = () => {
  if (!userCloudObject) {
    userCloudObject = importCloudObject('cicada-client-user')
  }
  if (!userCloudObject) {
    throw new Error('云对象 cicada-client-user 未连接，请先在 HBuilderX 关联云空间并部署该云对象')
  }
  return userCloudObject
}

const persistAuthSession = (data = {}) => {
  const token = data.token || ''
  const rawUserInfo = data.userInfo || data.user || {}
  const userInfo = {
    ...rawUserInfo,
    userId: rawUserInfo.userId || rawUserInfo.id || data.userId || '',
    role: rawUserInfo.role || data.role || 'user'
  }

  if (token) uni.setStorageSync('token', token)
  if (Object.keys(userInfo).length) uni.setStorageSync('userInfo', userInfo)
  if (token) uni.setStorageSync('isLoggedIn', true)

  return { ...data, token, userInfo }
}

const normalizeLoginParams = (params = {}) => (
  typeof params === 'string' ? { code: params } : params
)

const runLogin = async (method, params = {}) => {
  const cloudObject = getCloudObject()
  if (!cloudObject || typeof cloudObject[method] !== 'function') {
    throw new Error('云端登录方法未部署，请重新部署 cicada-client-user')
  }
  const data = await cloudObject[method](normalizeLoginParams(params)).then(unwrapCloudResult)
  return persistAuthSession(data)
}

export const login = (params = {}) => {
  return runLogin('login', params)
}

export const logout = async () => {
  const cloudObject = getCloudObject()
  const token = getToken()

  if (typeof cloudObject.logout === 'function' && token) {
    await cloudObject.logout({ token }).then(unwrapCloudResult)
  }

  clearAuthSession()
  return { success: true }
}

// 用户自助注销账号：调用后端软删除+脱敏，成功后清除本地登录态
export const cancelAccount = async () => {
  const cloudObject = getCloudObject()
  const token = getToken()
  if (!token) {
    clearAuthSession()
    throw new Error('未登录')
  }
  if (typeof cloudObject.cancelAccount !== 'function') {
    throw new Error('云端注销方法未部署，请重新部署 cicada-client-user')
  }
  await cloudObject.cancelAccount({ token, confirm: true }).then(unwrapCloudResult)
  clearAuthSession()
  return { success: true }
}

export const getUserInfo = async () => {
  const token = getToken()
  if (!token) {
    clearAuthSession()
    throw new Error('未登录')
  }

  const userInfo = await getCloudObject().getUserInfo({ token }).then(unwrapCloudResult)
  uni.setStorageSync('userInfo', userInfo || {})
  uni.setStorageSync('isLoggedIn', true)
  return userInfo
}

// 微信授权登录统一走 login({ code, phoneCode })（code 换 openid、phoneCode 换真实手机号）。
// 原 loginWithWechat 已随后端废弃移除。
export const wechatLogin = (params = {}) => {
  return runLogin('login', params)
}
