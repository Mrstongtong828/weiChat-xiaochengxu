export const SUBSCRIPTION_ACTION_SCENES = Object.freeze({
	repair_submit: Object.freeze(['repair_submit', 'device_receive_ship', 'payment_quote']),
	track_view: Object.freeze(['device_receive_ship']),
	wechat_pay: Object.freeze(['payment_quote', 'device_receive_ship']),
	payment_proof: Object.freeze(['payment_quote', 'device_receive_ship']),
	warranty_confirm: Object.freeze(['device_receive_ship']),
	quote_reject: Object.freeze(['device_receive_ship'])
})

export const getSubscriptionScenesForAction = (action = '') => [
	...(SUBSCRIPTION_ACTION_SCENES[String(action || '').trim()] || [])
]

export const selectSubscriptionTemplateIds = (templates = [], action = '', limit = 5) => {
	const allowedScenes = new Set(getSubscriptionScenesForAction(action))
	if (!allowedScenes.size) return []
	return [...new Set((Array.isArray(templates) ? templates : [])
		.filter((item) => item && allowedScenes.has(item.scene) && item.templateId)
		.map((item) => item.templateId))]
		.slice(0, Math.max(1, Number(limit) || 5))
}
