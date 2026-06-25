<template>
	<view class="page-shell login-image-page">
		<image class="login-auth-image" :src="cicadaAssets.loginAuthBg" mode="widthFix"></image>
		<button
			class="login-auth-button tap"
			:class="{ loading: loading }"
			:disabled="loading"
			:open-type="privacyReady ? 'getPhoneNumber' : 'agreePrivacyAuthorization'"
			@agreeprivacyauthorization="onAgreePrivacyAuthorization"
			@getphonenumber="onGetPhoneNumber"
		>
			<text>{{ retrying ? '正在重试...' : loading ? '登录中...' : privacyReady ? '微信一键登录' : '同意隐私政策并登录' }}</text>
		</button>
		<text v-if="loginError" class="login-error login-image-error">{{ loginError }}</text>
		<view class="login-agreement-clean">
			<text>登录即表示您已阅读并同意</text>
			<view>
				<text>《用户协议》</text>
				<text>及</text>
				<text>《隐私政策》</text>
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
	loginError.value = ''
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
	top: 0;
	width: 750rpx;
	z-index: 1;
	transform: translateX(-50%);
}

.login-auth-button {
	position: absolute;
	left: 74rpx;
	top: 1038rpx;
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

.login-agreement-clean {
	position: absolute;
	left: 74rpx;
	top: 1190rpx;
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
	top: 1158rpx;
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
