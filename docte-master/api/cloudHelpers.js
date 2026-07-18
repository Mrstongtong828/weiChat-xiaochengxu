export const AUTH_ERROR_CODES = [401, 1004, 100401]

export const getToken = () => uni.getStorageSync('token') || ''

export const clearAuthSession = () => {
  uni.removeStorageSync('token')
  uni.removeStorageSync('userInfo')
  uni.removeStorageSync('isLoggedIn')
}

export const withToken = (params = {}) => ({
  ...params,
  token: params.token || getToken()
})

export const unwrapCloudResult = (result = {}, fallbackMessage = '请求失败') => {
  if (!result || typeof result !== 'object') return result
  if (result.code === 0 || result.code === undefined) {
    return result.data === undefined ? result : result.data
  }
  if (AUTH_ERROR_CODES.includes(Number(result.code))) clearAuthSession()
  throw new Error(result.message || result.msg || fallbackMessage)
}

const getFileExt = (filePath = '', fallback = 'jpg') => {
  const cleanPath = String(filePath || '').split('?')[0]
  const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/)
  return (match ? match[1] : fallback).toLowerCase()
}

export const buildCloudPath = (filePath, dir = 'uploads', fallbackExt = 'jpg') => {
  const ext = getFileExt(filePath, fallbackExt)
  const suffix = Math.random().toString(16).slice(2)
  return `${dir}/${Date.now()}_${suffix}.${ext}`
}

export const uploadToCloud = (filePath, dir = 'uploads', fallbackExt = 'jpg') => new Promise((resolve, reject) => {
  uniCloud.uploadFile({
    filePath,
    cloudPath: buildCloudPath(filePath, dir, fallbackExt),
    success: (res) => resolve({ url: res.fileID, fileID: res.fileID }),
    fail: reject
  })
})
