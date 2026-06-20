const pad = (num) => String(num).padStart(2, '0')

export const formatFeedbackTime = (ms) => {
	if (!ms) {
		const today = new Date()
		return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
	}
	const date = new Date(ms)
	if (Number.isNaN(date.getTime())) return ''
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const normalizeFeedbackRecord = (item = {}) => ({
	ticketNo: item.ticketNo || item.id,
	type: item.type,
	content: item.content,
	contactType: item.contactType,
	contact: item.contact,
	orderId: item.orderId,
	images: (item.images || []).map((url) => ({ url })),
	status: item.status || 'submitted',
	statusLabel: item.statusLabel || '',
	reply: item.reply || '',
	time: formatFeedbackTime(item.createTime)
})

const feedbackMetaMap = {
	submitted: { label: '已提交', tone: 'info' },
	processing: { label: '处理中', tone: 'warn' },
	replied: { label: '已回复', tone: 'ok' },
	closed: { label: '已完成', tone: 'ok' }
}

export const getFeedbackMeta = (record = {}) => feedbackMetaMap[record.status] || feedbackMetaMap.submitted
