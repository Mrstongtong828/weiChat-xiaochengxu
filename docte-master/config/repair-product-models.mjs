export const REPAIR_PRODUCT_MODEL_OTHER_VALUE = '__other_model__'
export const REPAIR_PRODUCT_MODEL_OTHER_LABEL = '其他'

export const splitRepairProductModels = (value = '') => {
	const values = Array.isArray(value) ? value : String(value || '').split(/[、，,；;\n]+/)
	return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))]
}

export const createRepairProductModelOptions = (value = '') => [
	...splitRepairProductModels(value).map((model) => ({ label: model, value: model })),
	{ label: REPAIR_PRODUCT_MODEL_OTHER_LABEL, value: REPAIR_PRODUCT_MODEL_OTHER_VALUE }
]
