const text = (value, fallback = '') => {
	const normalized = String(value === undefined || value === null ? '' : value).trim()
	return normalized || fallback
}

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : [])

const normalizeMedia = (values, type, prefix) => list(values).map((value, index) => {
	const source = value && typeof value === 'object' ? value : { url: value }
	return {
		...source,
		id: source.id || `${prefix}-${index}`,
		type,
		url: source.url || source.fileID || source.fileId || source.path || ''
	}
}).filter((item) => item.url)

const isVideoMedia = (value) => {
	const source = value && typeof value === 'object' ? value : { url: value }
	if (String(source.type || '').toLowerCase() === 'video') return true
	return /\.(mp4|mov|m4v|webm|avi)(?:\?.*)?$/i.test(String(source.url || source.fileID || source.fileId || source.path || ''))
}

const mergeMedia = (values, legacyValues, type, prefix) => {
	const legacy = list(legacyValues).filter((value) => (type === 'video') === isVideoMedia(value))
	const seen = new Set()
	return normalizeMedia([...list(values), ...legacy], type, prefix).filter((item) => {
		if (seen.has(item.url)) return false
		seen.add(item.url)
		return true
	})
}

const formatTime = (value) => {
	if (!value) return '时间待同步'
	if (typeof value !== 'number') return text(value).replace('T', ' ').slice(0, 16)
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return '时间待同步'
	const pad = (part) => String(part).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const customerFacingRepairText = (value, fallback = '') => text(value, fallback)
	.replace(/客户已拒绝维修报价/g, '客户已选择不维修')
	.replace(/客户拒绝维修报价/g, '客户选择不维修')

const normalizeShipInfo = (value = {}) => {
	const source = value && typeof value === 'object' ? value : {}
	const region = Array.isArray(source.region) ? source.region.filter(Boolean).join(' ') : text(source.region)
	const detail = text(source.detail || source.address)
	return {
		name: text(source.name || source.receiver, '待同步'),
		phone: text(source.phone || source.mobile, '待同步'),
		unit: text(source.unit, '未填写'),
		address: text([region, detail].filter(Boolean).join(' '), '待同步'),
		logisticsCompany: text(source.logistics_company || source.logisticsCompany, '待录入'),
		logisticsNo: text(source.logistics_no || source.logisticsNo || source.trackingNo, '待录入')
	}
}

const normalizeItem = (value = {}, index = 0) => {
	const source = value && typeof value === 'object' ? value : {}
	const legacyMedia = source.media_urls || source.mediaUrls
	return {
		id: source._id || source.id || `item-${index + 1}`,
		name: text(source.product_name || source.productName || source.name, '设备信息待同步'),
		category: text(source.product_category || source.productCategory || source.category, '待同步'),
		model: text(source.product_model || source.productModel || source.model, '待同步'),
		sn: text(source.sn || source.serial || source.productSerial, '待同步'),
		buyDate: text(source.buy_date || source.buyDate, '未填写'),
		faultDesc: text(source.fault_desc || source.faultDesc, '未填写'),
		vouchers: normalizeMedia(source.voucher_urls || source.voucherUrls, 'image', 'voucher'),
		images: mergeMedia(source.image_urls || source.imageUrls || source.images, legacyMedia, 'image', 'image'),
		videos: mergeMedia(source.video_urls || source.videoUrls || source.videos, legacyMedia, 'video', 'video')
	}
}

const normalizeTimeline = (value) => list(value).map((item = {}, index) => ({
	id: item.id || item._id || `timeline-${index + 1}`,
	title: customerFacingRepairText(item.title || item.statusText, '状态更新'),
	desc: customerFacingRepairText(item.desc || item.description || item.content, '暂无补充说明'),
	time: formatTime(item.time || item.createTime || item.create_time || item.updateTime || item.update_time),
	done: item.done !== false,
	pending: Boolean(item.pending)
}))

export const createOrderDetailView = (order = {}) => ({
	items: list(order.items || order.itemsList).map(normalizeItem),
	shipOut: normalizeShipInfo(order.shipOutInfo || order.ship_out_info),
	shipBack: normalizeShipInfo(order.shipBackInfo || order.ship_back_info),
	timeline: normalizeTimeline(order.timeline)
})
