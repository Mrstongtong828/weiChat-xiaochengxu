import faultKnowledgeBase from '@/uniCloud-alipay/database/cicada_fault_kb.init_data.json'

const productCategories = [
	{ id: 'cat-root-measure', title: '根治、根测系列' },
	{ id: 'cat-implant', title: '种植机系列' },
	{ id: 'cat-electric-motor', title: '牙科电动马达系列' },
	{ id: 'cat-led-curing', title: 'LED光固化系列' },
	{ id: 'cat-obturation', title: '热牙胶充填系列' },
	{ id: 'cat-high-speed', title: '高速手机系列' },
	{ id: 'cat-low-speed-handpiece', title: '低速手机系列' },
	{ id: 'cat-low-speed-motor', title: '低速马达' },
	{ id: 'cat-cleaner', title: '清洗机' },
	{ id: 'cat-sandblaster', title: '超声喷砂洁牙机' }
]

const categoryNameMap = Object.fromEntries(productCategories.map((item) => [item.id, item.title]))
const normalizeTextList = (value) => (Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [])

export const defaultFaultTypes = faultKnowledgeBase
	.map((item = {}) => {
		const productTypeId = String(item.category_id || '').trim()
		const productType = categoryNameMap[productTypeId]
		const faultName = String(item.fault_name || '').trim()
		if (!productTypeId || !productType || !faultName) return null
		const fixSolutions = normalizeTextList(item.fix_solutions)
		return {
			id: item._id,
			faultTypeId: item._id,
			productTypeId,
			productType,
			faultName,
			relatedQuestions: normalizeTextList(item.related_questions),
			checkSteps: normalizeTextList(item.check_steps),
			fixSolutions,
			solutions: fixSolutions,
			solution: fixSolutions,
			isRecommendRepair: item.is_recommend_repair === true
		}
	})
	.filter(Boolean)
