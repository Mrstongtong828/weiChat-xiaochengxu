// 开票状态有两套命名，这里是唯一映射处，改动需与后端同步：
//   后端 invoice_info.status 枚举（cicada-admin-order / cicada-client-order）：
//     无需开票 / 待开票 / 开具中 / 已开具
//   用户可见阶段（本文件 + “发票与开票”模块）：
//     待申请 / 资料核对 / 开票中 / 已开票
// 对应关系：
//   待开票、未发票 → 审核中(processing)   （客户已提交、客服/财务核对中）
//   开具中、未发票 → 开票中(issuing)
//   已开具、已发票 → 已开票(issued)
//   已寄出、已签收 → 已开票(issued)      （仅兼容历史记录）
//   无需开票       → 不可开票(disabled)
// 注意：「待申请(available)」不来自 invoice_info.status，而是 getInvoiceStatusKey()
//       根据付款方式与到账状态派生——与后端 applyInvoice 的门槛一致：
//       已完成且已支付的微信支付或已核销的对公转账可申请。
export const invoiceFlow = [
	{ title: '待申请', desc: '选择已完工已支付工单' },
	{ title: '资料核对', desc: '核对抬头、税号与金额' },
	{ title: '开票中', desc: '7-15个工作日' },
	{ title: '已开票', desc: '发票信息同步展示' }
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
	available: { label: '可申请', tone: 'ok', stage: '待申请', desc: '检修已完成且款项已确认，可提交开票资料。' },
	processing: { label: '开票中', tone: 'warn', stage: '开票中', desc: '申请已提交，财务正在核对资料并开票，预计 7-15 个工作日。' },
	reviewing: { label: '开票中', tone: 'warn', stage: '开票中', desc: '申请已提交，财务正在核对资料并开票，预计 7-15 个工作日。' },
	approved: { label: '开票中', tone: 'info', stage: '开票中', desc: '开票资料已审核通过，等待财务开具发票。' },
	issuing: { label: '开票中', tone: 'info', stage: '开票中', desc: '财务正在开具发票，预计 7-15 个工作日完成。' },
	issued: { label: '已开票', tone: 'ok', stage: '已开票', desc: '发票已开具，小程序会展示发票号码、日期和抬头等信息。' },
	awaiting_completion: { label: '待完工', tone: 'muted', stage: '不可申请', desc: '检修服务完成并结单后才能申请开票。' },
	unavailable: { label: '待支付', tone: 'muted', stage: '不可申请', desc: '付款完成或财务确认到账后即可申请开票。' },
	disabled: { label: '无需开票', tone: 'muted', stage: '不进入流程', desc: '当前工单不可申请开票。' }
}

// 付款确认口径与后端 isPaymentConfirmedStatus 一致
const paymentConfirmedStatuses = ['paid', '已付款', '已支付', '已核款', '核款通过', '付款已确认']

export function getInvoiceStatusKey(order = {}) {
	const mappedInvoiceStatus = order.invoiceStatus ? (invoiceStatusMap[order.invoiceStatus] || order.invoiceStatus) : ''
	// 已开具的历史记录仍允许查看，但未完成的旧申请不能绕过当前付款方式规则。
	if (mappedInvoiceStatus === 'issued' || order.invoiced) return 'issued'
	if (mappedInvoiceStatus === 'disabled') return 'disabled'
	if (order.status === '已取消' || order.statusKey === 'cancelled') return 'disabled'
	const paymentMethod = String(order.paymentMethod || order.payment_method || '').trim()
	if (!['offline_transfer', 'bank_transfer', 'wechat_pay'].includes(paymentMethod)) return 'disabled'
	const completed = [order.statusKey, order.status_en, order.statusEn, order.status]
		.map((value) => String(value || '').trim())
		.some((status) => ['completed', '已完成'].includes(status))
	if (!completed) return 'awaiting_completion'
	// 开票门槛与后端 applyInvoice 对齐：已完工、有应付金额且付款已确认。
	const paymentStatus = String(order.paymentStatus || '').trim()
	if (!(Number(order.totalFee || 0) > 0 && paymentConfirmedStatuses.includes(paymentStatus))) return 'unavailable'
	return mappedInvoiceStatus || 'available'
}

export function getInvoiceMeta(order = {}) {
	const key = getInvoiceStatusKey(order)
	const meta = invoiceMetaMap[key] || invoiceMetaMap.unavailable
	return meta
}

export function shouldShowInvoiceEntry(orders = []) {
	const visibleStatuses = ['available', 'processing', 'reviewing', 'approved', 'issuing', 'issued']
	return (Array.isArray(orders) ? orders : []).some((order) => visibleStatuses.includes(getInvoiceStatusKey(order)))
}

export function getInvoiceDocumentAction(order = {}) {
	const invoiceInfo = order.invoiceInfo || order.invoice_info || {}
	const visible = getInvoiceStatusKey(order) === 'issued'
	const fileUrl = String(
		order.invoicePdfUrl
		|| order.invoice_pdf_url
		|| order.pdfUrl
		|| order.pdf_url
		|| invoiceInfo.pdf_url
		|| invoiceInfo.invoice_url
		|| invoiceInfo.file_url
		|| ''
	).trim()
	return {
		visible,
		disabled: !fileUrl,
		label: fileUrl ? '查看/下载发票' : '发票原件待上传',
		fileUrl
	}
}

export function formatInvoiceDisplayText(order = {}) {
	const invoiceInfo = order.invoiceInfo || order.invoice_info || {}
	const fields = [
		['税收分类', order.invoiceTaxCategory || order.taxCategory || order.tax_category || invoiceInfo.tax_category],
		['发票项目', order.invoiceItemName || order.itemName || order.item_name || invoiceInfo.item_name],
		['发票抬头', order.invoiceTitle || order.invoice_title || invoiceInfo.title],
		['发票号码', order.invoiceNo || order.invoice_no || invoiceInfo.invoice_no],
		['开票日期', order.invoiceDate || order.invoice_date || invoiceInfo.invoice_date],
		['开票金额', order.price || order.amount || order.totalPrice || order.total_price],
		['工单号', order.id || order.orderNo || order.order_no]
	]

	return fields
		.map(([label, value]) => [label, String(value || '').trim()])
		.filter(([, value]) => Boolean(value))
		.map(([label, value]) => `${label}：${value}`)
		.join('\n')
}
