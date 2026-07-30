import { unwrapCloudResult, uploadToCloud, withToken } from './cloudHelpers.js'
import { getCloudTempFileURL, importCloudObject, checkCloudAvailable } from '@/utils/cloud.js'
import request from '@/utils/request.js'

let publicCloudObject = null
let userCloudObject = null
let orderCloudObject = null

const getPublicCloudObject = () => {
	if (!publicCloudObject) {
		const next = importCloudObject('cicada-client-public')
		if (next) publicCloudObject = next
	}
	if (!publicCloudObject) {
		throw new Error('服务暂不可用，请稍后重试或联系客服')
	}
	return publicCloudObject
}

const getUserCloudObject = () => {
	if (!userCloudObject) {
		const next = importCloudObject('cicada-client-user')
		if (next) userCloudObject = next
	}
	if (!userCloudObject) {
		throw new Error('服务暂不可用，请稍后重试或联系客服')
	}
	return userCloudObject
}

const getOrderCloudObject = () => {
	if (!orderCloudObject) {
		const next = importCloudObject('cicada-client-order')
		if (next) orderCloudObject = next
	}
	if (!orderCloudObject) {
		throw new Error('服务暂不可用，请稍后重试或联系客服')
	}
	return orderCloudObject
}

const parseSettingFile = (value) => {
	try {
		const parsed = value ? JSON.parse(value) : {}
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
	} catch (e) {
		return {}
	}
}

// 把单个 cloud:// 文件地址解析为临时可访问地址（用于客服/公众号二维码等）
const resolveCloudUrl = async (value) => {
	if (!value || !/^cloud:\/\//i.test(String(value))) return value || ''
	try {
		const res = await getCloudTempFileURL([value])
		const item = (res.fileList || [])[0]
		return (item && item.tempFileURL) || value
	} catch (e) {
		return value
	}
}

const settingDoc = (title, content = '', file = null) => ({
	title,
	content: String(content || ''),
	...(file && file.fileUrl ? {
		fileName: file.fileName || title,
		fileUrl: file.fileUrl,
		fileType: file.fileType || '',
		updatedAt: file.updatedAt || ''
	} : {})
})

const normalizeAddress = (data = {}) => {
	const region = Array.isArray(data.region)
		? data.region.filter(Boolean).join('/')
		: (data.region || [data.province, data.city, data.district].filter(Boolean).join('/'))
	const contactPhones = (Array.isArray(data.contactPhones)
		? data.contactPhones
		: (Array.isArray(data.contact_phones) ? data.contact_phones : []))
		.map((item) => String(item || '').replace(/\D/g, ''))
		.filter(Boolean)
	return {
		_id: data.addressId || data._id,
		name: data.name || data.receiver || '',
		phone: data.phone || '',
		region,
		detail: data.detail || '',
		unit: data.unit || '',
		contact_phones: contactPhones,
		is_default: data.isDefault === 1 || data.isDefault === true || data.is_default === true
	}
}

// 后端地址 → 地址管理页（pages-sub/address）使用的结构
const denormalizeAddress = (item = {}) => ({
	id: item._id || item.id || '',
	receiver: item.name || '',
	name: item.name || '',
	phone: String(item.phone || '').replace(/\D/g, ''),
	region: typeof item.region === 'string'
		? item.region.split(/[\/\s]+/).filter(Boolean)
		: (Array.isArray(item.region) ? item.region : []),
	detail: item.detail || '',
	unit: item.unit || '',
	contactPhones: Array.isArray(item.contact_phones) ? item.contact_phones : [],
	isDefault: item.is_default === true,
	createdAt: item.create_time || Date.now(),
	updatedAt: item.update_time || item.create_time || Date.now()
})

const normalizeCategory = (item = {}) => ({
	id: item._id || item.id,
	name: item.category_name || item.name || item.title || '',
	title: item.category_name || item.title || item.name || ''
})

const isGeneratedId = (value) => /^[a-f0-9]{16,32}$/i.test(String(value || '').trim())

const displayName = (value) => {
	const text = String(value || '').trim()
	return text && !isGeneratedId(text) ? text : ''
}

const normalizeFaultTextList = (value) => {
	if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
	return String(value || '')
		.split(/\n|\uFF1B|;/)
		.map(item => item.trim())
		.filter(Boolean)
}

const normalizeRecommendRepair = (value) => value === true
	|| value === 1
	|| ['1', 'true', 'yes', '建议', '建议报修'].includes(String(value || '').trim().toLowerCase())

export const wechatLogin = (data = {}) => {
	const cloudObject = getUserCloudObject()
	if (!cloudObject || typeof cloudObject.login !== 'function') {
		return Promise.reject(new Error('云端登录方法未部署，请重新部署 cicada-client-user'))
	}
	return cloudObject.login(data).then(unwrapCloudResult)
}

export const logout = () => Promise.resolve()

// 用户自助注销账号：调用后端软删除+脱敏，成功后清本地登录态
export const cancelAccount = async () => {
	const cloudObject = getUserCloudObject()
	if (!cloudObject || typeof cloudObject.cancelAccount !== 'function') {
		throw new Error('云端注销方法未部署，请重新部署 cicada-client-user')
	}
	const res = await cloudObject.cancelAccount(withToken({ confirm: true })).then(unwrapCloudResult)
	uni.removeStorageSync('token')
	uni.removeStorageSync('userInfo')
	uni.removeStorageSync('isLoggedIn')
	return res
}

export const getUserInfo = () => Promise.resolve(uni.getStorageSync('userInfo') || {})

export const uploadImage = (filePath) => uploadToCloud(filePath, 'repair/images', 'jpg')

export const uploadVideo = (filePath) => uploadToCloud(filePath, 'repair/videos', 'mp4')

export const uploadFeedbackImage = (filePath) => uploadToCloud(filePath, 'feedback/images', 'jpg')

export const getWarrantyPolicy = async () => {
	const settings = await getPublicCloudObject().getSettings({ keys: ['warranty_policy', 'warranty_policy_sections'] }).then(unwrapCloudResult)
	// 分块结构化配置（后台可编辑的 JSON 数组 [{title, content}]）；无配置或解析失败时回退整段富文本
	let sections = []
	try {
		const parsed = JSON.parse(settings.warranty_policy_sections || '[]')
		if (Array.isArray(parsed)) {
			sections = parsed
				.filter((item) => item && (item.title || item.content))
				.map((item) => ({ title: String(item.title || ''), content: String(item.content || '') }))
		}
	} catch (e) {
		sections = []
	}
	return { ...settingDoc('保修政策', settings.warranty_policy), sections }
}

export const getFeePolicy = async () => {
	const settings = await getPublicCloudObject().getSettings({ keys: ['fee_description', 'fee_policy'] }).then(unwrapCloudResult)
	return settingDoc('收费指南', settings.fee_description || settings.fee_policy)
}

export const getGuide = (type) => getPublicCloudObject().getGuide({ type }).then(unwrapCloudResult)

// 全部教程/指南（含 category 分类与 media 视频，用于公司介绍「产品视频」等栏目）
// forceRefresh: true 时绕过云函数 5 分钟缓存，确保后台刚保存的内容立即可见
export const getGuides = (opts = {}) => getPublicCloudObject()
	.getGuides({ forceRefresh: opts.forceRefresh === true })
	.then(unwrapCloudResult)

// 首页教程弹窗配置
export const getHomeGuidePopup = async () => {
	const settings = await getPublicCloudObject().getSettings({
		keys: ['home_guide_popup_enabled', 'home_guide_popup_content']
	}).then(unwrapCloudResult)
	return {
		enabled: settings.home_guide_popup_enabled === '1' || settings.home_guide_popup_enabled === true,
		content: settings.home_guide_popup_content || ''
	}
}

export const getContact = async () => {
	const settings = await getPublicCloudObject().getSettings({
		keys: [
			'contact_phone',
			'contact_email',
			'contact_address',
			'work_time',
			'company_name',
			'bank_transfer_company_name',
			'bank_transfer_tax_no',
			'bank_transfer_address_phone',
			'bank_transfer_bank_name',
			'bank_transfer_account_no',
			'bank_transfer_line_no'
		]
	}).then(unwrapCloudResult)
	return {
		companyName: settings.company_name,
		phone: settings.contact_phone,
		email: settings.contact_email,
		address: settings.contact_address,
		workTime: settings.work_time,
		bankCompanyName: settings.bank_transfer_company_name || '佛山市登煌医疗器械有限公司',
		bankTaxNo: settings.bank_transfer_tax_no || '91440605688623440U',
		bankAddressPhone: settings.bank_transfer_address_phone || '佛山市南海区狮山镇罗村广东新光源产业基地核心区内B区5座二层  0757-85775667',
		bankName: settings.bank_transfer_bank_name || '中国农业银行佛山惠景支行',
		bankAccount: settings.bank_transfer_account_no || '4442 3201 0400 04288',
		bankLineNo: settings.bank_transfer_line_no || '103588042208'
	}
}

export const getCustomerService = async () => {
	const settings = await getPublicCloudObject().getSettings({
		keys: ['customer_service_title', 'customer_service_desc', 'customer_service_wechat', 'customer_service_qrcode']
	}).then(unwrapCloudResult)
	return {
		title: settings.customer_service_title,
		description: settings.customer_service_desc,
		wechat: settings.customer_service_wechat,
		qrcodeUrl: await resolveCloudUrl(settings.customer_service_qrcode)
	}
}

export const getWechat = async () => {
	const settings = await getPublicCloudObject().getSettings({
		keys: ['wechat_name', 'wechat_desc', 'wechat_qrcode']
	}).then(unwrapCloudResult)
	return {
		name: settings.wechat_name,
		description: settings.wechat_desc,
		qrcodeUrl: await resolveCloudUrl(settings.wechat_qrcode)
	}
}

export const getSubscriptionConfig = () => getPublicCloudObject()
	.getSubscriptionConfig({})
	.then(unwrapCloudResult)

export const getFaultTypes = async (options = {}) => {
	const forceRefresh = options.forceRefresh === true
	const [list, categories] = await Promise.all([
		getPublicCloudObject().getFaultKb({ forceRefresh }).then(unwrapCloudResult),
		getPublicCloudObject().getCategories({ forceRefresh }).then(unwrapCloudResult).catch(() => [])
	])
	const categoryMap = Array.isArray(categories)
		? categories.reduce((map, item) => {
			const category = normalizeCategory(item)
			if (category.id) map[category.id] = category.title || category.name
			return map
		}, {})
		: {}

	return Array.isArray(list) ? list.map(item => {
		const categoryName = displayName(item.category_name)
			|| displayName(categoryMap[item.category_id])
			|| displayName(item.productType)
			|| displayName(item.productName)

		if (!categoryName) return null
		const fixSolutions = normalizeFaultTextList(item.fix_solutions || item.fixSolutions || item.solutions || item.solution)

		return {
			id: item._id,
			faultTypeId: item._id,
			productTypeId: item.category_id,
			productType: categoryName,
			faultName: item.fault_name,
			relatedQuestions: normalizeFaultTextList(item.related_questions || item.relatedQuestions),
			checkSteps: normalizeFaultTextList(item.check_steps || item.checkSteps),
			fixSolutions,
			solutions: fixSolutions,
			solution: fixSolutions,
			isRecommendRepair: normalizeRecommendRepair(item.is_recommend_repair || item.isRecommendRepair)
		}
	}).filter(Boolean) : []
}

export const searchFault = async (data = {}) => {
	const list = await getFaultTypes({ forceRefresh: data.forceRefresh === true })
	const targetFaultId = data.faultTypeId || data.id
	const targetFaultName = data.faultName
	const targetProductType = data.productType || data.productTypeId

	return list.find(item => {
		if (targetFaultId && item.id === targetFaultId) return true
		if (targetFaultName && item.faultName === targetFaultName) {
			return !targetProductType || item.productTypeId === targetProductType || item.productType === targetProductType
		}
		return !targetFaultId && !targetFaultName && targetProductType && (
			item.productTypeId === targetProductType || item.productType === targetProductType
		)
	}) || null
}

export const queryPackageStatus = (params = {}) => getOrderCloudObject()
	.queryPackageStatus(withToken(params))
	.then(unwrapCloudResult)

export const applyInvoice = (data = {}) => getOrderCloudObject()
	.applyInvoice(withToken(data))
	.then(unwrapCloudResult)

// 开票记录列表（cicada-client-order.getInvoiceList，从订单 invoice_info 派生）
export const getInvoiceList = (params = {}) => getOrderCloudObject()
	.getInvoiceList(withToken({ page: params.page || 1, pageSize: params.pageSize || params.size || 10 }))
	.then(unwrapCloudResult)

export const getProductList = async (params = {}) => {
	const list = await getUserCloudObject().manageDevice(withToken({ action: 'list' })).then(unwrapCloudResult)
	return {
		list: Array.isArray(list) ? list.map(item => ({
			id: item._id,
			productName: item.product_name,
			productModel: item.product_name,
			productSerial: item.sn,
			buyDate: item.buy_date,
			warrantyStatus: item.warranty_status
		})) : [],
		total: Array.isArray(list) ? list.length : 0,
		page: params.page || 1,
		pageSize: params.pageSize || params.size || 10
	}
}

export const getAddressList = async () => {
	const list = await getUserCloudObject()
		.manageAddress(withToken({ action: 'list' }))
		.then(unwrapCloudResult)
	return Array.isArray(list) ? list.map(denormalizeAddress) : []
}

export const addAddress = (data) => getUserCloudObject()
	.manageAddress(withToken({ action: 'add', address: normalizeAddress(data) }))
	.then(unwrapCloudResult)

export const updateAddress = (data) => getUserCloudObject()
	.manageAddress(withToken({ action: 'edit', address: normalizeAddress(data) }))
	.then(unwrapCloudResult)

export const deleteAddress = (addressId) => getUserCloudObject()
	.manageAddress(withToken({ action: 'delete', address: { _id: addressId } }))
	.then(unwrapCloudResult)

const normalizeFeedbackImages = (images = []) => {
	if (!Array.isArray(images)) return []
	return images
		.map((item) => {
			if (typeof item === 'string') return item
			if (!item || typeof item !== 'object') return ''
			return item.fileID || item.fileId || item.cloudUrl || item.url || item.fileUrl || item.path || ''
		})
		.map((item) => String(item || '').trim())
		.filter(Boolean)
		.slice(0, 3)
}

export const addComplaint = (data = {}) => getUserCloudObject()
	.submitFeedback(withToken({
		type: data.type === 0 ? '投诉' : data.type === 1 ? '建议' : data.type,
		content: data.content,
		images: normalizeFeedbackImages(data.images),
		contact_type: data.contactType || data.contact_type || '',
		contact_value: data.contact || data.contactValue || data.contact_value || '',
		rel_order_no: data.orderId || data.rel_order_no || ''
	}))
	.then(unwrapCloudResult)

export const getComplaintList = (data = {}) => getUserCloudObject()
	.getComplaintList(withToken({ page: data.page || 1, pageSize: data.pageSize || data.size || 10 }))
	.then(unwrapCloudResult)

export const getProductCategories = () => getPublicCloudObject().getCategories({}).then(unwrapCloudResult)

// 隐私与合规配置（隐私政策/注销规则/资质公示）
export const getSurveyConfig = () => getPublicCloudObject().getSurveyConfig({}).then(unwrapCloudResult)

export const submitAfterSalesSurvey = (data = {}) => getPublicCloudObject()
	.submitSurvey(withToken({
		orderNo: data.orderNo || '',
		satisfaction: data.satisfaction || '',
		rating: data.rating || 0,
		resolved: data.resolved || '',
		comment: data.comment || '',
		contact: data.contact || '',
		source: 'miniapp'
	}))
	.then(unwrapCloudResult)

export const getCompliance = async () => {
	const settings = await getPublicCloudObject().getSettings({
		keys: ['privacy_policy', 'account_cancellation_policy', 'qualifications']
	}).then(unwrapCloudResult)

	let qualifications = []
	try {
		const parsed = settings.qualifications ? JSON.parse(settings.qualifications) : []
		if (Array.isArray(parsed)) qualifications = parsed
	} catch (e) {
		qualifications = []
	}

	// 把资质图片的 cloud:// 地址解析为临时可访问地址
	const cloudIds = qualifications
		.filter(it => it && it.type === 'image' && /^cloud:\/\//i.test(String(it.imageUrl || '')))
		.map(it => it.imageUrl)
	if (cloudIds.length) {
		try {
			const res = await getCloudTempFileURL(cloudIds)
			const map = {}
			;(res.fileList || []).forEach(item => { if (item && item.fileID) map[item.fileID] = item.tempFileURL })
			qualifications = qualifications.map(it => (it.type === 'image' && map[it.imageUrl]) ? { ...it, imageUrl: map[it.imageUrl] } : it)
		} catch (e) {
			// 解析失败则保留原始地址
		}
	}

	return {
		privacyPolicy: settings.privacy_policy || '',
		cancellationPolicy: settings.account_cancellation_policy || '',
		qualifications
	}
}
