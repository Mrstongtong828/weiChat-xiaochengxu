const INTERNAL_ERROR_PATTERN = /token|openid|appid|secret|unicloud|云函数|云对象|云服务|数据库|\bdatabase\b|mysql|mongodb|postgres|sqlite|接口|服务端|鉴权|权限|环境变量|wx_appid|wx_secret|access_token|cloud:\/\/|econnrefused|econnreset|internal server|bad gateway|service unavailable|cannot\s|undefined|null\s+is|stack| at\s+\/?[\w.\\/-]+:\d+/i
const AUTH_ERROR_PATTERN = /token|鉴权|unauthorized|登录已过期|请重新登录|401/i
const NETWORK_ERROR_PATTERN = /网络|超时|timeout|request:fail|network|temporarily|服务繁忙|系统繁忙|eai_again|enotfound|连接被拒绝|连接失败/i
const TECHNICAL_CODE_PATTERN = /\b(?:4\d{2}|5\d{2})\b|\b(?:ECONN|ETIMEDOUT|ERR_|SQL|ENOENT|ENOTFOUND)/i

export const toCustomerErrorMessage = (error, fallback = '操作失败，请稍后重试') => {
	const raw = String((error && (error.message || error.errMsg || error.msg)) || error || '').trim()
	if (!raw) return fallback
	if (AUTH_ERROR_PATTERN.test(raw)) return '登录状态已失效，请重新登录'
	if (NETWORK_ERROR_PATTERN.test(raw)) return '网络连接不稳定，请稍后重试'
	if (INTERNAL_ERROR_PATTERN.test(raw) || TECHNICAL_CODE_PATTERN.test(raw)) return '服务暂时不可用，请稍后重试或联系客服'
	if (raw.length > 120) return fallback
	return raw
}
