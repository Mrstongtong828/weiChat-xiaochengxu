import test from 'node:test'
import assert from 'node:assert/strict'

import { getInvoiceStatusKey } from './invoiceFlow.js'

test('paid corporate transfers can request an invoice', () => {
	assert.equal(getInvoiceStatusKey({
		paymentMethod: 'offline_transfer',
		paymentStatus: 'paid',
		totalFee: 680
	}), 'available')
})

test('paid WeChat orders do not enter the invoice workflow', () => {
	assert.equal(getInvoiceStatusKey({
		paymentMethod: 'wechat_pay',
		paymentStatus: 'paid',
		totalFee: 680
	}), 'disabled')
})

test('unconfirmed corporate transfers remain unavailable', () => {
	assert.equal(getInvoiceStatusKey({
		paymentMethod: 'offline_transfer',
		paymentStatus: 'uploaded',
		totalFee: 680
	}), 'unavailable')
})

test('existing invoice records remain visible regardless of payment method', () => {
	assert.equal(getInvoiceStatusKey({
		paymentMethod: 'wechat_pay',
		invoiceStatus: '已开具'
	}), 'issued')
})
