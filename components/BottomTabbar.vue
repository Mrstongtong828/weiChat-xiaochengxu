<template>
	<view class="bottom-tabbar">
		<view v-for="item in tabs" :key="item.id" class="tab-item tap" :class="{ active: item.id === activeId }" @click="$emit('select', item.id)">
			<view :class="['tab-icon', 'tab-' + item.icon]"><view></view></view>
			<text>{{ item.label }}</text>
		</view>
	</view>
</template>

<script setup>
defineProps({
	tabs: {
		type: Array,
		default: () => []
	},
	activeId: {
		type: String,
		default: ''
	}
})

defineEmits(['select'])
</script>

<style scoped>
.bottom-tabbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 70;
	height: calc(84rpx + env(safe-area-inset-bottom));
	padding: 4rpx 34rpx env(safe-area-inset-bottom);
	display: flex;
	align-items: flex-end;
	justify-content: space-around;
	border-top: 2rpx solid #E4ECF7;
	background: #FFFFFF;
	box-sizing: border-box;
}

.tap:active {
	opacity: 0.82;
	transform: scale(0.98);
}

.tab-item {
	min-width: 112rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0;
	color: #94A3B8;
	font-size: 20rpx;
	line-height: 1.2;
}

.tab-item.active {
	color: #1E6FE0;
	font-weight: 600;
}

.tab-icon {
	position: relative;
	width: 48rpx;
	height: 48rpx;
	color: currentColor;
}

.tab-icon::before,
.tab-icon::after,
.tab-icon view {
	content: "";
	position: absolute;
	box-sizing: border-box;
}

.tab-home::before {
	left: 8rpx;
	top: 20rpx;
	width: 32rpx;
	height: 22rpx;
	border: 4rpx solid currentColor;
	border-top: none;
	border-radius: 0 0 5rpx 5rpx;
}

.tab-home::after {
	left: 7rpx;
	top: 9rpx;
	width: 34rpx;
	height: 34rpx;
	border-left: 4rpx solid currentColor;
	border-top: 4rpx solid currentColor;
	transform: rotate(45deg);
}

.tab-home view {
	left: 19rpx;
	top: 30rpx;
	width: 10rpx;
	height: 12rpx;
	background: currentColor;
}

.tab-company::before {
	left: 8rpx;
	top: 7rpx;
	width: 32rpx;
	height: 36rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
}

.tab-company::after {
	left: 16rpx;
	top: 16rpx;
	width: 5rpx;
	height: 5rpx;
	background: currentColor;
	box-shadow: 12rpx 0 0 currentColor, 0 12rpx 0 currentColor, 12rpx 12rpx 0 currentColor, 6rpx 24rpx 0 currentColor;
}

.tab-mine::before {
	left: 15rpx;
	top: 7rpx;
	width: 18rpx;
	height: 18rpx;
	border: 4rpx solid currentColor;
	border-radius: 999rpx;
}

.tab-mine::after {
	left: 8rpx;
	top: 30rpx;
	width: 32rpx;
	height: 16rpx;
	border: 4rpx solid currentColor;
	border-bottom: none;
	border-radius: 24rpx 24rpx 0 0;
}
</style>
