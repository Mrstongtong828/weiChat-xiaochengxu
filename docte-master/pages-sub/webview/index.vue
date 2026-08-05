<template>
	<view class="webview-page">
		<view class="webview-qr-content">
			<image
				class="webview-qr"
				src="/static/product-video-link-qr.png"
				mode="aspectFit"
				show-menu-by-longpress="true"
			></image>
			<text class="webview-qr-tip">长按识别二维码打开产品视频</text>
		</view>
	</view>
</template>

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
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 28rpx;
}

.webview-qr {
	width: 520rpx;
	height: 520rpx;
	max-width: 100%;
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
