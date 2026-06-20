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

// ——— 状态唯一真相：后端 8 态主状态 + 子状态派生显示标签 ———
// 后端 cicada-order-workflow 的主状态键，是所有页面状态显示的唯一基准。
export const CANONICAL_STATUS_KEYS = ['pending', 'sent', 'received', 'inspecting', 'fixing', 'shipped', 'completed', 'cancelled']

const cnLabelToKey = {
	'已提交': 'pending', '运输中': 'sent', '已寄出': 'sent', '已签收': 'received',
	'检测中': 'inspecting', '待报价': 'inspecting', '待确认': 'inspecting', '待确认报价': 'inspecting',
	'待付款': 'fixing', '待核款': 'fixing', '处理中': 'fixing', '维修中': 'fixing',
	'已回寄': 'shipped', '已发货': 'shipped', '已完成': 'completed', '已评价': 'completed', '已取消': 'cancelled'
}

const numToStatusKey = { 0: 'pending', 1: 'fixing', 2: 'shipped', 3: 'completed' }

const statusKeyAliases = {
	submitted: 'pending', created: 'pending', mailed: 'sent', signed: 'received',
	checking: 'inspecting', quoted: 'inspecting', quote_pending: 'inspecting', waiting_quote: 'inspecting',
	confirming: 'inspecting', waiting_confirm: 'inspecting', repairing: 'fixing', done: 'completed',
	reviewed: 'completed', rated: 'completed', canceled: 'cancelled'
}

// 把任意来源（后端英文键 / 中文标签 / 数字 / 别名）归一为后端主状态键
export const resolveStatusKey = (order = {}) => {
	const raw = order && typeof order === 'object'
		? (order.statusKey ?? order.status_key ?? order.status ?? order.statusText ?? order.statusName)
		: order
	const value = raw === undefined || raw === null ? '' : String(raw).trim()
	if (!value) return 'pending'
	if (CANONICAL_STATUS_KEYS.includes(value)) return value
	const lower = value.toLowerCase()
	if (CANONICAL_STATUS_KEYS.includes(lower)) return lower
	if (cnLabelToKey[value]) return cnLabelToKey[value]
	if (numToStatusKey[value] !== undefined) return numToStatusKey[value]
	return statusKeyAliases[lower] || 'pending'
}

// 唯一的显示标签派生：主状态 + 报价/付款子状态 → 细分文案
export const deriveDisplayStatus = (order = {}) => {
	const key = resolveStatusKey(order)
	const quote = order.quoteStatus || order.quote_status || ''
	const payment = order.paymentStatus || order.payment_status || ''
	if (key === 'cancelled') return '已取消'
	if (key === 'completed') return (order.review || order.reviewTime || order.review_time) ? '已评价' : '已完成'
	if (key === 'shipped') return '已回寄'
	if (key === 'pending') return '已提交'
	if (key === 'sent') return '运输中'
	if (key === 'received') return '已签收'
	// inspecting / fixing 受报价、付款子状态细分
	if (payment === 'uploaded') return '待核款'
	if (quote === 'issued') return '待确认报价'
	if (quote === 'confirmed' && payment !== 'paid') return '待付款'
	if (key === 'inspecting') return '检测中'
	return '维修中'
}

// 四个角标桶，口径与后端 getOrderStats 完全一致（pending=已提交/运输中/已签收/检测中）
export const STATUS_BUCKETS = [
	{ id: 'all', title: '全部', keys: CANONICAL_STATUS_KEYS },
	{ id: 'pending', title: '待处理', keys: ['pending', 'sent', 'received', 'inspecting'] },
	{ id: 'fixing', title: '维修中', keys: ['fixing'] },
	{ id: 'shipped', title: '已发货', keys: ['shipped'] }
]

// 返回订单所属角标桶 id（completed/cancelled 仅计入 all）
export const getStatusBucket = (order = {}) => {
	const key = resolveStatusKey(order)
	if (['pending', 'sent', 'received', 'inspecting'].includes(key)) return 'pending'
	if (key === 'fixing') return 'fixing'
	if (key === 'shipped') return 'shipped'
	return ''
}

// 按订单列表汇总四桶计数（后端 stats 不可用时的统一兜底）
export const countStatusBuckets = (list = []) => {
	const counts = { all: 0, pending: 0, fixing: 0, shipped: 0 }
	;(Array.isArray(list) ? list : []).forEach(order => {
		counts.all += 1
		const bucket = getStatusBucket(order)
		if (bucket && counts[bucket] !== undefined) counts[bucket] += 1
	})
	return counts
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
