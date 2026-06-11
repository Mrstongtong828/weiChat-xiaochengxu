import { ref, computed } from 'vue'
import * as authApi from '@/api/auth.js'

// 全局用户状态
const userInfo = ref(null)
const token = ref(uni.getStorageSync('token') || '')
const isLoggedIn = computed(() => !!token.value)

// 初始化用户状态
export const initAuth = () => {
	const savedToken = uni.getStorageSync('token')
	const savedUserInfo = uni.getStorageSync('userInfo')
	
	if (savedToken) {
		token.value = savedToken
		userInfo.value = savedUserInfo
	}
}

// 检查登录状态
export const checkLogin = () => {
	return !!token.value
}

// 退出登录
export const logout = async () => {
	try {
		if (token.value) {
			await authApi.logout()
		}
	} catch (error) {
		console.warn('Logout API error:', error)
	} finally {
		// 清理本地数据
		token.value = ''
		userInfo.value = null
		uni.removeStorageSync('token')
		uni.removeStorageSync('userInfo')
	}
}

// 获取用户信息
export const fetchUserInfo = async () => {
	try {
		const res = await authApi.getUserInfo()
		userInfo.value = res
		uni.setStorageSync('userInfo', res)
		return { success: true, data: res }
	} catch (error) {
		return { success: false, message: error.message || '获取用户信息失败' }
	}
}

// 更新用户信息
export const updateProfile = async (data) => {
	try {
		const res = await authApi.updateUserInfo(data)
		userInfo.value = { ...userInfo.value, ...data }
		uni.setStorageSync('userInfo', userInfo.value)
		return { success: true, data: res }
	} catch (error) {
		return { success: false, message: error.message || '更新失败' }
	}
}

// 获取 Token
export const getToken = () => token.value

export const useAuth = () => {
	return {
		userInfo,
		token,
		isLoggedIn,
		initAuth,
		checkLogin,
		logout,
		fetchUserInfo,
		updateProfile,
		getToken
	}
}
