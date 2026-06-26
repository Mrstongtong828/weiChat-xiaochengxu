const RETRYABLE_LOGIN_PATTERNS = [
	/网络|超时|timeout|request:fail|服务繁忙|系统繁忙|temporarily|network/i,
	/云服务未连接|云服务未初始化|请求失败/i
]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const stringifyDetail = (detail = {}) => {
	const parts = []
	if (detail.errMsg) parts.push(String(detail.errMsg))
	if (detail.errno !== undefined) parts.push(`errno=${detail.errno}`)
	if (detail.errCode !== undefined) parts.push(`errCode=${detail.errCode}`)
	return parts.join('；')
}

export const normalizePhoneAuthDetail = (detail = {}) => {
	const errMsg = String(detail.errMsg || '').trim()
	const lowerErrMsg = errMsg.toLowerCase()
	const errNo = detail.errno || detail.errCode

	if (!/^getPhoneNumber:ok\b/i.test(errMsg)) {
		const detailText = stringifyDetail(detail)
		const canceled = /cancel|deny|refuse|disagree|用户拒绝|取消/i.test(errMsg) || errNo === 104
		const privacyBlocked = /privacy|agreePrivacyAuthorization|隐私/i.test(errMsg)
		const noPermission = /permission|no auth|not authorized|scope|没有权限|未开通|not support/i.test(errMsg)
		const unavailable = /unavailable|unsupported|not support|版本过低/i.test(errMsg)
		let message = '微信手机号授权未完成，请重试'

		if (privacyBlocked) {
			message = '请先完成微信隐私授权'
		} else if (noPermission) {
			message = '小程序未开通手机号授权能力，请在微信公众平台检查「获取手机号」权限和隐私协议配置'
		} else if (unavailable) {
			message = '当前微信环境暂不支持手机号授权，请升级微信或更换真机重试'
		} else if (errMsg && lowerErrMsg.includes('fail')) {
			message = `手机号授权失败：${detailText}`
		}

		return {
			ok: false,
			canceled,
			privacyBlocked,
			raw: detail,
			message: canceled ? '已取消手机号授权，可重新点击登录' : message
		}
	}

	if (!detail.code) {
		return {
			ok: false,
			canceled: false,
			raw: detail,
			message: `微信未返回手机号授权凭证，请升级微信后重试${stringifyDetail(detail) ? `（${stringifyDetail(detail)}）` : ''}`
		}
	}

	return {
		ok: true,
		phoneCode: detail.code
	}
}

export const getLoginErrorMessage = (error) => {
	const message = String((error && (error.message || error.errMsg || error.msg)) || '登录失败')
	if (/WX_APPID|WX_SECRET|AppID|Secret/i.test(message)) {
		return '登录服务未配置微信小程序 AppID/Secret，请联系管理员检查 uniCloud 环境变量'
	}
	if (/手机号能力|手机号授权|phoneCode|getuserphonenumber|phone number/i.test(message)) {
		return message
	}
	if (/40029|40163|凭证|code/i.test(message)) {
		return '授权凭证已失效，请重新点击微信手机号授权登录'
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

export const loginWithWechatPhoneCode = async (wechatLogin, phoneCode, options = {}) => {
	const retries = Number.isInteger(options.retries) ? options.retries : 1
	let lastError = null

	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			const code = await requestWechatLoginCode()
			return await wechatLogin({ code, phoneCode })
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

	throw lastError || new Error('登录失败，请重试')
}

export const loginWithWechatOpenid = async (wechatLogin, options = {}) => {
	const retries = Number.isInteger(options.retries) ? options.retries : 1
	let lastError = null

	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			const code = await requestWechatLoginCode()
			return await wechatLogin({ code, phoneCode: '' })
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
