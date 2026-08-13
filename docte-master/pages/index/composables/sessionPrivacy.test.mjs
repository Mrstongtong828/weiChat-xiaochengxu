import assert from 'node:assert/strict'
import test from 'node:test'

import {
	createPrivateStorageKey,
	createEmptyPrivateSessionState,
	clearLocalAuthSession,
	getAuthenticatedUserId,
	isSessionRequestCurrent,
	requiresPrivateSession
} from './sessionPrivacy.js'

test('logout reset removes every private record and temporary file URL', () => {
	const first = createEmptyPrivateSessionState()
	const second = createEmptyPrivateSessionState()

	assert.deepEqual(first, {
		orderList: [],
		trackOrders: [],
		productList: [],
		feedbackRecords: [],
		paymentProofTempUrls: {},
		detailAttachmentTempUrls: {},
		feedbackImageTempUrls: {},
		trackDetailOrder: '',
		orderDetailOrder: '',
		activeInvoiceOrderId: '',
		cachedDefaultAddress: null
	})
	assert.notEqual(first.orderList, second.orderList)
	assert.notEqual(first.paymentProofTempUrls, second.paymentProofTempUrls)
})

test('private business modules require an authenticated session', () => {
	for (const id of ['orders', 'track', 'invoices', 'products', 'feedback', 'order-detail']) {
		assert.equal(requiresPrivateSession(id), true, id)
	}
	for (const id of ['repair', 'warranty', 'fees', 'guide-quick', 'contact']) {
		assert.equal(requiresPrivateSession(id), false, id)
	}
})

test('an async response is writable only while its captured token is current', () => {
	assert.equal(isSessionRequestCurrent('token-a', 'token-a'), true)
	assert.equal(isSessionRequestCurrent('token-a', ''), false)
	assert.equal(isSessionRequestCurrent('token-a', 'token-b'), false)
	assert.equal(isSessionRequestCurrent('', ''), false)
})

test('logout invalidates the local token before remote logout finishes', () => {
	const removed = []
	clearLocalAuthSession({ removeStorageSync: (key) => removed.push(key) })
	assert.deepEqual(removed, ['token', 'userInfo', 'isLoggedIn'])
	assert.equal(isSessionRequestCurrent('old-token', ''), false)
})

test('personal cache keys are isolated by authenticated user ID', () => {
	assert.equal(getAuthenticatedUserId({ userId: 'user-a' }), 'user-a')
	assert.equal(getAuthenticatedUserId({ id: 'user-b' }), 'user-b')
	assert.equal(getAuthenticatedUserId({ _id: 'user-c' }), 'user-c')
	assert.equal(createPrivateStorageKey('receiverAddressList', { userId: 'user-a' }), 'receiverAddressList:user-a')
	assert.equal(createPrivateStorageKey('receiverAddressList', { userId: 'user-b' }), 'receiverAddressList:user-b')
	assert.equal(createPrivateStorageKey('repairDraft', {}), '')
})
