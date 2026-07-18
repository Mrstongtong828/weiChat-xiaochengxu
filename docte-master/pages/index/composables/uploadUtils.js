export const isCloudFileId = (url = '') => String(url || '').startsWith('cloud://')

export const normalizeUploadUrl = (res = {}, fallbackPath = '') => {
	const url = res.url || res.fileUrl || res.path || res.fullUrl || res.fileID || res.fileId || ''
	return isCloudFileId(url) ? fallbackPath : (url || fallbackPath)
}

export const normalizeUploadFileId = (res = {}) => res.fileID || res.fileId || res.url || res.fileUrl || ''

export const getPreviewUrl = (item = {}) => {
	const url = item.previewUrl || item.url || item.path || item.fileUrl || item.fileID || item.fileId || item.cloudUrl || ''
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

export const isPickerCancel = (error = {}) => String(error.errMsg || error.message || error || '').toLowerCase().includes('cancel')

export const isAuthError = (error = {}) => /鉴权失败|Token|token/i.test(String(error.message || error.errMsg || ''))

export const hasLoginToken = () => Boolean(uni.getStorageSync('token'))
