import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const loginSource = readFileSync(new URL('../../components/WechatLoginPanel.vue', import.meta.url), 'utf8')
const standaloneLoginSource = readFileSync(new URL('../login/index.vue', import.meta.url), 'utf8')

test('保修政策和收费指南保留旧版完整本地兜底', () => {
	assert.match(source, /三重保修承诺/)
	assert.match(source, /const warrantyDurations = \[/)
	assert.match(source, /const warrantyTerms = \[/)
	assert.match(source, /四、维修续保/)
	assert.match(source, /paperTitle: '思科达维修收费指南'/)
	assert.match(source, /免费检测：所有寄修设备均享免费检测/)
	assert.match(source, /hasRenderablePolicyDocument/)
	assert.match(source, /content: String\(remoteContent \|\| ''\)\.trim\(\) \? remoteContent : \(fallback\.content \|\| ''\)/)
})

test('首页保养视频在接口空值和异常时回退到原始视频', () => {
	assert.match(source, /title: '牙科种植手机W201L保养维护'/)
	assert.match(source, /1783392116334_a6e54770be052_0\.mp4/)
	assert.match(source, /normalized\.length \? normalized : \[\{ \.\.\.maintenanceVideoFallback \}\]/)
	assert.match(source, /catch \(error\) \{[\s\S]*?maintenanceVideos\.value = \[\{ \.\.\.maintenanceVideoFallback \}\]/)
	assert.ok(existsSync(new URL('../../static/maintenance-w201l-cover.jpg', import.meta.url)))
})

test('首页两个跳转继续严格分离，历史修复保持不变', () => {
	assert.match(source, /const PRODUCT_VIDEO_LINK = 'https:\/\/mp\.weixin\.qq\.com\/mp\/homepage\?__biz=MzIwNzYyNTI2Nw==&hid=40&sn=d1cbc102c21504684064130ba9fb7bd6&scene=18'/)
	assert.match(source, /openProductVideoLink[\s\S]*?pages-sub\/webview/)
	assert.match(source, /const OFFICIAL_ACCOUNT_USERNAME = 'gh_efdbbf08eaa1'/)
	assert.match(source, /const CICADA_SERVICE_ACCOUNT_USERNAME = 'wx804d58edd988829d'/)
	assert.match(source, /openCicadaServiceAccountProfile[\s\S]*?if \(!isPcWebView\)[\s\S]*?showOfficial\.value = true[\s\S]*?launchOfficialAccountProfile\(CICADA_SERVICE_ACCOUNT_USERNAME, \{/)
	assert.doesNotMatch(source, /CICADA 服务号暂时无法打开/)

	const serialField = source.slice(source.indexOf('<text><text class="required-star">*</text>产品序列号</text>'), source.indexOf('<!-- SN 识别结果 -->'))
	assert.match(serialField, /<input v-model="product\.serial"/)
	assert.doesNotMatch(serialField, /scanSn/)
	assert.match(loginSource, /<text class="login-brand-title">售后服务中心<\/text>/)
	assert.match(loginSource, /:disabled="loading \|\| locked \|\| cooldownSeconds > 0"/)
	assert.doesNotMatch(loginSource, /class="login-error"|props[^]*error/)
})

test('PC 登录入口使用防重复点击和限流倒计时，页面初始化不自动请求登录', () => {
	for (const loginEntrySource of [source, standaloneLoginSource]) {
		assert.match(loginEntrySource, /createPcLoginGuard\(\{/)
		assert.match(loginEntrySource, /:locked="loginClickLocked"/)
		assert.match(loginEntrySource, /:cooldown-seconds="loginCooldownSeconds"/)
		assert.match(loginEntrySource, /pcLoginGuard\.beginAttempt\(\{ automatic \}\)/)
		assert.match(loginEntrySource, /操作过于频繁，15秒后自动重试/)
	}

	const onLoadBlock = source.slice(source.indexOf('onLoad((options = {}) => {'), source.indexOf('onShow(() => {'))
	assert.doesNotMatch(onLoadBlock, /wechatLogin|doWechatLogin/)
})
