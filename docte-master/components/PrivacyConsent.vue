<template>
	<view v-if="show" class="pc-mask">
		<view class="pc-card">
			<text class="pc-title">隐私政策与信息授权</text>
			<scroll-view scroll-y class="pc-body">
				<rich-text v-if="privacyHtml" :nodes="privacyHtml"></rich-text>
				<view v-else class="pc-text">在使用本服务前，请阅读并同意我们的隐私政策。我们将依法收集并使用您的相关信息，用于提供报修、查询与售后服务。</view>
				<template v-if="dataNoticeHtml">
					<text class="pc-subtitle">信息收集说明</text>
					<rich-text :nodes="dataNoticeHtml"></rich-text>
				</template>
			</scroll-view>
			<view class="pc-actions">
				<view class="pc-btn ghost tap" @click="reject">不同意</view>
				<view class="pc-btn primary tap" @click="agree">同意并继续</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getCompliance } from '@/api/content.js'

const STORAGE_KEY = 'privacy_consented'
const show = ref(false)
const privacyHtml = ref('')
const dataNoticeHtml = ref('')

onMounted(async () => {
	if (uni.getStorageSync(STORAGE_KEY)) return
	show.value = true
	try {
		const data = await getCompliance()
		privacyHtml.value = data.privacyPolicy || ''
		dataNoticeHtml.value = data.dataCollectionNotice || ''
	} catch (e) {
		// 拉取失败时仍展示通用同意文案
	}
})

const agree = () => {
	uni.setStorageSync(STORAGE_KEY, '1')
	show.value = false
}

const reject = () => {
	uni.showModal({
		title: '温馨提示',
		content: '需要同意隐私政策后才能使用完整服务。',
		confirmText: '我再看看',
		cancelText: '退出',
		success: (res) => {
			if (res.cancel) {
				// #ifdef MP-WEIXIN
				uni.exitMiniProgram && uni.exitMiniProgram()
				// #endif
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
