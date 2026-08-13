const PRIVATE_MODULE_IDS = new Set([
	'orders',
	'track',
	'invoices',
	'products',
	'feedback',
	'order-detail'
])

export const createEmptyPrivateSessionState = () => ({
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

export const requiresPrivateSession = (moduleId = '') => PRIVATE_MODULE_IDS.has(String(moduleId || '').trim())

export const isSessionRequestCurrent = (capturedToken = '', currentToken = '') => {
	const captured = String(capturedToken || '').trim()
	return Boolean(captured && captured === String(currentToken || '').trim())
}

export const clearLocalAuthSession = (storage = globalThis.uni) => {
	if (!storage || typeof storage.removeStorageSync !== 'function') return
	for (const key of ['token', 'userInfo', 'isLoggedIn']) storage.removeStorageSync(key)
}

export const getAuthenticatedUserId = (userInfo = {}) => String(
	userInfo && (userInfo.userId || userInfo.id || userInfo._id) || ''
).trim()

export const createPrivateStorageKey = (baseKey = '', userInfo = {}) => {
	const base = String(baseKey || '').trim()
	const userId = getAuthenticatedUserId(userInfo)
	return base && userId ? `${base}:${encodeURIComponent(userId)}` : ''
}
