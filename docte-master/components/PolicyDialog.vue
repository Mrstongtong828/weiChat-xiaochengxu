<template>
	<view v-if="visible" class="policy-mask" @click="close">
		<view class="policy-card" @click.stop>
			<view class="policy-head">
				<text class="policy-title">{{ title }}</text>
				<text class="policy-close tap" @click="close">✕</text>
			</view>
			<scroll-view scroll-y class="policy-body">
				<rich-text v-if="content" :nodes="content"></rich-text>
				<view v-else class="policy-empty">暂未配置该内容</view>
			</scroll-view>
		</view>
	</view>
</template>

<script setup>
defineProps({
	visible: { type: Boolean, default: false },
	title: { type: String, default: '' },
	content: { type: String, default: '' }
})
const emit = defineEmits(['update:visible'])
const close = () => emit('update:visible', false)
</script>

<style scoped>
.policy-mask {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.45);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9000;
	padding: 48rpx;
}
.policy-card {
	width: 100%;
	max-width: 640rpx;
	max-height: 76vh;
	background: #fff;
	border-radius: 20rpx;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}
.policy-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 32rpx;
	border-bottom: 1px solid #f0f2f5;
}
.policy-title { font-size: 32rpx; font-weight: 600; color: #1d2129; }
.policy-close { font-size: 32rpx; color: #86909c; padding: 0 8rpx; }
.policy-body { padding: 28rpx 32rpx; font-size: 27rpx; line-height: 1.8; color: #4e5969; }
.policy-empty { text-align: center; color: #c9cdd4; padding: 48rpx 0; }
</style>
