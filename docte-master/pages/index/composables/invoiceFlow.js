// 开票状态有两套命名，这里是唯一映射处，改动需与后端同步：
//   后端 invoice_info.status 枚举（cicada-admin-order / cicada-client-order）：
//     无需开票 / 待开票 / 开具中 / 已开具（纸质专票另有 已寄出 / 已签收）
//   用户可见阶段（本文件 + 《开票指南》）：
//     待申请 / 审核中 / 开票中 / 已开票
// 对应关系：
//   待开票、未发票 → 审核中(processing)   （客户已提交、客服/财务核对中）
//   开具中、未发票 → 开票中(issuing)
//   已开具、已发票 → 已开票(issued)
//   已寄出、已签收 → 已开票(issued)      （纸质专票邮寄阶段，票已开出）
//   无需开票       → 不可开票(disabled)
// 注意：「待申请(available)」不来自 invoice_info.status，而是 getInvoiceStatusKey()
//       根据付款是否确认派生——与后端 applyInvoice 的门槛一致（total_price>0 且已付款/已核款），
//       即"工单可申请但尚未提交开票资料"。
export const invoiceFlow = [
	{ title: '待申请', desc: '选择已付款工单' },
	{ title: '审核中', desc: '客服核对抬头与金额' },
	{ title: '开票中', desc: '财务开具发票' },
	{ title: '已开票', desc: '电子票复制链接 / 纸质票查邮寄' }
]

const invoiceStatusMap = {
	待开票: 'processing',
	未发票: 'processing',
	开具中: 'issuing',
	已开具: 'issued',
	已发票: 'issued',
	已寄出: 'issued',
	已签收: 'issued',
	无需开票: 'disabled'
}

const invoiceMetaMap = {
	available: { label: '可申请', tone: 'ok', stage: '待申请', desc: '费用已付款确认，可申请开具发票。' },
	processing: { label: '审核中', tone: 'warn', stage: '审核中', desc: '申请已提交，客服正在核对抬头、税号和维修金额。' },
	reviewing: { label: '审核中', tone: 'warn', stage: '审核中', desc: '申请已提交，客服正在核对抬头、税号和维修金额。' },
	approved: { label: '开票中', tone: 'info', stage: '开票中', desc: '开票资料已审核通过，等待财务开具发票。' },
	issuing: { label: '开票中', tone: 'info', stage: '开票中', desc: '财务正在开具发票，完成后会同步链接或邮寄信息。' },
	issued: { label: '已开票', tone: 'ok', stage: '已开票', desc: '发票已开具，电子票可复制链接查看，纸质票可查看邮寄进度。' },
	unavailable: { label: '待付款', tone: 'muted', stage: '不可申请', desc: '维修费用付款确认后即可申请开票。' },
	disabled: { label: '不可开票', tone: 'muted', stage: '不可申请', desc: '该订单暂不支持开票。' }
}

// 付款确认口径与后端 isPaymentConfirmedStatus 一致
const paymentConfirmedStatuses = ['paid', '已付款', '已支付', '已核款', '核款通过', '付款已确认']

export function getInvoiceStatusKey(order = {}) {
	if (order.invoiceStatus) return invoiceStatusMap[order.invoiceStatus] || order.invoiceStatus
	if (order.invoiced) return 'issued'
	if (order.status === '已取消' || order.statusKey === 'cancelled') return 'disabled'
	// 开票门槛与后端 applyInvoice 对齐：有应付金额且付款已确认（不再要求工单"已完成"）
	const paymentStatus = String(order.paymentStatus || '').trim()
	if (Number(order.totalFee || 0) > 0 && paymentConfirmedStatuses.includes(paymentStatus)) return 'available'
	return 'unavailable'
}

export function getInvoiceMeta(order = {}) {
	return invoiceMetaMap[getInvoiceStatusKey(order)] || invoiceMetaMap.unavailable
}
