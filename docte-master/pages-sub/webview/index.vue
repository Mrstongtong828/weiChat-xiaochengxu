<template>
	<view class="webview-page">
		<web-view v-if="targetUrl" :src="targetUrl" @error="onWebViewError"></web-view>
		<view v-else class="webview-empty">
			<text>链接无效，暂时无法打开。</text>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const targetUrl = ref('')

onLoad((options = {}) => {
	const title = decodeURIComponent(options.title || '产品视频')
	const url = decodeURIComponent(options.url || '')
	if (title) uni.setNavigationBarTitle({ title })
	if (/^https:\/\//i.test(url)) {
		targetUrl.value = url
		return
	}
	uni.showToast({ title: '链接无效', icon: 'none' })
})

const onWebViewError = () => {
	uni.showToast({ title: '页面打开失败', icon: 'none' })
}
</script>

<style scoped>
.webview-page {
	min-height: 100vh;
	background: #FFFFFF;
}

.webview-empty {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
	font-size: 28rpx;
	color: #6B7C97;
}
</style>
