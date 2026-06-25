<template>
	<view v-if="show" class="pc-mask">
		<view class="pc-card">
			<text class="pc-title">隐私政策与信息授权</text>
			<scroll-view scroll-y class="pc-body">
				<rich-text v-if="privacyHtml" :nodes="privacyHtml"></rich-text>
				<view v-else class="pc-text">在使用本服务前，请阅读并同意我们的隐私政策。我们将依法收集并使用您的相关信息，用于提供报修、查询与售后服务。</view>
			</scroll-view>
			<view class="pc-actions">
				<view class="pc-btn ghost tap" @click="reject">不同意</view>
				<!-- #ifdef MP-WEIXIN -->
				<!-- 微信端使用官方 agreePrivacyAuthorization，授权结果记录到微信隐私协议机制 -->
				<button class="pc-btn primary tap" open-type="agreePrivacyAuthorization" @agreeprivacyauthorization="onAgreePrivacy">同意并继续</button>
				<!-- #endif -->
				<!-- #ifndef MP-WEIXIN -->
				<view class="pc-btn primary tap" @click="agree">同意并继续</view>
				<!-- #endif -->
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getCompliance } from '@/api/content.js'
import { markWechatPrivacyReady, setupWechatPrivacyAuthorization, PRIVACY_STORAGE_KEY } from '@/utils/wechat-privacy.js'

const show = ref(false)
const privacyHtml = ref('')
// 微信官方隐私机制：当调用 getPhoneNumber 等接口且用户未授权时，微信会触发回调，
// 我们用本弹窗承接授权，用户同意后调用 resolve 放行接口。
let privacyResolve = null

const showPrivacyDialog = (resolve = null) => {
	privacyResolve = resolve
	loadComplianceText()
	show.value = true
}

const loadComplianceText = async () => {
	try {
		const data = await getCompliance()
		privacyHtml.value = data.privacyPolicy || ''
	} catch (e) {
		// 拉取失败时仍展示通用同意文案
	}
}

onMounted(async () => {
	// #ifdef MP-WEIXIN
	// 接入官方隐私授权机制：由微信在需要时触发弹窗，不再依赖首启自绘弹窗强制同意
	uni.$on('needPrivacyAuthorization', showPrivacyDialog)
	setupWechatPrivacyAuthorization(showPrivacyDialog)
	if (!uni.getStorageSync(PRIVACY_STORAGE_KEY)) {
		showPrivacyDialog()
	}
	return
	// #endif
	// 非微信端 / 低版本：首启展示一次自绘同意弹窗
	if (uni.getStorageSync(PRIVACY_STORAGE_KEY)) return
	show.value = true
	loadComplianceText()
})

onUnmounted(() => {
	// #ifdef MP-WEIXIN
	uni.$off('needPrivacyAuthorization', showPrivacyDialog)
	// #endif
})

// 微信官方同意回调：放行被拦截的隐私接口
const onAgreePrivacy = () => {
	markWechatPrivacyReady()
	show.value = false
	if (typeof privacyResolve === 'function') {
		privacyResolve({ event: 'agree' })
		privacyResolve = null
	}
}

const agree = () => {
	markWechatPrivacyReady()
	show.value = false
}

const reject = () => {
	// #ifdef MP-WEIXIN
	// 官方机制下：拒绝即放弃本次隐私接口调用，但允许用户继续浏览公开内容（不强制退出）
	if (typeof privacyResolve === 'function') {
		privacyResolve({ event: 'disagree' })
		privacyResolve = null
		show.value = false
		uni.showToast({ title: '已取消授权，可继续浏览', icon: 'none' })
		return
	}
	// #endif
	uni.showModal({
		title: '温馨提示',
		content: '未同意隐私政策时，仅可浏览基础内容，登录与报修等功能将无法使用。',
		confirmText: '我再看看',
		cancelText: '仅浏览',
		success: (res) => {
			if (res.cancel) {
				// 允许游客浏览公开内容，不再强制退出小程序
				show.value = false
			}
		}
	})
}
</script>

<style scoped>
.pc-mask {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9500;
	padding: 48rpx;
}
.pc-card {
	width: 100%;
	max-width: 620rpx;
	max-height: 78vh;
	background: #fff;
	border-radius: 24rpx;
	padding: 36rpx 32rpx 28rpx;
	display: flex;
	flex-direction: column;
}
.pc-title { font-size: 34rpx; font-weight: 700; color: #1d2129; text-align: center; }
.pc-body { margin: 24rpx 0; flex: 1; font-size: 27rpx; line-height: 1.8; color: #4e5969; }
.pc-text { color: #4e5969; }
.pc-subtitle { display: block; margin: 20rpx 0 8rpx; font-weight: 600; color: #1d2129; }
.pc-actions { display: flex; gap: 20rpx; }
.pc-btn {
	flex: 1;
	text-align: center;
	padding: 22rpx 0;
	border-radius: 999rpx;
	font-size: 29rpx;
}
.pc-btn.primary { background: #1E6FE0; color: #fff; }
.pc-btn.ghost { background: #f2f3f5; color: #4e5969; }
</style>
