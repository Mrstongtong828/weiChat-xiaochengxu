<template>
	<view class="wechat-login-screen">
		<view class="login-back-button tap" @click="$emit('back')"><view></view></view>
		<view class="login-device-line"></view>

		<view class="login-layout">
			<view class="login-brand-panel">
				<view class="login-logo-shell">
					<image class="login-brand-logo" :src="cicadaAssets.wordmarkRegistered" mode="aspectFit"></image>
				</view>
				<text class="login-brand-title">思科达售后服务中心</text>
				<text class="login-brand-subtitle">牙科设备售后服务</text>
			</view>

			<view class="login-action-panel">
				<button class="login-auth-button tap" :disabled="loading" @click="$emit('login')">
					<view class="wechat-login-icon"><view></view><view></view></view>
					<text>{{ retrying ? '正在重试...' : loading ? '登录中...' : '微信一键登录' }}</text>
				</button>

				<view class="login-consent-check tap" @click="$emit('toggle-agreement')">
					<view :class="['login-checkbox', { checked: agreed }]"><text v-if="agreed">✓</text></view>
					<text>已阅读并同意</text>
					<text class="login-policy-link" @click.stop="$emit('open-policy', 'user')">《用户协议》</text>
					<text>和</text>
					<text class="login-policy-link" @click.stop="$emit('open-policy', 'privacy')">《隐私政策》</text>
				</view>

				<text v-if="error" class="login-error">{{ error }}</text>
				<view class="login-security-note">
					<view class="login-security-icon"><view></view></view>
					<text>微信身份安全登录</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { cicadaAssets } from '@/config/cicada-assets'

defineProps({
	loading: { type: Boolean, default: false },
	retrying: { type: Boolean, default: false },
	agreed: { type: Boolean, default: false },
	error: { type: String, default: '' }
})

defineEmits(['back', 'login', 'toggle-agreement', 'open-policy'])
</script>

<style scoped>
.wechat-login-screen {
	position: relative;
	min-height: 100vh;
	overflow: hidden;
	padding: 0 56rpx;
	background: #F4F7FA;
	box-sizing: border-box;
}

.login-layout {
	position: relative;
	z-index: 2;
	min-height: 100vh;
	padding: 212rpx 0 calc(72rpx + env(safe-area-inset-bottom));
	display: flex;
	flex-direction: column;
	justify-content: center;
	box-sizing: border-box;
}

.login-back-button {
	position: absolute;
	left: 32rpx;
	top: calc(env(safe-area-inset-top) + 24rpx);
	z-index: 8;
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid #E4E9EF;
	border-radius: 50%;
	background: #FFFFFF;
	box-shadow: 0 8rpx 20rpx rgba(20, 38, 63, 0.08);
}

.login-back-button view {
	width: 18rpx;
	height: 18rpx;
	margin-left: 7rpx;
	border-left: 4rpx solid #2479D8;
	border-bottom: 4rpx solid #2479D8;
	transform: rotate(45deg);
}

.login-device-line {
	position: absolute;
	right: -118rpx;
	top: 330rpx;
	width: 250rpx;
	height: 470rpx;
	border: 5rpx solid rgba(20, 153, 209, 0.08);
	border-radius: 64rpx;
	transform: rotate(15deg);
}

.login-device-line::before,
.login-device-line::after {
	content: "";
	position: absolute;
	box-sizing: border-box;
}

.login-device-line::before {
	left: 48rpx;
	top: 66rpx;
	width: 112rpx;
	height: 270rpx;
	border: 4rpx solid rgba(20, 153, 209, 0.07);
	border-radius: 52rpx;
}

.login-device-line::after {
	left: 88rpx;
	bottom: 42rpx;
	width: 70rpx;
	height: 70rpx;
	border: 4rpx solid rgba(20, 153, 209, 0.07);
	border-radius: 50%;
}

.login-brand-panel {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.login-logo-shell {
	width: 430rpx;
	height: 112rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.login-brand-logo {
	width: 400rpx;
	height: 92rpx;
}

.login-brand-title {
	margin-top: 46rpx;
	font-size: 42rpx;
	font-weight: 700;
	line-height: 1.3;
	letter-spacing: 0;
	color: #14263F;
}

.login-brand-subtitle {
	margin-top: 14rpx;
	font-size: 25rpx;
	line-height: 1.5;
	letter-spacing: 0;
	color: #7D8A9C;
}

.login-action-panel {
	margin-top: 172rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.login-auth-button {
	width: 100%;
	height: 104rpx;
	margin: 0;
	padding: 0;
	border: none;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 20rpx;
	background: #07C160;
	box-shadow: 0 16rpx 30rpx rgba(7, 193, 96, 0.2);
	color: #FFFFFF;
	font-size: 32rpx;
	font-weight: 700;
	line-height: 104rpx;
}

.login-auth-button::after { border: none; }
.login-auth-button[disabled] { opacity: 0.68; }

.wechat-login-icon {
	position: relative;
	width: 58rpx;
	height: 46rpx;
	flex: 0 0 58rpx;
}

.wechat-login-icon view {
	position: absolute;
	border-radius: 50%;
	background: #FFFFFF;
}

.wechat-login-icon view:first-child {
	left: 0;
	top: 0;
	width: 39rpx;
	height: 33rpx;
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
	background: #07C160;
}

.wechat-login-icon view:first-child::before { left: 10rpx; top: 12rpx; }
.wechat-login-icon view:first-child::after { left: 24rpx; top: 12rpx; }

.wechat-login-icon view:last-child {
	right: 0;
	bottom: 0;
	width: 35rpx;
	height: 29rpx;
	box-shadow: 0 0 0 4rpx #07C160;
}

.wechat-login-icon view:last-child::before { left: 9rpx; top: 10rpx; }
.wechat-login-icon view:last-child::after { left: 21rpx; top: 10rpx; }

.login-consent-check {
	width: 100%;
	margin-top: 30rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: 6rpx;
	font-size: 23rpx;
	line-height: 1.55;
	letter-spacing: 0;
	color: #7D8A9C;
	text-align: center;
}

.login-checkbox {
	width: 30rpx;
	height: 30rpx;
	flex: 0 0 30rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid #A7B1BF;
	border-radius: 6rpx;
	background: #FFFFFF;
	box-sizing: border-box;
}

.login-checkbox.checked { border-color: #07C160; background: #07C160; }
.login-checkbox text { font-size: 21rpx; font-weight: 800; line-height: 1; color: #FFFFFF; }
.login-policy-link { color: #2479D8; }

.login-error {
	width: 100%;
	margin-top: 16rpx;
	font-size: 22rpx;
	line-height: 1.45;
	letter-spacing: 0;
	color: #D64545;
	text-align: center;
}

.login-security-note {
	margin-top: 38rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	font-size: 23rpx;
	line-height: 1.4;
	letter-spacing: 0;
	color: #98A3B2;
}

.login-security-icon {
	position: relative;
	width: 24rpx;
	height: 28rpx;
	border: 2rpx solid #98A3B2;
	border-radius: 12rpx 12rpx 10rpx 10rpx;
	box-sizing: border-box;
}

.login-security-icon view {
	position: absolute;
	left: 7rpx;
	top: 7rpx;
	width: 7rpx;
	height: 4rpx;
	border-left: 2rpx solid #98A3B2;
	border-bottom: 2rpx solid #98A3B2;
	transform: rotate(-45deg);
}

.tap:active { opacity: 0.84; }

@media screen and (max-height: 700px) {
	.login-layout { padding-top: 170rpx; padding-bottom: 44rpx; }
	.login-action-panel { margin-top: 112rpx; }
	.login-security-note { margin-top: 24rpx; }
}
</style>
