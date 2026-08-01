import { clearAuthSession, getToken, unwrapCloudResult } from './cloudHelpers.js'
import { importCloudObject } from '@/utils/cloud.js'

let userCloudObject = null

const getCloudObject = () => {
  if (!userCloudObject) {
    const next = importCloudObject('cicada-client-user')
    if (next) userCloudObject = next
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

// 用户自助修改资料（昵称/头像）。avatar 传 cloud:// fileID，成功后回写本地登录态
export const updateProfile = async ({ nickname, avatar } = {}) => {
  const token = getToken()
  if (!token) {
    clearAuthSession()
    throw new Error('未登录')
  }
  const cloudObject = getCloudObject()
  if (typeof cloudObject.updateProfile !== 'function') {
    throw new Error('云端资料修改方法未部署，请重新部署 cicada-client-user')
  }
  const payload = { token }
  if (nickname !== undefined) payload.nickname = nickname
  if (avatar !== undefined) payload.avatar = avatar

  const userInfo = await cloudObject.updateProfile(payload).then(unwrapCloudResult)
  uni.setStorageSync('userInfo', userInfo || {})
  return userInfo
}

// 微信登录只使用 login({ code }) 换取 openid，报修联系电话不作为身份凭据。
export const wechatLogin = (params = {}) => {
  return runLogin('login', params)
}
