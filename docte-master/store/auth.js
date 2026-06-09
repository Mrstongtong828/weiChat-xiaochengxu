import { ref, computed } from 'vue'
import * as authApi from '@/api/auth.js'

const userInfo = ref(uni.getStorageSync('userInfo') || null)
const token = ref(uni.getStorageSync('token') || '')
const isLoggedIn = computed(() => Boolean(token.value))

export const initAuth = () => {
	const savedToken = uni.getStorageSync('token')
	const savedUserInfo = uni.getStorageSync('userInfo')

	token.value = savedToken || ''
	userInfo.value = savedUserInfo || null

	if (savedToken) {
		uni.setStorageSync('isLoggedIn', true)
	} else {
		uni.removeStorageSync('isLoggedIn')
	}
}

export const checkLogin = () => Boolean(token.value)

export const sendCode = async (phone) => {
	try {
		await authApi.sendSmsCode(phone)
		return { success: true, message: '验证码已发送' }
	} catch (error) {
		return { success: false, message: error.message || '发送失败' }
	}
}

export const login = async (phone, code) => {
	try {
		const res = await authApi.loginWithCode(phone, code)
		const nextToken = res.token || ''
		const nextUserInfo = res.userInfo || {}

		token.value = nextToken
		userInfo.value = nextUserInfo

		uni.setStorageSync('token', nextToken)
		uni.setStorageSync('userInfo', nextUserInfo)
		uni.setStorageSync('isLoggedIn', Boolean(nextToken))

		return { success: true, data: res }
	} catch (error) {
		return { success: false, message: error.message || '登录失败' }
	}
}

export const logout = async () => {
	try {
		if (token.value) {
			await authApi.logout()
		}
	} catch (error) {
		console.warn('Logout API error:', error)
	} finally {
		token.value = ''
		userInfo.value = null
		uni.removeStorageSync('token')
		uni.removeStorageSync('userInfo')
		uni.removeStorageSync('isLoggedIn')
	}
}

export const fetchUserInfo = async () => {
	try {
		const res = await authApi.getUserInfo()
		userInfo.value = res || {}
		uni.setStorageSync('userInfo', userInfo.value)
		return { success: true, data: res }
	} catch (error) {
		return { success: false, message: error.message || '获取用户信息失败' }
	}
}

export const updateProfile = async (data) => {
	try {
		const res = await authApi.updateUserInfo(data)
		userInfo.value = { ...(userInfo.value || {}), ...data }
		uni.setStorageSync('userInfo', userInfo.value)
		return { success: true, data: res }
	} catch (error) {
		return { success: false, message: error.message || '更新失败' }
	}
}

export const getToken = () => token.value

export const useAuth = () => ({
	userInfo,
	token,
	isLoggedIn,
	initAuth,
	checkLogin,
	sendCode,
	login,
	logout,
	fetchUserInfo,
	updateProfile,
	getToken
})
