// 开票状态有两套命名，这里是唯一映射处，改动需与后端同步：
//   后端 invoice_info.status 枚举（cicada-admin-order / cicada-client-order）：
//     无需开票 / 待开票 / 开具中 / 已开具
//   用户可见阶段（本文件 + 《开票指南》）：
//     待申请 / 审核中 / 开票中 / 已开票
// 对应关系：
//   待开票、未发票 → 审核中(processing)   （客户已提交、客服/财务核对中）
//   开具中、未发票 → 开票中(issuing)
//   已开具、已发票 → 已开票(issued)
//   无需开票       → 不可开票(disabled)
// 注意：「待申请(available)」不来自 invoice_info.status，而是 getInvoiceStatusKey()
//       根据订单是否完成（已完成/已评价）派生——即“工单可申请但尚未提交开票资料”。
export const invoiceFlow = [
	{ title: '待申请', desc: '选择已完成工单' },
	{ title: '审核中', desc: '客服核对抬头与金额' },
	{ title: '开票中', desc: '财务开具电子发票' },
	{ title: '已开票', desc: '复制链接查看发票' }
]

const invoiceStatusMap = {
	待开票: 'processing',
	未发票: 'processing',
	开具中: 'issuing',
	已开具: 'issued',
	已发票: 'issued',
	无需开票: 'disabled'
}

const invoiceMetaMap = {
	available: { label: '可申请', tone: 'ok', stage: '待申请', desc: '维修已完成，可申请电子普通发票。' },
	processing: { label: '审核中', tone: 'warn', stage: '审核中', desc: '申请已提交，客服正在核对抬头、税号和维修金额。' },
	reviewing: { label: '审核中', tone: 'warn', stage: '审核中', desc: '申请已提交，客服正在核对抬头、税号和维修金额。' },
	approved: { label: '开票中', tone: 'info', stage: '开票中', desc: '开票资料已审核通过，等待财务开具电子发票。' },
	issuing: { label: '开票中', tone: 'info', stage: '开票中', desc: '财务正在开具电子发票，完成后会同步链接。' },
	issued: { label: '已开票', tone: 'ok', stage: '已开票', desc: '电子发票已开具，可复制链接查看。' },
	unavailable: { label: '待完成', tone: 'muted', stage: '不可申请', desc: '维修完成并结算后即可申请开票。' },
	disabled: { label: '不可开票', tone: 'muted', stage: '不可申请', desc: '该订单暂不支持开票。' }
}

export function getInvoiceStatusKey(order = {}) {
	if (order.invoiceStatus) return invoiceStatusMap[order.invoiceStatus] || order.invoiceStatus
	if (order.invoiced) return 'issued'
	if (order.status === '已取消') return 'disabled'
	if (order.statusGroup === '已完成' || ['已完成', '已评价'].includes(order.status)) return 'available'
	return 'unavailable'
}

export function getInvoiceMeta(order = {}) {
	return invoiceMetaMap[getInvoiceStatusKey(order)] || invoiceMetaMap.unavailable
}
