const RETRYABLE_LOGIN_PATTERNS = [
	/网络|超时|timeout|request:fail|服务繁忙|系统繁忙|temporarily|network/i,
	/云服务未连接|云服务未初始化|请求失败/i
]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const getLoginErrorMessage = (error) => {
	const message = String((error && (error.message || error.errMsg || error.msg)) || '登录失败')
	if (/WX_APPID|WX_SECRET|AppID|Secret/i.test(message)) {
		return '登录服务未配置微信小程序 AppID/Secret，请联系管理员检查 uniCloud 环境变量'
	}
	if (/40029|40163|凭证|code/i.test(message)) {
		return '微信登录凭证已失效，请重新点击登录'
	}
	if (/access_token|40001|42001/i.test(message)) {
		return '微信接口凭证失效，请稍后重试；若持续失败请联系管理员检查小程序后台配置'
	}
	return message
}

export const isRetryableLoginError = (error) => {
	const message = String((error && (error.message || error.errMsg || error.msg)) || '')
	return RETRYABLE_LOGIN_PATTERNS.some((pattern) => pattern.test(message))
}

export const requestWechatLoginCode = async () => {
	const loginRes = await uni.login({ provider: 'weixin' })
	if (!loginRes || !loginRes.code) {
		throw new Error('获取微信登录凭证失败，请检查网络后重试')
	}
	return loginRes.code
}

export const loginWithWechatOpenid = async (wechatLogin, options = {}) => {
	const retries = Number.isInteger(options.retries) ? options.retries : 1
	let lastError = null

	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			const code = await requestWechatLoginCode()
			return await wechatLogin({ code })
		} catch (error) {
			lastError = error
			if (attempt < retries && isRetryableLoginError(error)) {
				if (typeof options.onRetry === 'function') options.onRetry(error, attempt + 1)
				await wait(600)
				continue
			}
			throw error
		}
	}

	throw lastError || new Error('微信身份登录失败，请重试')
}
