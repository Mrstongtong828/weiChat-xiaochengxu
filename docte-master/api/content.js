import { unwrapCloudResult, uploadToCloud, withToken } from './cloudHelpers.js'
import { getCloudTempFileURL, importCloudObject, checkCloudAvailable } from '@/utils/cloud.js'
import request from '@/utils/request.js'

let publicCloudObject = null
let userCloudObject = null
let orderCloudObject = null

const getPublicCloudObject = () => {
	if (!publicCloudObject) publicCloudObject = importCloudObject('cicada-client-public')
	if (!publicCloudObject) {
		throw new Error('云服务暂不可用，请稍后重试或联系客服')
	}
	return publicCloudObject
}

const getUserCloudObject = () => {
	if (!userCloudObject) userCloudObject = importCloudObject('cicada-client-user')
	if (!userCloudObject) {
		throw new Error('云服务暂不可用，请稍后重试或联系客服')
	}
	return userCloudObject
}

const getOrderCloudObject = () => {
	if (!orderCloudObject) orderCloudObject = importCloudObject('cicada-client-order')
	if (!orderCloudObject) {
		throw new Error('云服务暂不可用，请稍后重试或联系客服')
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

// 后端地址 → 地址管理页（pages/address）使用的结构
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

const getLocalDevLoginSession = () => ({
	token: `local-offline-token-${Date.now()}`,
	offline: true,
	phoneAuthorized: false,
	userInfo: {
		id: 'local-offline-user',
		userId: 'local-offline-user',
		phone: '',
		nickname: '微信体验用户',
		avatar: '',
		unit: '云服务未连接',
		role: 'user'
	}
})

const allowOfflineLoginFallback = () => {
	// #ifdef H5
	return true
	// #endif
	return false
}

const isCloudUnavailableError = (error) => /云服务未连接|云服务未初始化|uniCloud 服务空间|importObject|uniCloud/i.test(String(error && (error.message || error.errMsg || error)))

export const wechatLogin = (data = {}) => {
	try {
		const cloudObject = getUserCloudObject()
		if (!cloudObject || typeof cloudObject.login !== 'function') {
			throw new Error('云服务未连接，请先在 HBuilderX 关联并部署 uniCloud')
		}
		return cloudObject.login(data).then(unwrapCloudResult).catch((error) => {
			if (allowOfflineLoginFallback() && isCloudUnavailableError(error)) {
				console.warn('cloud login unavailable, using offline session:', error)
				return getLocalDevLoginSession()
			}
			throw error
		})
	} catch (error) {
		if (allowOfflineLoginFallback() && isCloudUnavailableError(error)) {
			console.warn('cloud login unavailable, using offline session:', error)
			return Promise.resolve(getLocalDevLoginSession())
		}
		return Promise.reject(error)
	}
}

export const devLogin = async () => {
	try {
		const cloudObject = getUserCloudObject()
		if (!cloudObject || typeof cloudObject.devLogin !== 'function') {
			return getLocalDevLoginSession()
		}
		return await cloudObject.devLogin({}).then(unwrapCloudResult)
	} catch (error) {
		if (isCloudUnavailableError(error)) {
			console.warn('cloud devLogin unavailable, using local dev session:', error)
			return getLocalDevLoginSession()
		}
		throw error
	}
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
	const settings = await getPublicCloudObject().getSettings({ keys: ['warranty_policy'] }).then(unwrapCloudResult)
	return settingDoc('保修政策', settings.warranty_policy)
}

export const getFeePolicy = async () => {
	const settings = await getPublicCloudObject().getSettings({ keys: ['fee_description', 'fee_policy'] }).then(unwrapCloudResult)
	return settingDoc('收费指南', settings.fee_description || settings.fee_policy)
}

export const getGuide = (type) => getPublicCloudObject().getGuide({ type }).then(unwrapCloudResult)

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
		keys: ['contact_phone', 'contact_email', 'contact_address', 'work_time', 'company_name']
	}).then(unwrapCloudResult)
	return {
		companyName: settings.company_name,
		phone: settings.contact_phone,
		email: settings.contact_email,
		address: settings.contact_address,
		workTime: settings.work_time
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

export const getFaultTypes = async () => {
	const [list, categories] = await Promise.all([
		getPublicCloudObject().getFaultKb({}).then(unwrapCloudResult),
		getPublicCloudObject().getCategories({}).then(unwrapCloudResult).catch(() => [])
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

		return {
			id: item._id,
			productTypeId: item.category_id,
			productType: categoryName,
			faultName: item.fault_name,
			relatedQuestions: item.related_questions || [],
			checkSteps: item.check_steps || [],
			solutions: item.fix_solutions || [],
			confirmInfo: item.related_questions || [],
			solution: item.fix_solutions || [],
			isRecommendRepair: item.is_recommend_repair
		}
	}).filter(Boolean) : []
}

export const searchFault = async (data = {}) => {
	const list = await getFaultTypes()
	return list.find(item =>
		item.id === data.faultTypeId ||
		item.faultName === data.faultName ||
		item.productTypeId === data.productType
	) || null
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
	.submitSurvey({
		orderNo: data.orderNo || '',
		satisfaction: data.satisfaction || '',
		rating: data.rating || 0,
		resolved: data.resolved || '',
		comment: data.comment || '',
		contact: data.contact || '',
		source: 'miniapp'
	})
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
