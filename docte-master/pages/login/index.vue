<template>
	<view class="page-shell">
		<WechatLoginPanel
			:loading="loading"
			:retrying="retrying"
			:agreed="agreed"
			@back="goBack"
			@login="onLoginButtonTap"
			@toggle-agreement="toggleAgreement"
			@open-policy="openPolicy"
		/>
		<PrivacyConsent />
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { wechatLogin } from '@/api/user.js'
import PrivacyConsent from '@/components/PrivacyConsent.vue'
import WechatLoginPanel from '@/components/WechatLoginPanel.vue'
import { getLoginErrorMessage, isLoginCancelledError, loginWithWechatOpenid } from '@/utils/wechat-phone-login.js'
import { toCustomerErrorMessage } from '@/utils/customer-error.js'
import { saveAuthSession } from '@/utils/storage.js'

const agreed = ref(false)
const loading = ref(false)
const retrying = ref(false)

const openPolicy = (type) => {
	uni.navigateTo({ url: `/pages-sub/legal/index?type=${type === 'privacy' ? 'privacy' : 'user'}` })
}

const toggleAgreement = async () => {
	agreed.value = !agreed.value
}

const onLoginButtonTap = () => {
	if (!agreed.value) {
		onLoginDisabledTap()
		return
	}
	doWechatLogin()
}

const onLoginDisabledTap = () => {
	const message = '请先阅读并同意用户协议和隐私政策'
	uni.showToast({ title: message, icon: 'none' })
}

const showLoginError = (message) => {
	if (message) uni.showToast({ title: message, icon: 'none' })
}

const goBackAfterLogin = () => {
	uni.navigateBack({
		fail: () => uni.reLaunch({ url: '/pages/index/index' })
	})
}

const goBack = () => {
	uni.navigateBack({
		fail: () => uni.reLaunch({ url: '/pages/index/index' })
	})
}

const applyLoginSuccess = (res = {}, message = '') => {
	if (res && res.token) {
		saveAuthSession(res)

		uni.showToast({ title: message || (res.offline ? '体验登录成功' : '登录成功'), icon: 'success' })

		setTimeout(() => {
			goBackAfterLogin()
		}, 1200)
		return true
	}
	showLoginError(toCustomerErrorMessage('token missing', '登录状态获取失败，请重新登录'))
	return false
}

// 微信一键登录：仅通过 wx.login code 换取 openid 作为账号身份，不再获取手机号。
const doWechatLogin = async () => {
	if (loading.value) return
	retrying.value = false
	loading.value = true

	try {
		const res = await loginWithWechatOpenid(wechatLogin, {
			retries: 1,
			onRetry: () => {
				retrying.value = true
			}
		})

		applyLoginSuccess(res, '登录成功')
	} catch (error) {
		if (isLoginCancelledError(error)) return
		showLoginError(getLoginErrorMessage(error))
	} finally {
		loading.value = false
		retrying.value = false
	}
}
</script>
