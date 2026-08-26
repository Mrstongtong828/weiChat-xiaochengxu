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

test('选择不维修要求填写原因，且不等待订阅消息后才提交至后台', () => {
	assert.match(source, /v-if="showRejectReasonDialog"/)
	assert.match(source, /v-model\.trim="rejectReason"/)
	assert.match(source, /@click="openRejectReasonDialog\(detailOrder\)"/)
	const rejectBlock = source.slice(
		source.indexOf('const submitRejectRepairQuote = async'),
		source.indexOf('// 确认收货：已回寄 → 已完成')
	)
	assert.match(rejectBlock, /if \(!rejectReason\.value\.trim\(\)\)/)
	assert.match(rejectBlock, /void requestStatusSubscription\('quote_reject'\)/)
	assert.ok(
		rejectBlock.indexOf("void requestStatusSubscription('quote_reject')")
		< rejectBlock.indexOf('await rejectRepairQuote(')
	)
	assert.match(rejectBlock, /rejectReasonOrder\.value\.recordId \|\| rejectReasonOrder\.value\.id/)
	assert.match(source, /quoteStatus === 'rejected' \? '已取消' : deriveDisplayStatus/)
})

test('服务进度可单独筛选已取消工单', () => {
	assert.match(source, /const trackTabs = \['全部', '待处理', '维修中', '已发货', '已取消', '已完成', '未开票', '已开票'\]/)
	assert.match(source, /if \(tab === '已取消'\) return item\.status === '已取消' \|\| item\.statusKey === 'cancelled' \|\| item\.quoteStatus === 'rejected'/)
})

test('首页全部角标排除已完成工单，服务进度可单独查看已完成工单', () => {
	assert.match(source, /if \(resolveStatusKey\(item\) !== 'completed'\) acc\.all \+= 1/)
	assert.match(source, /if \(tab === '已完成'\) return resolveStatusKey\(item\) === 'completed'/)
})
