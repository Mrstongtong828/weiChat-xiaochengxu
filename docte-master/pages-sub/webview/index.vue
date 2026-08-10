<template>
	<view class="webview-page">
		<web-view
			v-if="showWebView"
			:src="targetUrl"
			@error="restoreQrView"
		></web-view>
		<view v-else class="webview-qr-content">
			<image
				class="webview-qr"
				src="/static/product-video-link-qr.png"
				mode="aspectFit"
				show-menu-by-longpress="true"
				@tap="openProductVideo"
			></image>
			<text class="webview-qr-tip">长按保存二维码后识别打开产品视频</text>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const PRODUCT_VIDEO_URL = 'https://mp.weixin.qq.com/mp/homepage?__biz=MzIwNzYyNTI2Nw==&hid=40&sn=d1cbc102c21504684064130ba9fb7bd6&scene=18'
const targetUrl = ref(PRODUCT_VIDEO_URL)
const showWebView = ref(false)

const decodeOption = (value = '') => {
	try {
		return decodeURIComponent(String(value || ''))
	} catch (error) {
		return ''
	}
}

onLoad((options = {}) => {
	const title = decodeOption(options.title) || '产品视频'
	const url = decodeOption(options.url)
	uni.setNavigationBarTitle({ title })
	if (/^https:\/\//i.test(url)) targetUrl.value = url
})

const openProductVideo = () => {
	if (!/^https:\/\//i.test(targetUrl.value)) return
	showWebView.value = true
}

const restoreQrView = () => {
	showWebView.value = false
}
</script>

<style scoped>
.webview-page {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	background: #FFFFFF;
	box-sizing: border-box;
}

.webview-qr-content {
	position: relative;
	z-index: 1;
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 28rpx;
}

.webview-qr {
	position: relative;
	z-index: 2;
	width: 520rpx;
	height: 520rpx;
	max-width: 100%;
	pointer-events: auto;
}

.webview-qr-tip {
	display: block;
	width: 100%;
	font-size: 26rpx;
	line-height: 1.4;
	color: #52647D;
	text-align: center;
}
</style>
