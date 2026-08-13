import test from 'node:test'
import assert from 'node:assert/strict'

import { formatInvoiceDisplayText, getInvoiceDocumentAction, getInvoiceMeta, getInvoiceStatusKey, shouldShowInvoiceEntry } from './invoiceFlow.js'

test('paid corporate transfers can request an invoice', () => {
	assert.equal(getInvoiceStatusKey({
		statusKey: 'completed',
		paymentMethod: 'offline_transfer',
		paymentStatus: 'paid',
		totalFee: 680
	}), 'available')
})

test('completed status from the normalized order field can request an invoice', () => {
	assert.equal(getInvoiceStatusKey({
		status: '处理中',
		statusEn: 'completed',
		paymentMethod: 'bank_transfer',
		paymentStatus: 'paid',
		totalFee: 680
	}), 'available')
})

test('paid WeChat orders can request an invoice', () => {
	assert.equal(getInvoiceStatusKey({
		statusKey: 'completed',
		paymentMethod: 'wechat_pay',
		paymentStatus: 'paid',
		totalFee: 680
	}), 'available')
})

test('pending invoice state remains visible for an eligible WeChat order', () => {
	assert.equal(getInvoiceStatusKey({
		statusKey: 'completed',
		paymentMethod: 'wechat_pay',
		paymentStatus: 'paid',
		totalFee: 680,
		invoiceStatus: '待开票'
	}), 'processing')
})

test('unpaid WeChat orders remain unavailable', () => {
	assert.equal(getInvoiceStatusKey({
		statusKey: 'completed',
		paymentMethod: 'wechat_pay',
		paymentStatus: 'pending',
		totalFee: 680
	}), 'unavailable')
})

test('unconfirmed corporate transfers remain unavailable', () => {
	assert.equal(getInvoiceStatusKey({
		statusKey: 'completed',
		paymentMethod: 'offline_transfer',
		paymentStatus: 'uploaded',
		totalFee: 680
	}), 'unavailable')
})

test('stale pending invoice state cannot bypass reconciliation or completion', () => {
	assert.equal(getInvoiceStatusKey({
		statusKey: 'completed',
		paymentMethod: 'offline_transfer',
		paymentStatus: 'uploaded',
		totalFee: 680,
		invoiceStatus: '待开票'
	}), 'unavailable')
	assert.equal(getInvoiceStatusKey({
		statusKey: 'fixing',
		paymentMethod: 'offline_transfer',
		paymentStatus: 'paid',
		totalFee: 680,
		invoiceStatus: '开具中'
	}), 'awaiting_completion')
})

test('unfinished corporate transfers wait for service completion', () => {
	assert.equal(getInvoiceStatusKey({
		statusKey: 'shipped',
		paymentMethod: 'offline_transfer',
		paymentStatus: 'paid',
		totalFee: 680
	}), 'awaiting_completion')
})

test('existing invoice records remain visible regardless of payment method', () => {
	assert.equal(getInvoiceStatusKey({
		paymentMethod: 'wechat_pay',
		invoiceStatus: '已开具'
	}), 'issued')
})

test('all invoice processing uses the 7-15 working day service level', () => {
	const meta = getInvoiceMeta({
		statusKey: 'completed',
		paymentMethod: 'offline_transfer',
		paymentStatus: 'paid',
		totalFee: 680,
		invoiceStatus: '待开票'
	})
	assert.match(meta.desc, /7-15 个工作日/)
})

test('invoice menu entry is shown only for actionable or historical invoice records', () => {
	assert.equal(shouldShowInvoiceEntry([{
		statusKey: 'completed', paymentMethod: 'wechat_pay', paymentStatus: 'paid', totalFee: 680
	}]), true)
	assert.equal(shouldShowInvoiceEntry([{
		statusKey: 'completed', paymentMethod: 'offline_transfer', paymentStatus: 'paid', totalFee: 680
	}]), true)
	assert.equal(shouldShowInvoiceEntry([{
		paymentMethod: 'wechat_pay', invoiceStatus: '已开具'
	}]), true)
})

test('formats registered invoice fields for in-app display and copy without an invoice type', () => {
	assert.equal(formatInvoiceDisplayText({
		id: 'WO-20260810-001',
		invoiceTaxCategory: '修理修配劳务',
		invoiceItemName: '牙科设备检修服务费',
		invoiceTitle: '佛山市示例口腔门诊部',
		invoiceNo: 'INV-001',
		invoiceDate: '2026-08-10',
		price: '¥680.00'
	}), [
		'税收分类：修理修配劳务',
		'发票项目：牙科设备检修服务费',
		'发票抬头：佛山市示例口腔门诊部',
		'发票号码：INV-001',
		'开票日期：2026-08-10',
		'开票金额：¥680.00',
		'工单号：WO-20260810-001'
	].join('\n'))
})

test('issued invoice PDF can be viewed and downloaded only after backend upload', () => {
	assert.deepEqual(getInvoiceDocumentAction({
		invoiceStatus: '已开具',
		invoicePdfUrl: 'cloud://invoice/example.pdf'
	}), {
		visible: true,
		disabled: false,
		label: '查看/下载发票',
		fileUrl: 'cloud://invoice/example.pdf'
	})
	assert.deepEqual(getInvoiceDocumentAction({ invoiceStatus: '已开具' }), {
		visible: true,
		disabled: true,
		label: '发票原件待上传',
		fileUrl: ''
	})
	assert.equal(getInvoiceDocumentAction({ invoiceStatus: '开具中' }).visible, false)
})
