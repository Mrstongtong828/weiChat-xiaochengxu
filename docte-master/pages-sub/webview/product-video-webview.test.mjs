import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const webViewSource = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const homeSource = readFileSync(new URL('../../pages/index/index.vue', import.meta.url), 'utf8')

test('产品视频入口继续打开独立二维码页面', () => {
	assert.match(homeSource, /const PRODUCT_VIDEO_LINK = 'https:\/\/mp\.weixin\.qq\.com\/mp\/homepage\?__biz=MzIwNzYyNTI2Nw==&hid=40&sn=d1cbc102c21504684064130ba9fb7bd6&scene=18'/)
	assert.match(homeSource, /openProductVideoLink[\s\S]*?pages-sub\/webview\/index/)
})

test('产品视频页面支持长按二维码和点击打开视频链接', () => {
	assert.match(webViewSource, /src="\/static\/product-video-link-qr\.png"/)
	assert.match(webViewSource, /show-menu-by-longpress="true"/)
	assert.match(webViewSource, /@tap="openProductVideo"/)
	assert.match(webViewSource, /const PRODUCT_VIDEO_URL = 'https:\/\/mp\.weixin\.qq\.com\/mp\/homepage\?__biz=MzIwNzYyNTI2Nw==&hid=40&sn=d1cbc102c21504684064130ba9fb7bd6&scene=18'/)
	assert.match(webViewSource, /<web-view[\s\S]*?v-if="showWebView"[\s\S]*?:src="targetUrl"[\s\S]*?@error="restoreQrView"/)
	assert.match(webViewSource, /长按保存二维码后识别打开产品视频/)
	assert.match(webViewSource, /\.webview-page[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/)
	assert.match(webViewSource, /\.webview-qr[\s\S]*?z-index: 2;[\s\S]*?pointer-events: auto;/)
	assert.doesNotMatch(webViewSource, /<button\b|showToast|页面加载失败|重新加载/)
})
