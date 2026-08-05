import { unwrapCloudResult } from './cloudHelpers.js'
import { importCloudObject } from '@/utils/cloud.js'
import request from '@/utils/request.js'

const viteEnv = import.meta.env || {}
const processEnv = typeof process !== 'undefined' && process.env ? process.env : {}
const loginEndpoint =
	viteEnv.VITE_CICADA_CLIENT_USER_URL ||
	processEnv.VITE_CICADA_CLIENT_USER_URL ||
	'/cloud/cicada-client-user/login'
const LOGIN_CONFIG_MESSAGE = '管理员正在配置登录密钥，请稍后尝试'
const LOGIN_CONFIG_PATTERN = /WX_APPID|WX_SECRET|WECHAT_APPID|WECHAT_SECRET|小程序密钥|登录密钥|服务未部署|云端登录方法未部署|云对象.*(?:未部署|不存在)|cicada-client-user.*(?:未部署|不存在)|method.*(?:not found|not deployed)|function.*not found/i

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

const loginWithHttp = (code) => request({
	url: loginEndpoint,
	method: 'POST',
	data: { code },
	auth: false,
	timeout: 30000
}).then(unwrapCloudResult)

export const wechatLogin = async (params = {}) => {
	const code = String((typeof params === 'string' ? params : params.code) || '').trim()
	if (!code) throw new Error('获取微信登录凭证失败，请重试')

	try {
		const cloudObject = getUserCloudObject()
		if (cloudObject && typeof cloudObject.login === 'function') {
			return await cloudObject.login({ code }).then(unwrapCloudResult)
		}
		return await loginWithHttp(code)
	} catch (error) {
		throw normalizeLoginError(error)
	}
}

export const login = wechatLogin
