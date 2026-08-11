import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const loginSource = readFileSync(new URL('../../components/WechatLoginPanel.vue', import.meta.url), 'utf8')
const standaloneLoginSource = readFileSync(new URL('../login/index.vue', import.meta.url), 'utf8')

test('保修政策和收费指南保留旧版完整本地兜底', () => {
	assert.match(source, /三重保修承诺/)
	assert.match(source, /const warrantyTerms = \[/)
	assert.match(source, /五、维修续保/)
	assert.match(source, /paperTitle: '思科达维修收费指南'/)
	assert.match(source, /免费检测：所有寄修设备均享免费检测/)
	assert.match(source, /hasRenderablePolicyDocument/)
	assert.match(source, /content: String\(remoteContent \|\| ''\)\.trim\(\) \? remoteContent : \(fallback\.content \|\| ''\)/)
	const warrantyTemplate = source.slice(source.indexOf("activeModule === 'warranty'"), source.indexOf('v-else-if="isDocModule"'))
	const documentTemplate = source.slice(source.indexOf('v-else-if="isDocModule"'), source.indexOf("activeModule === 'products'"))
	assert.doesNotMatch(warrantyTemplate, /warranty-hero/)
	assert.doesNotMatch(warrantyTemplate, /保修期限|保修范围|增值服务|warrantyDurations|warrantyRanges|warrantyServices|white-list-card|text-card|service-line/)
	assert.doesNotMatch(source, /const warrantyDurations = \[|const warrantyRanges = \[|const warrantyServices = \[/)
	assert.doesNotMatch(documentTemplate, /fees-hero|收费公开透明|免费检测 · 先报后修 · 无隐形消费/)
	assert.match(documentTemplate, /v-if="activeModule !== 'fees'" class="doc-hero"/)
})

test('首页保养视频在接口空值和异常时回退到原始视频', () => {
	assert.match(source, /title: '牙科种植手机W201L保养维护'/)
	assert.match(source, /1783392116334_a6e54770be052_0\.mp4/)
	assert.match(source, /normalized\.length \? normalized : \[\{ \.\.\.maintenanceVideoFallback \}\]/)
	assert.match(source, /catch \(error\) \{[\s\S]*?maintenanceVideos\.value = \[\{ \.\.\.maintenanceVideoFallback \}\]/)
	assert.ok(existsSync(new URL('../../static/maintenance-w201l-cover.jpg', import.meta.url)))
})

test('首页公众号与产品视频优先使用官方能力，PC 失败时降级到二维码', () => {
	assert.match(source, /const OFFICIAL_ACCOUNT_USERNAME = 'gh_efdbbf08eaa1'/)
	assert.match(source, /const CICADA_SERVICE_ACCOUNT_USERNAME = 'gh_722a53ce06b5'/)
	assert.match(source, /openProductVideoLink[\s\S]*?openCicadaServiceAccountProfile\(\)/)
	assert.match(source, /openCicadaServiceAccountProfile[\s\S]*?launchOfficialAccountProfile\(CICADA_SERVICE_ACCOUNT_USERNAME, \{[\s\S]*?onFallback:/)
	assert.match(source, /wx\.openOfficialAccountProfile\(\{[\s\S]*?username: targetUsername/)
	assert.match(source, /if \(!isPcWebView\) return false[\s\S]*?showOfficialAccountQr\.value = true/)
	assert.match(source, /v-if="showOfficialAccountQr"[\s\S]*?电脑端暂不支持直接打开，请使用微信扫码进入服务号/)
	assert.doesNotMatch(source, /PRODUCT_VIDEO_LINK|pages-sub\/webview/)

	const serialField = source.slice(source.indexOf('<text><text class="required-star">*</text>产品序列号</text>'), source.indexOf('<!-- SN 识别结果 -->'))
	assert.match(serialField, /<input v-model="product\.serial"/)
	assert.doesNotMatch(serialField, /scanSn/)
	assert.match(loginSource, /<text class="login-brand-title">售后服务中心<\/text>/)
	assert.match(loginSource, /:disabled="loading \|\| locked \|\| cooldownSeconds > 0"/)
	assert.doesNotMatch(loginSource, /class="login-error"|props[^]*error/)
})

test('投诉建议仅在请求进行中防止重复点击，不使用提交频次限制', () => {
	const block = source.slice(source.indexOf('const submitFeedback = async'), source.indexOf('const doWechatLogin'))
	assert.match(block, /if \(feedbackSubmitting\.value\) return/)
	assert.match(block, /feedbackSubmitting\.value = true/)
	assert.match(block, /finally \{[\s\S]*?feedbackSubmitting\.value = false/)
	assert.doesNotMatch(block, /操作过于频繁|cooldown|rateLimit|throttl|debounc/i)
})

test('报修产品名称和型号支持其他手写并同步到提交字段', () => {
	assert.match(source, /<text>{{ repairProductOtherOption\.label }}<\/text>/)
	assert.match(source, /v-if="isOtherRepairProduct\(product\)" class="repair-field"[\s\S]*?v-model\.trim="product\.name"/)
	assert.match(source, /if \(isOther\) \{[\s\S]*?product\.productId = ''[\s\S]*?product\.name = ''[\s\S]*?product\.isCustomName = true/)
	assert.match(source, /product\.productId = value[\s\S]*?product\.name = label[\s\S]*?product\.isCustomName = false/)
	assert.match(source, /isOtherRepairProduct\(products\[i\]\)[\s\S]*?请填写其他产品名称/)
	assert.match(source, /v-model="product\.customModel"/)
	assert.match(source, /@input="syncCustomRepairModel\(index, \$event\.detail\.value\)"/)
	assert.match(source, /const syncCustomRepairModel = \(index, value = '', shouldTrim = false\) =>/)
	assert.match(source, /selected === REPAIR_PRODUCT_MODEL_OTHER_LABEL[\s\S]*?product\.isCustomModel = true/)
	assert.match(source, /productName: \(item\.name \|\| getRepairProductModelValue\(item\) \|\| '维修产品'\)\.trim\(\)/)
	assert.match(source, /productModel: getRepairProductModelValue\(item\)/)
	assert.match(source, /请填写自定义产品型号/)
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
