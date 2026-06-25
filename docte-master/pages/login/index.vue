<template>
	<view class="page-shell login-image-page">
		<view class="login-back-button tap" @click="goBack">
			<view></view>
		</view>
		<image class="login-auth-image" :src="cicadaAssets.loginAuthBg" mode="widthFix"></image>
		<button
			class="login-auth-button tap"
			:class="{ loading: loading, disabled: !agreed }"
			:disabled="loading || !agreed"
			:open-type="agreed ? (privacyReady ? 'getPhoneNumber' : 'agreePrivacyAuthorization') : ''"
			@agreeprivacyauthorization="onAgreePrivacyAuthorization"
			@getphonenumber="onGetPhoneNumber"
		>
			<text>{{ retrying ? '正在重试...' : loading ? '登录中...' : privacyReady ? '微信一键登录' : '同意隐私政策并登录' }}</text>
		</button>
		<view v-if="!agreed" class="login-button-mask"></view>
		<text class="login-error login-image-error">{{ loginError || '请先同意隐私政策授权，再重新点击微信手机号授权登录' }}</text>
		<view class="login-consent-check tap" @click="toggleAgreement">
			<view :class="['login-checkbox', { checked: agreed }]">
				<text v-if="agreed">✓</text>
			</view>
			<text>我已阅读并同意</text>
			<text class="login-policy-link" @click.stop="openPolicy('user')">《用户协议》</text>
			<text>与</text>
			<text class="login-policy-link" @click.stop="openPolicy('privacy')">《隐私政策》</text>
		</view>
		<view class="login-agreement-clean">
			<text>登录即表示您已阅读并同意</text>
			<view>
				<text @click="openPolicy('user')">《用户协议》</text>
				<text>及</text>
				<text @click="openPolicy('privacy')">《隐私政策》</text>
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
import { getWechatPrivacyReady, markWechatPrivacyReady } from '@/utils/wechat-privacy.js'

const agreed = ref(false)
const loading = ref(false)
const retrying = ref(false)
const loginError = ref('')
const privacyReady = ref(false)

const openPolicy = (type) => {
	uni.navigateTo({ url: `/pages/legal/index?type=${type === 'privacy' ? 'privacy' : 'user'}` })
}

const toggleAgreement = () => {
	agreed.value = !agreed.value
	if (agreed.value) loginError.value = ''
}

const showLoginError = (message) => {
	loginError.value = message
	if (String(message).length > 16) {
		uni.showModal({
			title: '登录失败',
			content: message,
			showCancel: false,
			confirmText: '知道了'
		})
		return
	}
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

const onAgreePrivacyAuthorization = () => {
	markWechatPrivacyReady()
	syncWechatPrivacyReady()
	loginError.value = ''
}

// 先完成微信手机号授权，再通过 wx.login code 获取 openid 作为账号身份登录。
const onGetPhoneNumber = async (e) => {
	if (loading.value) return
	loginError.value = ''
	retrying.value = false

	if (!agreed.value) {
		showLoginError('请先勾选同意用户协议与隐私政策')
		return
	}

	const authDetail = normalizePhoneAuthDetail(e.detail || {})
	if (!authDetail.ok) {
		console.warn('wechat getPhoneNumber failed:', authDetail.raw || e.detail || {})
		if (!authDetail.canceled) showLoginError(authDetail.message)
		else loginError.value = authDetail.message
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

.login-auth-button.loading,
.login-auth-button[disabled] {
	opacity: 0.01;
}

.login-button-mask {
	position: absolute;
	left: 74rpx;
	top: 1090rpx;
	z-index: 4;
	width: 602rpx;
	height: 120rpx;
	border-radius: 26rpx;
	background: rgba(170, 181, 197, 0.48);
	pointer-events: none;
}

.login-consent-check {
	position: absolute;
	left: 74rpx;
	top: 1220rpx;
	z-index: 5;
	width: 602rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: 8rpx;
	font-size: 24rpx;
	line-height: 1.5;
	color: #6C7890;
	text-align: center;
}

.login-checkbox {
	width: 28rpx;
	height: 28rpx;
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
}

.login-agreement-clean {
	position: absolute;
	left: 74rpx;
	top: 1276rpx;
	z-index: 4;
	width: 602rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
	text-align: center;
	font-size: 25rpx;
	line-height: 1.6;
	color: #7B8797;
}

.login-agreement-clean view {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	flex-wrap: wrap;
}

.login-agreement-clean view text:nth-child(odd) {
	color: #1E7DF2;
}

.login-image-error {
	position: absolute;
	left: 76rpx;
	top: 1192rpx;
	z-index: 5;
	width: 598rpx;
	padding: 0;
	text-align: center;
	font-size: 24rpx;
	line-height: 1.5;
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
