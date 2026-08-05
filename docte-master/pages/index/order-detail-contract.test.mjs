import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./index.vue', import.meta.url), 'utf8')

test('工单详情渲染完整报修字段和后端处理记录', () => {
	assert.match(source, /v-for="\(item, itemIndex\) in detailView\.items"/)
	assert.match(source, /item\.faultDesc/)
	assert.match(source, /detailView\.shipOut\.address/)
	assert.match(source, /detailView\.shipBack\.address/)
	assert.match(source, /v-for="\(item, index\) in detailView\.timeline"/)
})

test('提交成功页使用本次填写的物流数据，不显示静态承诺', () => {
	const successBlock = source.slice(
		source.indexOf("activeModule === 'repair-success'"),
		source.indexOf("activeModule === 'track'")
	)
	assert.match(successBlock, /\{\{ submittedLogisticsText \}\}/)
	assert.doesNotMatch(successBlock, /30 分钟内/)
	assert.doesNotMatch(successBlock, /顺丰到付/)
})

test('详情入口互斥选择工单，提交锁早于订阅授权', () => {
	assert.match(source, /const openTrackDetail = \(order\) => \{\s*orderDetailOrder\.value = ''\s*trackDetailOrder\.value = order\.id/)
	assert.match(source, /const openOrderDetail = \(order\) => \{\s*trackDetailOrder\.value = ''\s*orderDetailOrder\.value = order\.id/)
	const submitBlock = source.slice(source.indexOf('const submitRepair = async'), source.indexOf('const openFaultSheet'))
	assert.ok(submitBlock.indexOf('repairSubmitting.value = true') < submitBlock.indexOf("requestStatusSubscription('repair_submit')"))
})
