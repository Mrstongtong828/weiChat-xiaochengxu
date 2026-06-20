export const invoiceTodoStatusKeys = ['available', 'processing', 'reviewing', 'approved', 'issuing']

const repairStatusAliases = {
	0: '已提交',
	1: '处理中',
	2: '已回寄',
	3: '已完成',
	submitted: '已提交',
	created: '已提交',
	pending: '已提交',
	sent: '运输中',
	mailed: '运输中',
	received: '已签收',
	signed: '已签收',
	checking: '处理中',
	inspecting: '处理中',
	quoted: '处理中',
	quote_pending: '处理中',
	waiting_quote: '处理中',
	confirming: '处理中',
	waiting_confirm: '处理中',
	fixing: '处理中',
	repairing: '维修中',
	shipped: '已回寄',
	completed: '已完成',
	done: '已完成',
	reviewed: '已评价',
	rated: '已完成',
	'已寄出': '运输中',
	'检测中': '处理中',
	'待报价': '处理中',
	'待确认': '处理中',
	'维修中': '处理中',
	'已发货': '已回寄',
	'已评价': '已完成',
	cancelled: '已取消',
	canceled: '已取消'
}

export const createRepairStatusMeta = (repairStatusFlow = []) => repairStatusFlow.reduce((acc, label, index) => {
	acc[label] = {
		status: label,
		statusGroup: label,
		tone: index < 3 ? 'muted' : index < 5 ? 'warn' : 'ok',
		reached: index
	}
	return acc
}, {
	'已取消': { status: '已取消', statusGroup: '已取消', tone: 'muted', reached: 0 }
})

export const normalizeRepairStatus = (value, fallback = '已提交') => {
	const raw = value === undefined || value === null ? '' : String(value).trim()
	if (!raw) return fallback
	return repairStatusAliases[raw] || repairStatusAliases[raw.toLowerCase()] || raw
}

export const normalizeStatusTab = (value) => {
	const raw = value === undefined || value === null ? '' : String(value).trim()
	if (!raw || raw === '全部') return raw || '全部'
	if (raw === 'pending' || raw === '待处理') return '待处理'
	return repairStatusAliases[raw] || repairStatusAliases[raw.toLowerCase()] || raw
}

export const packageStatusMeta = {
	0: { status: '暂未签收', tone: 'muted', reached: 0 },
	1: { status: '已签收待登记', tone: 'warn', reached: 1 },
	2: { status: '已登记待检测', tone: 'warn', reached: 2 },
	3: { status: '处理中', tone: 'warn', reached: 3 },
	4: { status: '已关联工单', tone: 'ok', reached: 4 },
	5: { status: '已完成', tone: 'ok', reached: 4 }
}

export const getOrderStatusTone = (order = {}) => {
	if (order.statusGroup === '处理中') return 'warn'
	if (order.statusGroup === '已回寄' || order.statusGroup === '已完成') return 'ok'
	if (order.statusGroup === '已取消') return 'muted'
	return order.tone || 'info'
}

const repairProgressNodeLabels = ['已提交', '已寄出', '已签收', '检测中', '待报价', '待付款', '维修中', '已回寄', '已完成']

export const getRepairProgressNodes = (order = {}) => {
	if (!order.id) return []
	const cancelled = order.statusKey === 'cancelled' || order.status === '已取消'
	const statusBaseMap = { pending: 0, sent: 1, received: 2, inspecting: 3, fixing: 6, shipped: 7, completed: 8 }
	const cnBaseMap = { '已提交': 0, '运输中': 1, '已签收': 2, '检测中': 3, '处理中': 6, '已回寄': 7, '已完成': 8 }
	let reached = statusBaseMap[order.statusKey]
	if (reached === undefined) reached = cnBaseMap[order.status]
	if (reached === undefined) reached = 0
	if (['issued', 'confirmed', 'rejected'].includes(order.quoteStatus)) reached = Math.max(reached, 4)
	if (order.paymentStatus === 'paid') reached = Math.max(reached, 5)
	const completed = order.statusKey === 'completed' || order.status === '已完成'
	return repairProgressNodeLabels.map((label, index) => ({
		label,
		state: cancelled ? 'pending' : (completed ? 'done' : (index < reached ? 'done' : (index === reached ? 'current' : 'pending')))
	}))
}
