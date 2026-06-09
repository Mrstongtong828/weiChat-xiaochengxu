let userCloudObject = null
let publicCloudObject = null

const getUserCloudObject = () => {
	if (!userCloudObject) userCloudObject = uniCloud.importObject('cicada-client-user')
	return userCloudObject
}

const getPublicCloudObject = () => {
	if (!publicCloudObject) publicCloudObject = uniCloud.importObject('cicada-client-public')
	return publicCloudObject
}

const withToken = (params = {}) => ({
	...params,
	token: uni.getStorageSync('token') || ''
})

const unwrapCloudResult = (result = {}) => {
	if (result.code === 0 || result.code === undefined) return result.data === undefined ? result : result.data
	throw new Error(result.message || result.msg || '请求失败')
}

const normalizePageParams = ({ page = 1, pageSize, size } = {}) => ({
	page,
	pageSize: pageSize || size || 10
})

const normalizeDevice = (data = {}) => ({
	_id: data._id || data.id || data.deviceId || data.productId || '',
	product_name: data.product_name || data.productName || data.name || data.title || data.model || '',
	sn: data.sn || data.serial || data.productSerial || '',
	buy_date: data.buy_date || data.buyDate || data.purchaseDate || '',
	warranty_status: data.warranty_status || data.warrantyStatus || data.warranty || ''
})

const normalizeProduct = (item = {}) => ({
	...item,
	id: item._id || item.id,
	productId: item._id || item.id,
	productName: item.product_name || item.productName || '',
	name: item.product_name || item.name || item.productName || '',
	title: item.product_name || item.title || item.productName || '',
	sn: item.sn || '',
	productSerial: item.sn || item.productSerial || '',
	buyDate: item.buy_date || item.buyDate || '',
	warrantyStatus: item.warranty_status || item.warrantyStatus || ''
})

const normalizeCategory = (item = {}) => ({
	...item,
	id: item._id || item.id,
	name: item.category_name || item.name || item.title || '',
	title: item.category_name || item.title || item.name || '',
	status: item.status,
	sort: item.sort || 0
})

/**
 * 获取用户设备列表
 * @param {object} params 查询参数 { page, pageSize }
 * @returns {Promise<{list: array, total: number}>}
 */
export const getProductList = async (params = {}) => {
	const pagination = normalizePageParams(params)
	const list = await getUserCloudObject()
		.manageDevice(withToken({ action: 'list' }))
		.then(unwrapCloudResult)
	const normalized = Array.isArray(list) ? list.map(normalizeProduct) : []
	const start = (Math.max(Number(pagination.page) || 1, 1) - 1) * pagination.pageSize
	return {
		list: normalized.slice(start, start + pagination.pageSize),
		total: normalized.length,
		page: pagination.page,
		pageSize: pagination.pageSize
	}
}

/**
 * 获取用户设备详情
 * @param {string} id 设备ID
 * @returns {Promise<object>}
 */
export const getProductDetail = async (id) => {
	const data = await getProductList({ page: 1, pageSize: 1000 })
	return data.list.find(item => item.id === id || item.productId === id) || null
}

/**
 * 添加用户设备
 * @param {object} data 设备数据
 * @returns {Promise<{id: string}>}
 */
export const addProduct = (data) => getUserCloudObject()
	.manageDevice(withToken({ action: 'add', device: normalizeDevice(data) }))
	.then(unwrapCloudResult)

/**
 * 更新用户设备
 * @param {string} id 设备ID
 * @param {object} data 设备数据
 * @returns {Promise}
 */
export const updateProduct = (id, data) => getUserCloudObject()
	.manageDevice(withToken({ action: 'edit', device: normalizeDevice({ ...data, _id: id }) }))
	.then(unwrapCloudResult)

/**
 * 删除用户设备
 * @param {string} id 设备ID
 * @returns {Promise}
 */
export const deleteProduct = (id) => getUserCloudObject()
	.manageDevice(withToken({ action: 'delete', device: { _id: id } }))
	.then(unwrapCloudResult)

/**
 * 获取产品分类
 * @returns {Promise<array>}
 */
export const getProductCategories = async () => {
	const list = await getPublicCloudObject().getCategories({}).then(unwrapCloudResult)
	return Array.isArray(list) ? list.map(normalizeCategory) : []
}
