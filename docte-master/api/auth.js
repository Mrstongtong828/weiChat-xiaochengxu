let userCloudObject = null

const getCloudObject = () => {
  if (!userCloudObject) {
    userCloudObject = uniCloud.importObject('cicada-client-user')
  }
  return userCloudObject
}

const getToken = () => uni.getStorageSync('token') || ''

const clearAuthSession = () => {
  uni.removeStorageSync('token')
  uni.removeStorageSync('userInfo')
  uni.removeStorageSync('isLoggedIn')
}

const unwrapCloudResult = (result = {}) => {
  if (result.code === 0 || result.code === undefined) return result.data === undefined ? result : result.data
  if ([401, 1004, 100401].includes(Number(result.code))) clearAuthSession()
  throw new Error(result.message || result.msg || '认证失败')
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
  const data = await cloudObject[method](normalizeLoginParams(params)).then(unwrapCloudResult)
  return persistAuthSession(data)
}

export const loginWithPhone = () => {
  return Promise.reject(new Error('暂不支持手机号直登，请使用微信手机号授权登录'))
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

export const loginWithWechat = (params = {}) => {
  return runLogin('loginWithWechat', params)
}

export const wechatLogin = loginWithWechat
