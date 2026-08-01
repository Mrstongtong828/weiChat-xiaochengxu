export const formatDateTime = (value = '', sliceStart = 0, sliceEnd = 16) => {
	if (!value) return ''
	if (typeof value === 'number') {
		const date = new Date(value)
		if (Number.isNaN(date.getTime())) return ''
		const pad = (num) => String(num).padStart(2, '0')
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`.slice(sliceStart, sliceEnd)
	}
	return String(value).slice(sliceStart, sliceEnd)
}

export const formatMoney = (value, pendingLabel = '待确认') => {
	if (value === undefined || value === null || value === '') return pendingLabel
	const numberValue = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
	if (!Number.isFinite(numberValue)) return pendingLabel
	return `¥${numberValue.toFixed(2)}`
}

export const formatOrderListPrice = (order = {}, emptyLabel = '—') => {
	const rawValue = order.totalFee || order.amount || order.price
	if (rawValue === undefined || rawValue === null || rawValue === '') return emptyLabel
	const numberValue = Number(String(rawValue).replace(/[^\d.-]/g, ''))
	if (!Number.isFinite(numberValue) || numberValue <= 0) return emptyLabel
	return `¥${Number.isInteger(numberValue) ? numberValue : numberValue.toFixed(2)}`
}

export const todayText = () => {
	const date = new Date()
	const pad = (num) => String(num).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const feedbackTicketNo = () => `FB-${todayText().replace(/-/g, '')}-${String(Date.now()).slice(-4)}`

export const toTextLines = (value) => {
	if (Array.isArray(value)) return value.filter(Boolean).map(String)
	if (!value) return []
	return String(value)
		.replace(/<[^>]+>/g, '\n')
		.split(/\n|\uFF1B|;/)
		.map((item) => item.replace(/^\s*\d+[.)\u3001]?\s*/, '').trim())
		.filter(Boolean)
}

export const normalizeQuoteItems = (item = {}, defaultName = '维修项目') => {
	const rawItems = item.quoteItems || item.quote_items || item.repairItems || item.repair_items || item.quote?.items || item.quotation?.items
	const list = Array.isArray(rawItems) && rawItems.length ? rawItems : []
	return list.map((row = {}) => ({
		name: row.name || row.title || row.projectName || defaultName,
		desc: row.desc || row.description || row.remark || '',
		partsFee: Number(row.partsFee ?? row.parts_fee ?? row.partFee ?? row.part_fee ?? row.materialFee ?? row.material_fee ?? row.partsAmount ?? row.parts_amount ?? 0) || 0,
		laborFee: Number(row.laborFee ?? row.labor_fee ?? row.workFee ?? row.work_fee ?? row.serviceFee ?? row.service_fee ?? row.laborAmount ?? row.labor_amount ?? 0) || 0
	}))
}

const normalizeQuoteRows = (rows = [], defaultName = '费用项目') => {
	return (Array.isArray(rows) ? rows : []).map((row = {}) => ({
		name: row.name || row.title || row.projectName || row.project_name || defaultName,
		desc: row.remark || row.desc || row.description || row.product_category || row.productCategory || [row.part_code || row.partCode, row.model].filter(Boolean).join(' / '),
		partCode: row.partCode || row.part_code || row.code || '',
		model: row.model || row.partModel || row.part_model || '',
		productCategory: row.productCategory || row.product_category || row.category || '',
		unitPrice: Number(row.unitPrice ?? row.unit_price ?? row.price ?? 0) || 0,
		quantity: Number(row.quantity ?? row.qty ?? row.count ?? 1) || 1,
		amount: Number(row.amount ?? row.total ?? 0) || 0
	})).filter((row) => row.name || row.desc || row.amount > 0)
}

export const normalizeQuoteDetail = (item = {}) => {
	const raw = item.quoteDetail || item.quote_detail || item.quote?.detail || item.quotation?.detail
	if (!raw || typeof raw !== 'object') return null
	const detail = {
		parts: normalizeQuoteRows(raw.parts, '配件费用'),
		services: normalizeQuoteRows(raw.services, '服务费用'),
		others: normalizeQuoteRows(raw.others, '其他费用'),
		partsTotal: Number(raw.partsTotal ?? raw.parts_total ?? 0) || 0,
		servicesTotal: Number(raw.servicesTotal ?? raw.services_total ?? 0) || 0,
		othersTotal: Number(raw.othersTotal ?? raw.others_total ?? 0) || 0,
		autoTotal: Number(raw.autoTotal ?? raw.auto_total ?? 0) || 0,
		finalPrice: Number(raw.finalPrice ?? raw.final_price ?? item.totalFee ?? item.total_price ?? 0) || 0,
		remark: raw.remark || item.quoteRemark || item.quote_remark || ''
	}
	detail.partsTotal = detail.partsTotal || sumQuoteFee(detail.parts, 'amount')
	detail.servicesTotal = detail.servicesTotal || sumQuoteFee(detail.services, 'amount')
	detail.othersTotal = detail.othersTotal || sumQuoteFee(detail.others, 'amount')
	detail.autoTotal = detail.autoTotal || detail.partsTotal + detail.servicesTotal + detail.othersTotal
	detail.finalPrice = detail.finalPrice || detail.autoTotal
	return detail.parts.length || detail.services.length || detail.others.length || detail.finalPrice ? detail : null
}

export const sumQuoteFee = (items = [], key) => items.reduce((total, item) => total + (Number(item[key]) || 0), 0)

// 注意：部分平台 chooseImage 不返回 size，此时视为未超限以免误拦正常上传；
// 文件大小的最终兜底由云端上传接口的服务端限制保证。
export const isFileTooLarge = (file = {}, limit) => Number(file.size || 0) > limit

export const formatFileSize = (size) => `${Math.round(size / 1024 / 1024)}MB`
