const toOrderList = (result) => {
	if (Array.isArray(result)) return result
	if (!result || typeof result !== 'object') return []
	if (Array.isArray(result.list)) return result.list
	if (Array.isArray(result.data)) return result.data
	if (result.data && Array.isArray(result.data.list)) return result.data.list
	return []
}

const toOptionalTotal = (result) => {
	if (!result || Array.isArray(result) || typeof result !== 'object') return null
	const raw = result.total ?? (result.data && !Array.isArray(result.data) ? result.data.total : null)
	if (raw === null || raw === undefined || raw === '') return null
	const total = Number(raw)
	return Number.isFinite(total) && total >= 0 ? total : null
}

export const normalizeOrderPage = (result, pageSize = 30, loadedCount = 0) => {
	const list = toOrderList(result)
	const total = toOptionalTotal(result)
	const size = Math.max(1, Number(pageSize) || 30)
	return {
		list,
		total,
		hasMore: total === null ? list.length >= size : loadedCount + list.length < total
	}
}

export const appendOrderPage = (current = [], incoming = []) => {
	const next = Array.isArray(current) ? current.slice() : []
	const indexById = new Map(next.map((order, index) => [order && order.id, index]).filter(([id]) => id))
	for (const order of Array.isArray(incoming) ? incoming : []) {
		if (!order || !order.id) continue
		const existingIndex = indexById.get(order.id)
		if (existingIndex === undefined) {
			indexById.set(order.id, next.length)
			next.push(order)
		} else {
			next[existingIndex] = { ...next[existingIndex], ...order }
		}
	}
	return next
}

export const createOrderPaginationState = (pageSize = 30) => ({
	page: 1,
	pageSize: Math.max(1, Number(pageSize) || 30),
	hasMore: true,
	loadingMore: false
})
