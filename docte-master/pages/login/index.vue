<template>
	<view class="page-shell">
		<view class="bg-orb bg-orb-left"></view>
		<view class="bg-orb bg-orb-right"></view>
		<image class="bg-device" :src="cicadaAssets.photoFactory" mode="aspectFill"></image>

		<view class="login-content">
			<view class="brand-section">
				<view class="brand-logo-wrap">
					<image class="brand-logo" :src="cicadaAssets.brandToothBlue" mode="aspectFit"></image>
				</view>
				<text class="brand-name">思科达售后服务中心</text>
				<text class="brand-desc">专业牙科仪器维修 · 检测 · 保养服务</text>
			</view>

			<view class="service-card">
				<view class="service-item">
					<view class="service-icon">
						<view class="tool tool-wrench"></view>
						<view class="tool tool-screwdriver"></view>
					</view>
					<text class="service-title">专业维修</text>
					<text class="service-text">原厂标准流程</text>
					<text class="service-text">专业工程师团队</text>
				</view>
				<view class="service-divider"></view>
				<view class="service-item">
					<view class="service-icon">
						<view class="clipboard">
							<view class="clipboard-clip"></view>
							<view class="clipboard-line"></view>
							<view class="clipboard-line short"></view>
						</view>
					</view>
					<text class="service-title">工单查询</text>
					<text class="service-text">实时查看维修进度</text>
					<text class="service-text">全流程透明可追溯</text>
				</view>
				<view class="service-divider"></view>
				<view class="service-item">
					<view class="service-icon">
						<view class="shield">
							<view class="shield-check"></view>
						</view>
					</view>
					<text class="service-title">品质保障</text>
					<text class="service-text">原厂配件品质保障</text>
					<text class="service-text">维修记录永久留存</text>
				</view>
			</view>

			<button
				class="wechat-btn"
				:class="{ loading: loading }"
				:disabled="loading"
				:open-type="privacyReady ? 'getPhoneNumber' : 'agreePrivacyAuthorization'"
				@agreeprivacyauthorization="onAgreePrivacyAuthorization"
				@getphonenumber="onGetPhoneNumber"
			>
				<view class="wechat-icon">
					<view class="wechat-bubble bubble-main"></view>
					<view class="wechat-bubble bubble-sub"></view>
				</view>
				<text>{{ retrying ? '正在重试...' : loading ? '登录中...' : privacyReady ? '微信一键登录' : '同意隐私政策并登录' }}</text>
			</button>
			<text v-if="loginError" class="login-error">{{ loginError }}</text>

			<view class="agreement-wrap">
				<text class="agreement-text">登录即表示您已阅读并同意</text>
				<view class="agreement-links">
					<text class="link tap" @click="openPolicy('service')">《用户协议》</text>
					<text class="agreement-text">及</text>
					<text class="link tap" @click="openPolicy('privacy')">《隐私政策》</text>
				</view>
			</view>
		</view>
		<PolicyDialog v-model:visible="policyVisible" :title="policyTitle" :content="policyContent" />
		<PrivacyConsent />
	</view>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { cicadaAssets } from '@/config/cicada-assets'
import { wechatLogin, getCompliance } from '@/api/content'
import PolicyDialog from '@/components/PolicyDialog.vue'
import PrivacyConsent from '@/components/PrivacyConsent.vue'
import { getLoginErrorMessage, loginWithWechatPhoneCode, normalizePhoneAuthDetail } from '@/utils/wechat-phone-login.js'
import { getWechatPrivacyReady, markWechatPrivacyReady } from '@/utils/wechat-privacy.js'

const agreed = ref(true)
const loading = ref(false)
const retrying = ref(false)
const loginError = ref('')
const privacyReady = ref(false)

const policyVisible = ref(false)
const policyTitle = ref('')
const policyContent = ref('')

const openPolicy = async (type) => {
	policyTitle.value = type === 'privacy' ? '隐私政策' : '用户服务协议'
	policyVisible.value = true
	if (!policyContent.value) {
		try {
			const data = await getCompliance()
			policyContent.value = data.privacyPolicy || ''
		} catch (e) {
			policyContent.value = ''
		}
	}
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
	agreed.value = true
}

const onAgreePrivacyAuthorization = () => {
	markWechatPrivacyReady()
	syncWechatPrivacyReady()
	loginError.value = '已同意隐私政策，请再次点击获取手机号完成登录'
}

// 先完成微信手机号授权，再通过 wx.login code 获取 openid 作为账号身份登录。
const onGetPhoneNumber = async (e) => {
	if (loading.value) return
	loginError.value = ''
	retrying.value = false

	if (!agreed.value) {
		showLoginError('请先阅读并同意用户协议')
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
.page-shell {
	position: relative;
	min-height: 100vh;
	overflow: hidden;
	background: linear-gradient(180deg, #F4F9FF 0%, #EEF6FF 48%, #F8FCFF 100%);
	color: #13264A;
	font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
	box-sizing: border-box;
}

.page-shell::before {
	content: '';
	position: absolute;
	left: -180rpx;
	top: -260rpx;
	width: 720rpx;
	height: 720rpx;
	border-radius: 999rpx;
	background: rgba(211, 234, 255, 0.72);
}

.page-shell::after {
	content: '';
	position: absolute;
	right: -180rpx;
	bottom: -180rpx;
	width: 560rpx;
	height: 560rpx;
	border-radius: 999rpx;
	background: rgba(220, 239, 255, 0.82);
}

.tap:active,
.wechat-btn:active {
	opacity: 0.86;
	transform: scale(0.985);
}

.bg-orb {
	position: absolute;
	z-index: 1;
	border-radius: 999rpx;
	background-image: radial-gradient(rgba(44, 138, 245, 0.12) 18%, transparent 19%);
	background-size: 26rpx 26rpx;
}

.bg-orb-left {
	left: 78rpx;
	top: 128rpx;
	width: 160rpx;
	height: 160rpx;
}

.bg-orb-right {
	right: 72rpx;
	top: 390rpx;
	width: 190rpx;
	height: 190rpx;
}

.bg-device {
	position: absolute;
	right: -152rpx;
	top: 380rpx;
	z-index: 1;
	width: 310rpx;
	height: 520rpx;
	opacity: 0.12;
}

.login-content {
	position: relative;
	z-index: 5;
	min-height: 100vh;
	padding: 150rpx 48rpx 56rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: stretch;
}

.brand-section {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.brand-logo-wrap {
	width: 280rpx;
	height: 280rpx;
	padding: 16rpx;
	border-radius: 999rpx;
	background: #FFFFFF;
	box-shadow: 0 20rpx 48rpx rgba(30, 111, 224, 0.16);
	box-sizing: border-box;
}

.brand-logo {
	width: 100%;
	height: 100%;
	border-radius: 999rpx;
}

.brand-name {
	margin-top: 58rpx;
	font-size: 58rpx;
	font-weight: 800;
	line-height: 1.12;
	letter-spacing: 0;
	color: #122449;
	text-shadow: 0 8rpx 18rpx rgba(18, 36, 73, 0.1);
}

.brand-desc {
	margin-top: 28rpx;
	font-size: 29rpx;
	line-height: 1.35;
	color: #728096;
}

.service-card {
	margin-top: 64rpx;
	padding: 40rpx 22rpx;
	min-height: 246rpx;
	border-radius: 34rpx;
	background: rgba(255, 255, 255, 0.92);
	box-shadow: 0 22rpx 56rpx rgba(39, 116, 213, 0.13);
	display: flex;
	align-items: stretch;
	box-sizing: border-box;
}

.service-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	min-width: 0;
}

.service-divider {
	width: 1rpx;
	margin: 18rpx 16rpx 12rpx;
	background: #DCE7F5;
}

.service-icon {
	width: 100rpx;
	height: 100rpx;
	margin-bottom: 24rpx;
	border-radius: 999rpx;
	background: linear-gradient(180deg, #ECF6FF 0%, #E3F0FF 100%);
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
}

.service-title {
	font-size: 28rpx;
	font-weight: 800;
	line-height: 1.25;
	color: #122449;
	margin-bottom: 16rpx;
}

.service-text {
	font-size: 23rpx;
	line-height: 1.45;
	color: #78879B;
	white-space: nowrap;
}

.tool {
	position: absolute;
	background: #2D86F4;
	border-radius: 999rpx;
}

.tool-wrench {
	width: 46rpx;
	height: 12rpx;
	transform: rotate(-45deg);
}

.tool-wrench::before {
	content: '';
	position: absolute;
	left: -10rpx;
	top: -10rpx;
	width: 24rpx;
	height: 24rpx;
	border: 8rpx solid #2D86F4;
	border-right-color: transparent;
	border-radius: 999rpx;
	box-sizing: border-box;
}

.tool-screwdriver {
	width: 48rpx;
	height: 10rpx;
	transform: rotate(45deg);
}

.tool-screwdriver::after {
	content: '';
	position: absolute;
	right: -10rpx;
	top: -5rpx;
	width: 18rpx;
	height: 20rpx;
	background: #2D86F4;
	border-radius: 4rpx;
}

.clipboard {
	width: 42rpx;
	height: 54rpx;
	border: 7rpx solid #2D86F4;
	border-radius: 8rpx;
	position: relative;
	box-sizing: border-box;
}

.clipboard-clip {
	position: absolute;
	left: 50%;
	top: -16rpx;
	width: 24rpx;
	height: 18rpx;
	border: 6rpx solid #2D86F4;
	border-bottom: none;
	border-radius: 10rpx 10rpx 0 0;
	transform: translateX(-50%);
	box-sizing: border-box;
}

.clipboard-line {
	position: absolute;
	left: 8rpx;
	top: 16rpx;
	width: 18rpx;
	height: 5rpx;
	border-radius: 999rpx;
	background: #2D86F4;
}

.clipboard-line.short {
	top: 29rpx;
	width: 14rpx;
}

.shield {
	width: 54rpx;
	height: 62rpx;
	background: linear-gradient(180deg, #2F8DF8 0%, #176EE8 100%);
	border-radius: 22rpx 22rpx 28rpx 28rpx;
	position: relative;
}

.shield-check {
	position: absolute;
	left: 18rpx;
	top: 24rpx;
	width: 21rpx;
	height: 12rpx;
	border-left: 7rpx solid #FFFFFF;
	border-bottom: 7rpx solid #FFFFFF;
	transform: rotate(-45deg);
}

.wechat-btn {
	width: 100%;
	height: 116rpx;
	margin-top: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 26rpx;
	background: linear-gradient(135deg, #3C9CFF 0%, #0E6DF2 100%);
	border-radius: 30rpx;
	color: #FFFFFF;
	font-size: 32rpx;
	font-weight: 800;
	border: none;
	outline: none;
	box-shadow: 0 18rpx 40rpx rgba(29, 118, 239, 0.28);
	transition: transform 0.18s ease, opacity 0.18s ease;
}

.wechat-btn.loading,
.wechat-btn[disabled] {
	opacity: 0.72;
}

.wechat-btn::after {
	border: none;
}

.wechat-icon {
	position: relative;
	width: 58rpx;
	height: 46rpx;
}

.wechat-bubble {
	position: absolute;
	background: #FFFFFF;
	border-radius: 999rpx;
}

.bubble-main {
	left: 0;
	top: 2rpx;
	width: 42rpx;
	height: 34rpx;
}

.bubble-sub {
	right: 0;
	bottom: 0;
	width: 36rpx;
	height: 29rpx;
}

.wechat-bubble::before,
.wechat-bubble::after {
	content: '';
	position: absolute;
	top: 12rpx;
	width: 6rpx;
	height: 6rpx;
	border-radius: 999rpx;
	background: #2E86F4;
}

.bubble-main::before { left: 12rpx; }
.bubble-main::after { left: 24rpx; }
.bubble-sub::before { left: 10rpx; top: 10rpx; }
.bubble-sub::after { left: 22rpx; top: 10rpx; }

.login-error {
	display: block;
	margin-top: 22rpx;
	padding: 0 16rpx;
	text-align: center;
	font-size: 24rpx;
	line-height: 1.5;
	color: #E5484D;
}

.agreement-wrap {
	margin-top: 76rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	font-size: 25rpx;
	line-height: 1.75;
}

.agreement-links {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	flex-wrap: wrap;
}

.agreement-text {
	color: #7B8797;
}

.link {
	color: #1E7DF2;
}
</style>
