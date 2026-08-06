import { unwrapCloudResult } from './cloudHelpers.js'
import { importCloudObject } from '@/utils/cloud.js'
import request from '@/utils/request.js'
import { isPcWebViewEnvironment } from '@/utils/runtime-environment.js'

const viteEnv = import.meta.env || {}
const processEnv = typeof process !== 'undefined' && process.env ? process.env : {}
const loginEndpoint =
	viteEnv.VITE_CICADA_CLIENT_USER_URL ||
	processEnv.VITE_CICADA_CLIENT_USER_URL ||
	'/cloud/cicada-client-user/login'
const LOGIN_CONFIG_MESSAGE = '管理员正在配置登录密钥，请稍后尝试'
const LOGIN_CONFIG_PATTERN = /WX_APPID|WX_SECRET|WECHAT_APPID|WECHAT_SECRET|小程序密钥|登录密钥|服务未部署|云端登录方法未部署|云对象.*(?:未部署|不存在)|cicada-client-user.*(?:未部署|不存在)|method.*(?:not found|not deployed)|function.*not found/i
const PC_LOGIN_CLIENT_ID_KEY = 'cicada_pc_login_client_id'

let userCloudObject = null

const getUserCloudObject = () => {
	if (!userCloudObject) {
		const next = importCloudObject('cicada-client-user')
		if (next) userCloudObject = next
	}
	return userCloudObject
}

const normalizeLoginError = (error) => {
	const message = String((error && (error.message || error.msg || error.errMsg)) || '')
	if (Number(error && error.statusCode) === 404 || LOGIN_CONFIG_PATTERN.test(message)) {
		const configError = new Error(LOGIN_CONFIG_MESSAGE)
		configError.code = 'LOGIN_SERVICE_CONFIGURING'
		configError.cause = error
		return configError
	}
	if (error instanceof Error) return error
	const normalized = new Error(message || '微信登录失败，请稍后重试')
	if (error && error.code !== undefined) normalized.code = error.code
	return normalized
}

const createLoginClientId = () => [
	Date.now().toString(36),
	Math.random().toString(36).slice(2),
	Math.random().toString(36).slice(2)
].join('-')

export const getPcLoginClientId = () => {
	if (!isPcWebViewEnvironment()) return ''
	try {
		const saved = String(uni.getStorageSync(PC_LOGIN_CLIENT_ID_KEY) || '').trim()
		if (saved) return saved
		const clientId = createLoginClientId()
		uni.setStorageSync(PC_LOGIN_CLIENT_ID_KEY, clientId)
		return clientId
	} catch (error) {
		return createLoginClientId()
	}
}

const loginWithHttp = (code, clientId) => request({
	url: loginEndpoint,
	method: 'POST',
	data: { code, ...(clientId ? { clientId } : {}) },
	auth: false,
	timeout: 30000
}).then(unwrapCloudResult)

export const wechatLogin = async (params = {}) => {
	const code = String((typeof params === 'string' ? params : params.code) || '').trim()
	const clientId = String((typeof params === 'object' && params.clientId) || getPcLoginClientId()).trim()
	if (!code) throw new Error('获取微信登录凭证失败，请重试')

	try {
		const cloudObject = getUserCloudObject()
		if (cloudObject && typeof cloudObject.login === 'function') {
			return await cloudObject.login({ code, ...(clientId ? { clientId } : {}) }).then(unwrapCloudResult)
		}
		return await loginWithHttp(code, clientId)
	} catch (error) {
		throw normalizeLoginError(error)
	}
}

export const login = wechatLogin
