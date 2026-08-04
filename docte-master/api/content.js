import { unwrapCloudResult, uploadToCloud, withToken } from './cloudHelpers.js'
import { getCloudTempFileURL, importCloudObject, checkCloudAvailable } from '@/utils/cloud.js'
import request from '@/utils/request.js'
import { parsePolicyDocument, resolvePolicyDocumentFiles } from '@/utils/policyDocument.js'

const escapePolicyHtml = (value = '') => String(value)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;')

const policyLinesToHtml = (lines = []) => lines
	.map(line => {
		const content = escapePolicyHtml(line)
		return /^(第.+条|[一二三四五六七八九十]、)/.test(line)
			? '<p><strong>' + content + '</strong></p>'
			: '<p>' + content + '</p>'
	})
	.join('')

const DEFAULT_PRIVACY_POLICY = policyLinesToHtml([
	'为规范个人信息处理活动，遵守《中华人民共和国个人信息保护法》《网络安全法》《微信小程序平台运营规范》，思科达向您清晰说明小程序信息收集、使用、存储相关规则，请您仔细阅读。',
	'一、我们收集的个人信息',
	'本小程序仅收集开展售后维修服务必需信息，绝不超额采集用户隐私：',
	'微信基础信息：微信昵称、微信头像（仅作账号展示，用户可拒绝授权，不影响基础报修功能）；',
	'联系电话：用户在报修/地址中主动填写的手机号（用于沟通维修报价、物流对接；登录本身以微信身份为准）；',
	'用户主动填报业务信息：门店名称、经营地址、牙科设备型号、故障描述、维修工单记录；',
	'系统日志信息：小程序访问时间、页面操作记录，仅用于排查系统卡顿、报错故障。',
	'为实现报修凭证上传与地址填写，本小程序可能在您主动操作时申请相册/摄像头（拍照上传）、扫码与地理位置（地图选址）权限；不会申请身份证、银行卡等无关敏感信息。',
	'二、信息使用用途',
	'核验用户身份，完成小程序账号登录；',
	'与用户实时对接维修方案、上门安排、配件物流、售后回访；',
	'归档维修工单，方便用户随时查询历史维修记录、质保期限；',
	'统计售后业务数据，优化工程师维修流程、提升服务体验。',
	'我方承诺：不会出售、出租、共享用户手机号、诊所经营信息给任何第三方机构，所有信息仅用于本牙科设备售后维修业务。',
	'三、信息存储与留存规则',
	'用户全部数据存储于国内合规云服务器，采用加密机制存储，防止信息泄露、篡改、丢失；',
	'维修工单档案长期留存，用于设备质保追溯；用户申请注销账号后，我方将在 7 个工作日内清除手机号、门店地址等可识别个人信息，仅保留去除身份标识的匿名维修统计数据；',
	'我方不会将用户数据传输至境外服务器。',
	'四、您享有的个人信息权利',
	'查阅权：可在小程序个人中心查看系统留存的本人全部信息；',
	'更正权：可自行修改门店地址、联系电话等填报信息；',
	'删除 / 注销权：联系小程序客服申请账号注销，清除全部个人实名信息；',
	'撤回授权权：可在微信设置中管理对本小程序的授权；取消必要授权可能影响图片上传、扫码或地图选址等功能，登录与基础查询仍可使用。',
	'五、未成年人保护',
	'本小程序服务面向成年口腔机构经营者，不主动收集任何未成年人个人信息，若误收集未成年人信息，核实后将第一时间删除。',
	'六、咨询与反馈渠道',
	'若您对本隐私政策、个人信息处理存在疑问，可通过小程序内在线客服联系我方咨询。',
	'七、政策修订说明',
	'我方会依据法律法规、业务变动更新本隐私政策，更新版本将在小程序登录页面公示，您继续使用小程序服务，即视为同意更新后的隐私政策。',
	'思科达售后服务中心'
])

const DEFAULT_CANCELLATION_POLICY = policyLinesToHtml([
	'一、注销申请方式',
	'用户可通过小程序内在线客服或联系电话提交账号注销申请，并提供可核验的账号联系方式。',
	'二、处理时限',
	'我方核实账号身份与未完结维修事项后，将在 7 个工作日内完成账号注销与个人信息脱敏处理。',
	'三、数据处理规则',
	'注销后，账号手机号、联系地址、微信绑定信息等可识别个人信息将被清除或脱敏；已形成的维修工单、支付、发票、质保和售后记录会按法律法规及业务追溯要求保留必要的匿名化记录。',
	'四、注销影响',
	'账号注销后将无法继续查看历史工单、质保记录或使用该账号提交新的报修申请。如仍有进行中的维修、退款、发票或物流事项，请先完成相关流程后再申请注销。',
	'思科达售后服务中心'
])

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

const resolvePolicyDocumentSetting = async (value) => {
	const document = parsePolicyDocument(value)
	if (!document) return null
	return resolvePolicyDocumentFiles(document, async (fileIds) => {
		const res = await getCloudTempFileURL(fileIds)
		const map = {}
		;(res.fileList || []).forEach(item => {
			if (item && item.fileID) map[item.fileID] = item.tempFileURL
		})
		return map
	}, { timeoutMs: 1500 })
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
	const settings = await getPublicCloudObject().getSettings({ keys: ['warranty_policy', 'warranty_policy_sections', 'warranty_policy_document'] }).then(unwrapCloudResult)
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
	const policyDocument = await resolvePolicyDocumentSetting(settings.warranty_policy_document)
	return { ...settingDoc('保修政策', settings.warranty_policy), sections, policyDocument }
}

export const getFeePolicy = async () => {
	const settings = await getPublicCloudObject().getSettings({ keys: ['fee_description', 'fee_policy', 'fee_policy_document'] }).then(unwrapCloudResult)
	const policyDocument = await resolvePolicyDocumentSetting(settings.fee_policy_document)
	return { ...settingDoc('收费指南', settings.fee_description || settings.fee_policy), policyDocument }
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
		keys: ['wechat_name', 'wechat_desc', 'wechat_qrcode', 'wechat_username']
	}).then(unwrapCloudResult)
	return {
		name: settings.wechat_name,
		description: settings.wechat_desc,
		qrcodeUrl: await resolveCloudUrl(settings.wechat_qrcode),
		username: settings.wechat_username
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
		privacyPolicy: settings.privacy_policy || DEFAULT_PRIVACY_POLICY,
		cancellationPolicy: settings.account_cancellation_policy || DEFAULT_CANCELLATION_POLICY,
		qualifications
	}
}

// 公司介绍「产品矩阵」四张产品图（后台可随时替换；未配置的项返回空，页面用内置静态图兜底）
export const getCompanyProductImages = async () => {
	const settings = await getPublicCloudObject().getSettings({
		keys: [
			'company_product_root_canal_image',
			'company_product_restoration_image',
			'company_product_implant_image',
			'company_product_prevention_image'
		]
	}).then(unwrapCloudResult)

	return {
		rootCanal: await resolveCloudUrl(settings.company_product_root_canal_image),
		restoration: await resolveCloudUrl(settings.company_product_restoration_image),
		implant: await resolveCloudUrl(settings.company_product_implant_image),
		prevention: await resolveCloudUrl(settings.company_product_prevention_image)
	}
}
