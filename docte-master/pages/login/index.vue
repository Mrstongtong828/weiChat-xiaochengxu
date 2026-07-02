<template>
	<view class="page-shell login-image-page">
		<view class="login-back-button tap" @click="goBack">
			<view></view>
		</view>
		<view class="login-device-ghost"></view>
		<view class="login-brand-panel">
			<image class="login-brand-logo" :src="cicadaAssets.wordmarkRegistered" mode="aspectFit"></image>
			<text class="login-brand-title">思科达售后服务中心</text>
			<view class="login-brand-slogan">
				<view></view>
				<text>追 求 极 致 稳 定 性</text>
				<view></view>
			</view>
		</view>
		<button
			class="login-auth-button tap"
			:class="{ loading: loading, disabled: !agreed }"
			:disabled="loading"
			:open-type="agreed ? 'getPhoneNumber' : ''"
			@click="onLoginButtonTap"
			@getphonenumber="onGetPhoneNumber"
		>
			<view class="wechat-login-icon">
				<view></view>
				<view></view>
			</view>
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
			<text class="login-save-tip">首次登录后将自动保存账号，下次可直接进入</text>
		</view>
		<view class="phone-login" @click="onDevLogin">开发测试登录</view>
		<PrivacyConsent />
	</view>
</template>
<script setup>
import { ref } from 'vue'
import { cicadaAssets } from '@/config/cicada-assets'
import { devLogin, wechatLogin } from '@/api/content'
import PrivacyConsent from '@/components/PrivacyConsent.vue'
import { getLoginErrorMessage, loginWithWechatPhoneCode, normalizePhoneAuthDetail } from '@/utils/wechat-phone-login.js'

const agreed = ref(false)
const loading = ref(false)
const retrying = ref(false)
const loginError = ref('')

const openPolicy = (type) => {
	uni.navigateTo({ url: `/pages/legal/index?type=${type === 'privacy' ? 'privacy' : 'user'}` })
}

const toggleAgreement = async () => {
	const nextValue = !agreed.value
	agreed.value = nextValue
	loginError.value = ''
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

const onDevLogin = async () => {
	if (loading.value) return
	loading.value = true
	try {
		const res = await devLogin()
		applyLoginSuccess(res, '测试登录成功')
	} catch (error) {
		console.warn('dev login failed:', error)
		showLoginError(error.message || '开发登录失败')
	} finally {
		loading.value = false
	}
}

</script>

<style scoped>
.login-image-page {
	position: relative;
	min-height: 100vh;
	overflow: hidden;
	padding: 0 64rpx 80rpx;
	background:
		radial-gradient(circle at 8% 14%, rgba(167, 209, 255, 0.34) 0%, rgba(167, 209, 255, 0) 32%),
		linear-gradient(180deg, #F5FAFF 0%, #FFFFFF 54%, #F6FAFF 100%);
	box-sizing: border-box;
}

.login-auth-image {
	display: none;
}

.login-device-ghost {
	position: absolute;
	right: -110rpx;
	top: 430rpx;
	z-index: 1;
	width: 260rpx;
	height: 530rpx;
	border: 8rpx solid rgba(62, 157, 235, 0.12);
	border-radius: 80rpx;
	transform: rotate(18deg);
}

.login-device-ghost::before,
.login-device-ghost::after {
	content: "";
	position: absolute;
	box-sizing: border-box;
}

.login-device-ghost::before {
	left: 46rpx;
	top: 72rpx;
	width: 120rpx;
	height: 300rpx;
	border: 6rpx solid rgba(62, 157, 235, 0.1);
	border-radius: 60rpx;
}

.login-device-ghost::after {
	left: 86rpx;
	bottom: 48rpx;
	width: 86rpx;
	height: 86rpx;
	border: 6rpx solid rgba(62, 157, 235, 0.1);
	border-radius: 50%;
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

.login-brand-panel {
	position: relative;
	z-index: 2;
	padding-top: 420rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.login-brand-logo {
	width: 460rpx;
	height: 98rpx;
}

.login-brand-title {
	margin-top: 118rpx;
	font-size: 54rpx;
	font-weight: 800;
	line-height: 1.2;
	color: #10264A;
	letter-spacing: 1rpx;
}

.login-brand-slogan {
	margin-top: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 24rpx;
}

.login-brand-slogan view {
	width: 72rpx;
	height: 2rpx;
	background: #2B8BFF;
}

.login-brand-slogan text {
	font-size: 29rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #1684F6;
	letter-spacing: 6rpx;
}

.login-auth-button {
	position: relative;
	z-index: 3;
	width: 100%;
	height: 124rpx;
	margin: 256rpx 0 0;
	padding: 0;
	border: none;
	border-radius: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 24rpx;
	background: linear-gradient(135deg, #46A0FF 0%, #0075F6 100%);
	box-shadow: 0 22rpx 44rpx rgba(0, 117, 246, 0.22);
	color: #FFFFFF;
	font-size: 34rpx;
	font-weight: 800;
	line-height: 124rpx;
}

.login-auth-button::after {
	border: none;
}

.login-auth-button[disabled] {
	opacity: 0.7;
}

.wechat-login-icon {
	position: relative;
	width: 64rpx;
	height: 50rpx;
	flex-shrink: 0;
}

.wechat-login-icon view {
	position: absolute;
	border-radius: 50%;
	background: #FFFFFF;
}

.wechat-login-icon view:first-child {
	left: 0;
	top: 0;
	width: 42rpx;
	height: 36rpx;
}

.wechat-login-icon view:first-child::before,
.wechat-login-icon view:first-child::after,
.wechat-login-icon view:last-child::before,
.wechat-login-icon view:last-child::after {
	content: "";
	position: absolute;
	width: 5rpx;
	height: 5rpx;
	border-radius: 50%;
	background: #1684F6;
}

.wechat-login-icon view:first-child::before {
	left: 11rpx;
	top: 13rpx;
}

.wechat-login-icon view:first-child::after {
	left: 25rpx;
	top: 13rpx;
}

.wechat-login-icon view:last-child {
	right: 0;
	bottom: 0;
	width: 38rpx;
	height: 32rpx;
	box-shadow: 0 0 0 4rpx #1684F6;
}

.wechat-login-icon view:last-child::before {
	left: 10rpx;
	top: 11rpx;
}

.wechat-login-icon view:last-child::after {
	left: 23rpx;
	top: 11rpx;
}

.login-consent-panel {
	position: relative;
	z-index: 5;
	width: 100%;
	min-height: 72rpx;
	margin-top: 80rpx;
	padding: 0 12rpx;
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
	color: #8A97AA;
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

.login-save-tip {
	margin-top: 34rpx;
	font-size: 24rpx;
	line-height: 1.4;
	color: #A2ACBA;
	text-align: center;
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
	position: relative;
	z-index: 4;
	width: 280rpx;
	height: 64rpx;
	margin: 38rpx auto 0;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid rgba(30, 111, 224, 0.18);
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.72);
	color: #1E6FE0;
	font-size: 24rpx;
	font-weight: 700;
}
</style>
