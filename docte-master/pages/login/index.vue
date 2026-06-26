<template>
	<view class="page-shell login-image-page">
		<view class="login-back-button tap" @click="goBack">
			<view></view>
		</view>
		<image class="login-auth-image" :src="cicadaAssets.loginAuthBg" mode="widthFix"></image>
		<button
			class="login-auth-button tap"
			:class="{ loading: loading, disabled: !agreed }"
			:disabled="loading"
			:open-type="agreed ? 'getPhoneNumber' : ''"
			@click="onLoginButtonTap"
			@getphonenumber="onGetPhoneNumber"
		>
			<text>{{ retrying ? '正在重试...' : loading ? '登录中...' : '微信一键登录' }}</text>
		</button>
		<view class="login-consent-panel">
			<text v-if="!agreed" class="login-error login-image-error">请先勾选同意协议，再点击微信一键登录</text>
			<view class="login-consent-check tap" @click="toggleAgreement">
				<view :class="['login-checkbox', { checked: agreed }]">
					<text v-if="agreed">✓</text>
				</view>
				<text>我已阅读并同意</text>
				<text class="login-policy-link" @click.stop="openPolicy('user')">《用户协议》</text>
				<text>与</text>
				<text class="login-policy-link" @click.stop="openPolicy('privacy')">《隐私政策》</text>
			</view>
		</view>
		<PrivacyConsent />
	</view>
</template>
<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { cicadaAssets } from '@/config/cicada-assets'
import { wechatLogin } from '@/api/content'
import PrivacyConsent from '@/components/PrivacyConsent.vue'
import { getLoginErrorMessage, loginWithWechatPhoneCode, normalizePhoneAuthDetail } from '@/utils/wechat-phone-login.js'
import { getWechatPrivacyReady, requestWechatPrivacyAuthorization } from '@/utils/wechat-privacy.js'

const agreed = ref(false)
const loading = ref(false)
const retrying = ref(false)
const loginError = ref('')
const privacyReady = ref(false)

const openPolicy = (type) => {
	uni.navigateTo({ url: `/pages/legal/index?type=${type === 'privacy' ? 'privacy' : 'user'}` })
}

const toggleAgreement = async () => {
	const nextValue = !agreed.value
	agreed.value = nextValue
	if (!nextValue) {
		loginError.value = ''
		return
	}

	loginError.value = ''
	if (!privacyReady.value) {
		try {
			await requestWechatPrivacyAuthorization()
			privacyReady.value = true
		} catch (error) {
			agreed.value = false
			loginError.value = ''
			uni.showToast({ title: '请先完成微信隐私授权', icon: 'none' })
		}
	}
}

const onLoginButtonTap = () => {
	if (!agreed.value) onLoginDisabledTap()
}

const onLoginDisabledTap = () => {
	loginError.value = ''
	uni.showToast({ title: '请勾选同意《用户协议》和《隐私政策》后再登录', icon: 'none' })
}

const showLoginError = (message) => {
	loginError.value = message
	uni.showToast({ title: message, icon: 'none' })
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
		uni.setStorageSync('token', res.token)
		uni.setStorageSync('userInfo', res.userInfo || {})
		uni.setStorageSync('isLoggedIn', true)

		uni.showToast({ title: message || (res.offline ? '体验登录成功' : '登录成功'), icon: 'success' })

		setTimeout(() => {
			goBackAfterLogin()
		}, 1200)
		return true
	}
	showLoginError('登录响应缺少 token')
	return false
}

onMounted(async () => {
	uni.$on('wechatPrivacyReady', syncWechatPrivacyReady)
	privacyReady.value = await getWechatPrivacyReady()
})

onUnmounted(() => {
	uni.$off('wechatPrivacyReady', syncWechatPrivacyReady)
})

const syncWechatPrivacyReady = () => {
	privacyReady.value = true
}

// 先完成微信手机号授权，再通过 wx.login code 获取 openid 作为账号身份登录。
const onGetPhoneNumber = async (e) => {
	if (loading.value) return
	loginError.value = ''
	retrying.value = false

	if (!agreed.value) {
		onLoginDisabledTap()
		return
	}

	const authDetail = normalizePhoneAuthDetail(e.detail || {})
	if (!authDetail.ok) {
		console.warn('wechat getPhoneNumber failed:', authDetail.raw || e.detail || {})
		if (authDetail.privacyBlocked) {
			agreed.value = false
			loginError.value = ''
			privacyReady.value = false
			uni.showToast({ title: '请重新勾选并完成隐私授权', icon: 'none' })
		} else if (!authDetail.canceled) {
			showLoginError(authDetail.message)
		} else {
			loginError.value = ''
		}
		return
	}

	loading.value = true

	try {
		const res = await loginWithWechatPhoneCode(wechatLogin, authDetail.phoneCode, {
			retries: 1,
			onRetry: () => {
				retrying.value = true
				loginError.value = '微信登录失败，正在自动重试...'
			}
		})

		applyLoginSuccess(res, '登录成功')
	} catch (error) {
		showLoginError(getLoginErrorMessage(error))
	} finally {
		loading.value = false
		retrying.value = false
	}
}

</script>

<style scoped>
.login-image-page {
	position: relative;
	min-height: 100vh;
	overflow: hidden;
	background: #F4F9FF;
	box-sizing: border-box;
}

.login-auth-image {
	position: absolute;
	left: 50%;
	top: 52rpx;
	width: 750rpx;
	z-index: 1;
	transform: translateX(-50%);
}

.login-back-button {
	position: absolute;
	left: 32rpx;
	top: 88rpx;
	z-index: 8;
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.94);
	box-shadow: 0 10rpx 24rpx rgba(30, 111, 224, 0.14);
}

.login-back-button view {
	width: 20rpx;
	height: 20rpx;
	margin-left: 8rpx;
	border-left: 4rpx solid #2B7DE9;
	border-bottom: 4rpx solid #2B7DE9;
	transform: rotate(45deg);
}

.login-auth-button {
	position: absolute;
	left: 74rpx;
	top: 1090rpx;
	z-index: 3;
	width: 602rpx;
	height: 120rpx;
	padding: 0;
	border: none;
	background: transparent;
	color: transparent;
	font-size: 1rpx;
	line-height: 120rpx;
	opacity: 0.01;
}

.login-auth-button::after {
	border: none;
}

.login-auth-button[disabled] {
	opacity: 0.01;
}

.login-consent-panel {
	position: absolute;
	left: 75rpx;
	top: 1238rpx;
	z-index: 5;
	width: 600rpx;
	min-height: 72rpx;
	padding: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	gap: 12rpx;
	background: transparent;
	box-sizing: border-box;
}

.login-consent-check {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: 7rpx;
	font-size: 23rpx;
	line-height: 1.4;
	color: #5F6E86;
	text-align: center;
}

.login-checkbox {
	width: 28rpx;
	height: 28rpx;
	flex: 0 0 28rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid #9AA9BF;
	border-radius: 6rpx;
	background: rgba(255, 255, 255, 0.9);
	box-sizing: border-box;
}

.login-checkbox.checked {
	border-color: #1E7DF2;
	background: #1E7DF2;
}

.login-checkbox text {
	font-size: 22rpx;
	line-height: 1;
	color: #FFFFFF;
	font-weight: 900;
}

.login-policy-link {
	color: #1E7DF2;
	text-decoration: underline;
}

.login-image-error {
	width: 100%;
	padding: 0;
	text-align: center;
	font-size: 21rpx;
	line-height: 1.45;
	color: #E5484D;
}

.phone-login {
	position: absolute;
	left: 220rpx;
	top: 1280rpx;
	z-index: 4;
	width: 310rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid #E4ECF7;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.82);
	color: #0F1F3A;
	font-size: 26rpx;
	font-weight: 700;
}
</style>
