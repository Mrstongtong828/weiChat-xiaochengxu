import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const consentSource = fs.readFileSync(new URL('../../components/PrivacyConsent.vue', import.meta.url), 'utf8')

const readRule = (content, selector) => {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const match = content.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`))
	return match ? match[1] : ''
}

test('privacy dialog keeps actions visible while long content scrolls internally', () => {
	const cardRule = readRule(source, '.upload-privacy-card')
	const bodyRule = readRule(source, '.upload-privacy-body')
	const actionRule = readRule(source, '.upload-privacy-actions')

	assert.match(cardRule, /overflow:\s*hidden/)
	assert.match(bodyRule, /flex:\s*1/)
	assert.match(bodyRule, /min-height:\s*0/)
	assert.match(bodyRule, /height:\s*0/)
	assert.match(actionRule, /flex-shrink:\s*0/)
})

test('global privacy consent keeps its close and action controls visible', () => {
	const cardRule = readRule(consentSource, '.pc-card')
	const bodyRule = readRule(consentSource, '.pc-body')
	const actionRule = readRule(consentSource, '.pc-actions')

	assert.match(consentSource, /class="pc-close[^"]*"[^>]*@click="reject"/)
	assert.match(cardRule, /overflow:\s*hidden/)
	assert.match(bodyRule, /min-height:\s*0/)
	assert.match(bodyRule, /height:\s*0/)
	assert.match(actionRule, /flex-shrink:\s*0/)
})

test('privacy dialog always has a close path and does not compete with the repair footer', () => {
	assert.match(source, /class="upload-privacy-close[^"]*"[^>]*@click="rejectUploadPrivacy"/)
	assert.match(source, /v-if="!uploadPrivacyVisible"\s+class="repair-bottom-bar"/)
})

test('repair page disables global privacy dialog and requests consent only from user actions', () => {
	assert.match(source, /<PrivacyConsent\s+:disabled="activeModule === 'repair'"/)
	assert.match(consentSource, /if \(props\.disabled\)/)
	assert.match(consentSource, /watch\(\(\) => props\.disabled/)
	assert.match(source, /const chooseWechatAddress = async[\s\S]*?ensureWechatPrivacyForAction\(\)/)
	assert.match(source, /const scanTrackingNo = async[\s\S]*?ensureWechatPrivacyForAction\(\)/)
	assert.match(source, /const scanSn = async[\s\S]*?ensureWechatPrivacyForAction\(\)/)
})
