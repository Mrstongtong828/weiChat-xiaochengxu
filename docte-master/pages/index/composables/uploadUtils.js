export const isCloudFileId = (url = '') => /^cloud:\/\/\S+$/.test(String(url || '').trim())

export const canRejectRepairQuote = (order = {}) => {
	const paymentStatus = order.paymentStatus || order.payment_status || 'pending'
	const quoteStatus = order.quoteStatus || order.quote_status || ''
	const proofs = Array.isArray(order.paymentProofs)
		? order.paymentProofs
		: (Array.isArray(order.payment_proofs) ? order.payment_proofs : [])
	return Boolean(
		(order.id || order._id || order.order_no) &&
		quoteStatus === 'issued' &&
		!['paid', 'uploaded'].includes(paymentStatus) &&
		proofs.length === 0
	)
}

export const canUploadPaymentProofForOrder = (order = {}, quoteTotal = 0) => {
	const paymentStatus = order.paymentStatus || order.payment_status || 'pending'
	const quoteStatus = order.quoteStatus || order.quote_status || ''
	const statusKey = order.statusKey || order.status_key || ''
	return Boolean(
		order.id &&
		Number(quoteTotal) > 0 &&
		!['cancelled', 'completed'].includes(statusKey) &&
		['issued', 'confirmed'].includes(quoteStatus) &&
		['pending', 'rejected'].includes(paymentStatus)
	)
}

export const getCloudFileId = (item = {}) => {
	const candidates = [item.fileID, item.fileId, item.cloudUrl, item.url]
	return candidates.find(isCloudFileId) || ''
}

export const normalizeUploadUrl = (res = {}, fallbackPath = '') => {
	const url = res.url || res.fileUrl || res.path || res.fullUrl || res.fileID || res.fileId || ''
	return isCloudFileId(url) ? fallbackPath : (url || fallbackPath)
}

export const normalizeUploadFileId = (res = {}) => res.fileID || res.fileId || res.url || res.fileUrl || ''

export const getPreviewUrl = (item = {}) => {
	const url = item.resolvedUrl || item.previewUrl || item.url || item.path || item.fileUrl || item.fileID || item.fileId || item.cloudUrl || ''
	return isCloudFileId(url) ? (item.path || '') : url
}

export const getUploadedUrl = (item = {}) => item.fileID || item.fileId || item.cloudUrl || item.url || item.path || ''

export const compressForUpload = async (path) => {
	if (!path || typeof uni.compressImage !== 'function') return path
	const ext = String(path).split('.').pop().toLowerCase()
	if (ext === 'gif') return path
	try {
		const res = await uni.compressImage({ src: path, quality: 75 })
		return (res && res.tempFilePath) || path
	} catch (error) {
		console.warn('compress image failed, use original:', error)
		return path
	}
}

const videoCompressionThreshold = 10 * 1024 * 1024

export const compressVideoForUpload = async (video = {}) => {
	const path = video.tempFilePath || video.path || ''
	const size = Number(video.size || 0)
	if (!path || size <= videoCompressionThreshold || typeof uni.compressVideo !== 'function') {
		return { path, size }
	}
	try {
		const result = await uni.compressVideo({ src: path, quality: 'medium' })
		return {
			path: result?.tempFilePath || path,
			size: Number(result?.size || size)
		}
	} catch (error) {
		console.warn('compress video failed, use original:', error)
		return { path, size }
	}
}

export const isPickerCancel = (error = {}) => String(error.errMsg || error.message || error || '').toLowerCase().includes('cancel')

export const isAuthError = (error = {}) => /鉴权失败|Token|token/i.test(String(error.message || error.errMsg || ''))

export const hasLoginToken = () => Boolean(uni.getStorageSync('token'))
