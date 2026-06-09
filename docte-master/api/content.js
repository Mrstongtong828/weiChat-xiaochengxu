let publicCloudObject = null
let userCloudObject = null
let orderCloudObject = null

const getPublicCloudObject = () => {
	if (!publicCloudObject) publicCloudObject = uniCloud.importObject('cicada-client-public')
	return publicCloudObject
}

const getUserCloudObject = () => {
	if (!userCloudObject) userCloudObject = uniCloud.importObject('cicada-client-user')
	return userCloudObject
}

const getOrderCloudObject = () => {
	if (!orderCloudObject) orderCloudObject = uniCloud.importObject('cicada-client-order')
	return orderCloudObject
}

const unwrapCloudResult = (result = {}) => {
	if (result.code === 0 || result.code === undefined) return result.data === undefined ? result : result.data
	throw new Error(result.message || result.msg || '请求失败')
}

const withToken = (params = {}) => ({
	...params,
	token: uni.getStorageSync('token') || ''
})

const settingDoc = (title, content = '') => ({
	title,
	content: String(content || '').replace(/\n/g, '<br/>')
})

const getFileExt = (filePath = '', fallback = 'jpg') => {
	const cleanPath = String(filePath || '').split('?')[0]
	const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/)
	return (match ? match[1] : fallback).toLowerCase()
}

const uploadToCloud = (filePath, dir = 'uploads', fallbackExt = 'jpg') => new Promise((resolve, reject) => {
	const ext = getFileExt(filePath, fallbackExt)
	uniCloud.uploadFile({
		filePath,
		cloudPath: `${dir}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`,
		success: (res) => resolve({ url: res.fileID, fileID: res.fileID }),
		fail: reject
	})
})

const normalizeAddress = (data = {}) => ({
	_id: data.addressId || data._id,
	name: data.name || '',
	phone: data.phone || '',
	region: data.region || [data.province, data.city, data.district].filter(Boolean).join('/'),
	detail: data.detail || '',
	unit: data.unit || '',
	is_default: data.isDefault === 1 || data.isDefault === true || data.is_default === true
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

export const wechatLogin = (data = {}) => getUserCloudObject().login(data).then(unwrapCloudResult)

export const devLogin = () => getUserCloudObject().devLogin({}).then(unwrapCloudResult)

export const logout = () => Promise.resolve()

export const getUserInfo = () => Promise.resolve(uni.getStorageSync('userInfo') || {})

export const uploadImage = (filePath) => uploadToCloud(filePath, 'repair/images', 'jpg')

export const uploadVideo = (filePath) => uploadToCloud(filePath, 'repair/videos', 'mp4')

export const getWarrantyPolicy = async () => {
	const settings = await getPublicCloudObject().getSettings({ keys: ['warranty_policy'] }).then(unwrapCloudResult)
	return settingDoc('保修政策', settings.warranty_policy)
}

export const getFeePolicy = async () => {
	const settings = await getPublicCloudObject().getSettings({ keys: ['fee_description', 'fee_policy'] }).then(unwrapCloudResult)
	return settingDoc('收费指南', settings.fee_description || settings.fee_policy)
}

export const getGuide = (type) => getPublicCloudObject().getGuide({ type }).then(unwrapCloudResult)

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
		qrcodeUrl: settings.customer_service_qrcode
	}
}

export const getWechat = async () => {
	const settings = await getPublicCloudObject().getSettings({
		keys: ['wechat_name', 'wechat_desc', 'wechat_qrcode']
	}).then(unwrapCloudResult)
	return {
		name: settings.wechat_name,
		description: settings.wechat_desc,
		qrcodeUrl: settings.wechat_qrcode
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

export const getInvoiceList = () => Promise.resolve({ list: [] })

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

export const addAddress = (data) => getUserCloudObject()
	.manageAddress(withToken({ action: 'add', address: normalizeAddress(data) }))
	.then(unwrapCloudResult)

export const updateAddress = (data) => getUserCloudObject()
	.manageAddress(withToken({ action: 'edit', address: normalizeAddress(data) }))
	.then(unwrapCloudResult)

export const deleteAddress = (addressId) => getUserCloudObject()
	.manageAddress(withToken({ action: 'delete', address: { _id: addressId } }))
	.then(unwrapCloudResult)

export const addComplaint = (data = {}) => getUserCloudObject()
	.submitFeedback(withToken({
		type: data.type === 0 ? '投诉' : data.type === 1 ? '建议' : data.type,
		content: data.content,
		images: data.images || [],
		contact_type: data.contactType || data.contact_type || '',
		contact_value: data.contact || data.contactValue || data.contact_value || '',
		rel_order_no: data.orderId || data.rel_order_no || ''
	}))
	.then(unwrapCloudResult)

export const getComplaintList = (data = {}) => getUserCloudObject()
	.getComplaintList(withToken({ page: data.page || 1, pageSize: data.pageSize || data.size || 10 }))
	.then(unwrapCloudResult)

export const getProductCategories = () => getPublicCloudObject().getCategories({}).then(unwrapCloudResult)
