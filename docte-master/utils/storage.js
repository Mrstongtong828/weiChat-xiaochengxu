const STORAGE_KEYS = Object.freeze({
	token: 'token',
	userInfo: 'userInfo',
	isLoggedIn: 'isLoggedIn'
})

export const getToken = () => String(uni.getStorageSync(STORAGE_KEYS.token) || '').trim()

export const setToken = (token = '') => {
	const value = String(token || '').trim()
	if (value) uni.setStorageSync(STORAGE_KEYS.token, value)
	else uni.removeStorageSync(STORAGE_KEYS.token)
	return value
}

export const getUserInfo = () => uni.getStorageSync(STORAGE_KEYS.userInfo) || {}

export const setUserInfo = (userInfo = {}) => {
	const value = userInfo && typeof userInfo === 'object' ? userInfo : {}
	uni.setStorageSync(STORAGE_KEYS.userInfo, value)
	return value
}

export const saveAuthSession = (data = {}) => {
	const token = setToken(data.token)
	const rawUserInfo = data.userInfo || data.user || {}
	const userInfo = setUserInfo({
		...rawUserInfo,
		userId: rawUserInfo.userId || rawUserInfo.id || data.userId || '',
		role: rawUserInfo.role || data.role || 'user'
	})

	if (token) uni.setStorageSync(STORAGE_KEYS.isLoggedIn, true)
	else uni.removeStorageSync(STORAGE_KEYS.isLoggedIn)

	return { ...data, token, userInfo }
}

export const clearAuthSession = () => {
	uni.removeStorageSync(STORAGE_KEYS.token)
	uni.removeStorageSync(STORAGE_KEYS.userInfo)
	uni.removeStorageSync(STORAGE_KEYS.isLoggedIn)
}
