import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pageSource = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const fallbackSource = readFileSync(new URL('../../config/fault-diagnostics.js', import.meta.url), 'utf8')
const faultRecords = JSON.parse(readFileSync(new URL('../../uniCloud-alipay/database/cicada_fault_kb.init_data.json', import.meta.url), 'utf8'))

test('故障自查内置完整产品分类与故障知识库兜底', () => {
	assert.equal(faultRecords.length, 44)
	assert.equal(new Set(faultRecords.map((item) => item.category_id)).size, 10)
	assert.match(fallbackSource, /export const defaultFaultTypes = faultKnowledgeBase/)
	assert.match(pageSource, /applyFaultTypes\(defaultFaultTypes\)/)
	assert.match(pageSource, /加载失败，已显示本地故障选项/)
})

test('立即报修序列号输入框只显示输入占位文字', () => {
	assert.match(pageSource, /v-model="product\.serial" placeholder="输入"/)
	assert.doesNotMatch(pageSource, /输入或扫码\s*SN/)
})
