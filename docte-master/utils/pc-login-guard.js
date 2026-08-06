export const PC_LOGIN_CLICK_LOCK_MS = 2000
export const PC_LOGIN_RATE_LIMIT_SECONDS = 15

const getLoginErrorText = (error) => String(
	(error && (error.message || error.msg || error.errMsg)) || error || ''
)

export const isLoginRateLimitError = (error) => (
	/操作过于频繁|请求过于频繁|调用过于频繁|too many requests|rate limit|45011/i.test(getLoginErrorText(error))
)

export const createPcLoginGuard = (options = {}) => {
	const enabled = Boolean(options.enabled)
	const now = options.now || Date.now
	const setIntervalFn = options.setIntervalFn || setInterval
	const clearIntervalFn = options.clearIntervalFn || clearInterval
	const onCountdown = options.onCountdown || (() => {})
	const onLockChange = options.onLockChange || (() => {})
	const clickLockMs = Number(options.clickLockMs) || PC_LOGIN_CLICK_LOCK_MS
	const rateLimitMs = (Number(options.rateLimitSeconds) || PC_LOGIN_RATE_LIMIT_SECONDS) * 1000
	let deadline = 0
	let timer = null
	let locked = false
	let automaticRetryUsed = false

	const setLocked = (value) => {
		const nextValue = Boolean(value)
		if (locked === nextValue) return
		locked = nextValue
		onLockChange(locked)
	}

	const stopTimer = () => {
		if (timer !== null) clearIntervalFn(timer)
		timer = null
	}

	const getRemainingSeconds = () => {
		return Math.max(0, Math.ceil((deadline - now()) / 1000))
	}

	const updateCountdown = () => {
		const seconds = getRemainingSeconds()
		onCountdown(seconds)
		return seconds
	}

	const startCountdown = (durationMs, onComplete, { visible = true } = {}) => {
		stopTimer()
		deadline = now() + durationMs
		setLocked(true)
		if (visible) updateCountdown()
		else onCountdown(0)
		timer = setIntervalFn(() => {
			const seconds = visible ? updateCountdown() : getRemainingSeconds()
			if (seconds > 0) return
			stopTimer()
			setLocked(false)
			if (typeof onComplete === 'function') onComplete()
		}, 250)
	}

	const beginAttempt = ({ automatic = false } = {}) => {
		if (!enabled) return true
		if (deadline > now()) return false
		if (!automatic) automaticRetryUsed = false
		startCountdown(clickLockMs, null, { visible: false })
		return true
	}

	const handleRateLimit = (error, retry) => {
		if (!enabled || !isLoginRateLimitError(error)) return false
		const shouldRetry = !automaticRetryUsed && typeof retry === 'function'
		automaticRetryUsed = true
		if (!shouldRetry) {
			clear()
			return true
		}
		startCountdown(rateLimitMs, retry)
		return true
	}

	const clear = () => {
		deadline = 0
		stopTimer()
		setLocked(false)
		onCountdown(0)
	}

	return {
		beginAttempt,
		clear,
		dispose: clear,
		handleRateLimit,
		isEnabled: () => enabled
	}
}
