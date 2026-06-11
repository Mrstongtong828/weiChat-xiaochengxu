<template>
	<view class="page-shell">
		<view class="wx-top">
			<view class="status-row">
				<text class="status-time">9:41</text>
				<view class="status-icons">
					<view class="signal">
						<view class="signal-bar signal-one"></view>
						<view class="signal-bar signal-two"></view>
						<view class="signal-bar signal-three"></view>
						<view class="signal-bar signal-four"></view>
					</view>
					<view class="wifi-dot"></view>
					<view class="battery"><view class="battery-fill"></view></view>
				</view>
			</view>
			<view class="nav-row">
				<view class="back-btn tap" @click="goBack">
					<view class="chevron-left"></view>
				</view>
				<text class="nav-title">登录</text>
				<view class="nav-spacer"></view>
			</view>
		</view>

		<view class="login-content">
			<view class="brand-section">
				<image class="brand-logo" :src="cicadaAssets.brandToothBlue" mode="aspectFit"></image>
				<text class="brand-name">佛山思科达</text>
				<text class="brand-desc">牙医仪器检修</text>
			</view>

			<view class="form-section">
				<view class="form-card">
					<view class="form-title">微信手机号授权登录</view>
					<text class="login-tip">短信验证码暂未开放，请通过微信授权手机号完成正式登录。</text>

					<button class="wechat-btn" :class="{ loading: loading }" open-type="getPhoneNumber" @getphonenumber="onGetPhoneNumber">
						<view class="wechat-icon"></view>
						<text>{{ loading ? '登录中...' : '微信手机号授权登录' }}</text>
					</button>

					<view class="agreement-wrap">
						<checkbox-group @change="onAgreeChange">
							<label class="agreement-item">
								<checkbox value="agree" color="#1E6FE0" :checked="agreed" />
								<text class="agreement-text">已阅读并同意</text>
							</label>
						</checkbox-group>
						<text class="link tap">《用户服务协议》</text>
						<text class="link tap">《隐私政策》</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { cicadaAssets } from '@/config/cicada-assets'
import { importCloudObject } from '@/utils/cloud.js'

const agreed = ref(false)
const loading = ref(false)

let userCloudObject = null

onMounted(() => {
	userCloudObject = importCloudObject('cicada-client-user')
})

// 微信手机号一键登录
const onGetPhoneNumber = async (e) => {
	if (loading.value) return

	if (!agreed.value) {
		uni.showToast({ title: '请先阅读并同意用户协议', icon: 'none' })
		return
	}
	
	if (e.detail.errMsg !== 'getPhoneNumber:ok') {
		if (e.detail.errMsg && e.detail.errMsg.includes('cancel')) {
			return
		}
		uni.showToast({ title: '授权失败，请重试', icon: 'none' })
		return
	}

	if (!e.detail.code) {
		uni.showToast({ title: '获取手机号失败', icon: 'none' })
		return
	}

	loading.value = true

	try {
		const result = await userCloudObject.loginWithWechat({ code: e.detail.code })

		loading.value = false

		if (result.code === 0) {
			uni.setStorageSync('token', result.data.token)
			uni.setStorageSync('userInfo', result.data.userInfo)
			uni.setStorageSync('isLoggedIn', true)

			uni.showToast({ title: '登录成功', icon: 'success' })

			setTimeout(() => {
				uni.navigateBack()
			}, 1500)
		} else {
			uni.showToast({ title: result.message || '登录失败', icon: 'none' })
		}
	} catch (error) {
		loading.value = false
		uni.showToast({ title: error.message || '登录失败', icon: 'none' })
	}
}

const onAgreeChange = (e) => {
	agreed.value = e.detail.value.includes('agree')
}

const goBack = () => {
	uni.navigateBack()
}
</script>

<style scoped>
.page-shell {
	position: relative;
	min-height: 100vh;
	background: #E8EEFA;
	color: #0F1F3A;
	font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
	box-sizing: border-box;
}

.tap:active {
	opacity: 0.82;
	transform: scale(0.98);
}

.wx-top {
	position: relative;
	z-index: 30;
	padding-top: 44rpx;
	background: #E8EEFA;
}

.status-row {
	height: 88rpx;
	padding: 0 44rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
}

.status-time {
	font-size: 30rpx;
	font-weight: 600;
	line-height: 1;
	color: #0F1F3A;
}

.status-icons {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.signal {
	height: 22rpx;
	display: flex;
	align-items: flex-end;
	gap: 4rpx;
}

.signal-bar {
	width: 4rpx;
	border-radius: 2rpx;
	background: #0F1F3A;
}

.signal-one { height: 6rpx; }
.signal-two { height: 10rpx; }
.signal-three { height: 14rpx; }
.signal-four { height: 20rpx; }

.wifi-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 999rpx;
	border: 4rpx solid #0F1F3A;
	border-left-color: transparent;
	border-bottom-color: transparent;
	transform: rotate(-45deg);
}

.battery {
	width: 44rpx;
	height: 20rpx;
	padding: 2rpx;
	border: 2rpx solid rgba(15, 31, 58, 0.6);
	border-radius: 5rpx;
	box-sizing: border-box;
}

.battery-fill {
	width: 85%;
	height: 100%;
	border-radius: 2rpx;
	background: #0F1F3A;
}

.nav-row {
	position: relative;
	height: 88rpx;
	padding: 0 28rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
}

.nav-spacer {
	width: 48rpx;
	height: 48rpx;
}

.nav-title {
	position: absolute;
	left: 50%;
	font-size: 32rpx;
	font-weight: 600;
	line-height: 1;
	color: #0F1F3A;
	transform: translateX(-50%);
}

.back-btn {
	width: 48rpx;
	height: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.chevron-left {
	width: 20rpx;
	height: 20rpx;
	border-top: 4rpx solid #0F1F3A;
	border-left: 4rpx solid #0F1F3A;
	transform: rotate(-45deg);
}

.login-content {
	padding: 40rpx 36rpx;
}

.brand-section {
	padding: 80rpx 0 60rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.brand-logo {
	width: 160rpx;
	height: 160rpx;
	margin-bottom: 24rpx;
}

.brand-name {
	font-size: 40rpx;
	font-weight: 700;
	color: #0F1F3A;
	margin-bottom: 8rpx;
}

.brand-desc {
	font-size: 26rpx;
	color: #6B7C97;
}

.form-section {
	padding: 0 8rpx;
}

.form-card {
	background: #FFFFFF;
	border-radius: 32rpx;
	padding: 48rpx 36rpx;
	box-shadow: 0 4rpx 24rpx rgba(30, 111, 224, 0.1);
}

.form-title {
	font-size: 36rpx;
	font-weight: 700;
	color: #0F1F3A;
	margin-bottom: 18rpx;
	text-align: center;
}

.login-tip {
	display: block;
	margin-bottom: 48rpx;
	text-align: center;
	font-size: 25rpx;
	line-height: 1.6;
	color: #6B7C97;
}

.field-wrap {
	margin-bottom: 40rpx;
}

.field-label {
	font-size: 26rpx;
	color: #324563;
	margin-bottom: 12rpx;
	font-weight: 500;
}

.input-field {
	position: relative;
	height: 96rpx;
	background: #F8FBFF;
	border: 2rpx solid #E4ECF7;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	padding: 0 28rpx;
	box-sizing: border-box;
}

.input-control {
	flex: 1;
	height: 100%;
	font-size: 28rpx;
	color: #0F1F3A;
}

.clear-btn {
	width: 44rpx;
	height: 44rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 40rpx;
	color: #94A3B8;
	line-height: 1;
}

.btn-wrap {
	margin-top: 56rpx;
}

.login-btn {
	height: 100rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(180deg, #2A6CD3 0%, #0A4FB8 100%);
	border-radius: 999rpx;
	color: #FFFFFF;
	font-size: 30rpx;
	font-weight: 700;
	box-shadow: 0 12rpx 32rpx rgba(10, 79, 184, 0.35);
}

.login-btn.disabled {
	background: #C4D1E4;
	box-shadow: none;
}

.login-btn.loading {
	opacity: 0.7;
}

.divider {
	margin: 36rpx 0;
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.divider-line {
	flex: 1;
	height: 1rpx;
	background: #E4ECF7;
}

.divider-text {
	font-size: 24rpx;
	color: #94A3B8;
}

.wechat-btn {
	width: 100%;
	height: 96rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	background: #07C160;
	border-radius: 999rpx;
	color: #FFFFFF;
	font-size: 28rpx;
	font-weight: 600;
	border: none;
	outline: none;
}

.wechat-btn.loading {
	opacity: 0.72;
}

.wechat-btn::after {
	border: none;
}

.wechat-icon {
	width: 44rpx;
	height: 44rpx;
	background: #FFFFFF;
	border-radius: 999rpx;
	position: relative;
}

.wechat-icon::after {
	content: '';
	position: absolute;
	left: 50%;
	top: 50%;
	width: 20rpx;
	height: 20rpx;
	background: #07C160;
	border-radius: 999rpx;
	transform: translate(-50%, -50%);
}

.agreement-wrap {
	margin-top: 36rpx;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6rpx;
	justify-content: center;
	font-size: 22rpx;
}

.agreement-item {
	display: flex;
	align-items: center;
	gap: 6rpx;
}

.agreement-text {
	color: #6B7C97;
}

.link {
	color: #1E6FE0;
}
</style>
