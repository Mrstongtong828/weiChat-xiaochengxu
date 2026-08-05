import { toCustomerErrorMessage } from './customer-error.js'

const LOGIN_REQUEST_TIMEOUT_MS = 30000
const LOGIN_CANCEL_PATTERNS = /cancel|canceled|cancelled|auth deny|authorize deny|user deny|user reject|用户取消|拒绝授权/i
const LOGIN_TIMEOUT_PATTERNS = /超时|timeout|timed out|etimedout/i
const LOGIN_TRANSPORT_PATTERNS = /request:fail|network|eai_again|enotfound|econnrefused|econnreset|连接失败|连接被拒绝/i
const RETRYABLE_LOGIN_PATTERNS = [
	LOGIN_TIMEOUT_PATTERNS,
	LOGIN_TRANSPORT_PATTERNS,
	/服务繁忙|系统繁忙|temporarily|service unavailable/i,
	/云服务未连接|云服务未初始化|请求失败/i
]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const errorMessage = (error, fallback = '') => String((error && (error.message || error.errMsg || error.msg)) || fallback)

const createLoginError = (code, message, cause = null) => {
	const error = new Error(message)
	error.code = code
	if (cause) error.cause = cause
	return error
}

const getNetworkType = () => new Promise((resolve) => {
	if (typeof uni === 'undefined' || typeof uni.getNetworkType !== 'function') {
		resolve('')
		return
	}
	uni.getNetworkType({
		success: (result = {}) => resolve(String(result.networkType || '').toLowerCase()),
		fail: () => resolve('')
	})
})

const markOfflineWhenDisconnected = async (error) => {
	if (isLoginCancelledError(error)) return error
	if (await getNetworkType() === 'none') {
		return createLoginError('LOGIN_NETWORK_OFFLINE', '当前网络不可用，请检查网络后重试', error)
	}
	return error
}

const ensureNetworkAvailable = async () => {
	if (await getNetworkType() === 'none') {
		throw createLoginError('LOGIN_NETWORK_OFFLINE', '当前网络不可用，请检查网络后重试')
	}
}

const withLoginTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
	let settled = false
	const timer = setTimeout(() => {
		if (settled) return
		settled = true
		reject(createLoginError('LOGIN_REQUEST_TIMEOUT', '登录服务响应超时，请稍后重试'))
	}, timeoutMs)

	Promise.resolve(promise).then(
		(result) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			resolve(result)
		},
		(error) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			reject(error)
		}
	)
})

export const isLoginCancelledError = (error) => {
	if (error && error.code === 'LOGIN_CANCELLED') return true
	return LOGIN_CANCEL_PATTERNS.test(errorMessage(error))
}

export const getLoginErrorMessage = (error) => {
	if (isLoginCancelledError(error)) return ''
	if (error && error.code === 'LOGIN_NETWORK_OFFLINE') return '网络连接不稳定，请稍后重试'
	if (error && error.code === 'LOGIN_REQUEST_TIMEOUT') return '登录服务响应超时，请稍后重试'

	const message = errorMessage(error, '登录失败')
	if (LOGIN_TIMEOUT_PATTERNS.test(message)) return '登录服务响应超时，请稍后重试'
	if (/WX_APPID|WX_SECRET|AppID|Secret/i.test(message)) {
		return '登录服务暂时不可用，请稍后重试或联系客服'
	}
	if (/40029|40163|凭证|code/i.test(message)) {
		return '微信登录凭证已失效，请重新点击登录'
	}
	if (/access_token|40001|42001/i.test(message)) {
		return '登录服务暂时不可用，请稍后重试或联系客服'
	}
	if (LOGIN_TRANSPORT_PATTERNS.test(message)) {
		return '登录服务暂时不可用，请稍后重试'
	}
	return toCustomerErrorMessage(error, message)
}

export const isRetryableLoginError = (error) => {
	if (isLoginCancelledError(error)) return false
	if (error && error.code === 'LOGIN_NETWORK_OFFLINE') return false
	if (error && error.code === 'LOGIN_REQUEST_TIMEOUT') return true
	const message = errorMessage(error)
	return RETRYABLE_LOGIN_PATTERNS.some((pattern) => pattern.test(message))
}

export const requestWechatLoginCode = async () => {
	await ensureNetworkAvailable()
	let loginRes
	try {
		loginRes = await uni.login({ provider: 'weixin' })
	} catch (error) {
		if (isLoginCancelledError(error)) {
			throw createLoginError('LOGIN_CANCELLED', '用户取消微信授权', error)
		}
		throw await markOfflineWhenDisconnected(error)
	}
	if (!loginRes || !loginRes.code) {
		throw new Error('获取微信登录凭证失败，请重试')
	}
	return loginRes.code
}

export const loginWithWechatOpenid = async (wechatLogin, options = {}) => {
	const retries = Number.isInteger(options.retries) ? options.retries : 1
	const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
		? options.timeoutMs
		: LOGIN_REQUEST_TIMEOUT_MS
	let lastError = null

	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			const code = await requestWechatLoginCode()
			return await withLoginTimeout(wechatLogin({ code }), timeoutMs)
		} catch (error) {
			const classifiedError = await markOfflineWhenDisconnected(error)
			lastError = classifiedError
			if (isLoginCancelledError(classifiedError)) throw classifiedError
			if (attempt < retries && isRetryableLoginError(classifiedError)) {
				if (typeof options.onRetry === 'function') options.onRetry(classifiedError, attempt + 1)
				await wait(600)
				continue
			}
			throw classifiedError
		}
	}

	throw lastError || new Error('微信身份登录失败，请重试')
}
