import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const homeSource = readFileSync(new URL('../../pages/index/index.vue', import.meta.url), 'utf8')

test('产品视频入口复用 CICADA 服务号官方跳转与 PC 二维码降级', () => {
	assert.match(homeSource, /openProductVideoLink[\s\S]*?openCicadaServiceAccountProfile\(\)/)
	assert.match(homeSource, /wx\.openOfficialAccountProfile\(\{[\s\S]*?username: targetUsername/)
	assert.match(homeSource, /onFallback:[\s\S]*?showOfficialAccountQr\.value = true/)
	assert.doesNotMatch(homeSource, /PRODUCT_VIDEO_LINK|pages-sub\/webview|product-video-link-qr/)
})
