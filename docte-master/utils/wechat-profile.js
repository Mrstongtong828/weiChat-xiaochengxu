const DEFAULT_NAME_PATTERNS = [
	/^用户\d{4}$/,
	/^微信用户$/,
	/^微信体验用户$/,
	/^已登录用户$/,
	/^开发测试用户$/
]

const normalizeText = (value) => String(value || '').trim()

export const normalizeWechatProfile = (profile = {}) => {
	const source = profile.userInfo || profile
	return {
		nickname: normalizeText(source.nickName || source.nickname || source.name),
		avatar: normalizeText(source.avatarUrl || source.avatar)
	}
}

export const needsWechatProfileSync = (userInfo = {}) => {
	const nickname = normalizeText(userInfo.nickname || userInfo.name)
	const avatar = normalizeText(userInfo.avatar || userInfo.avatarUrl)
	return !avatar || !nickname || DEFAULT_NAME_PATTERNS.some(pattern => pattern.test(nickname))
}
