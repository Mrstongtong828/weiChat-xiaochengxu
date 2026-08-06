import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
	createPcLoginGuard,
	isLoginRateLimitError,
	PC_LOGIN_RATE_LIMIT_SECONDS
} from './pc-login-guard.js'

test('login rate-limit errors are classified separately', () => {
	assert.equal(isLoginRateLimitError(new Error('操作过于频繁，请稍后再试')), true)
	assert.equal(isLoginRateLimitError({ errMsg: 'rate limit exceeded' }), true)
	assert.equal(isLoginRateLimitError(new Error('网络连接失败')), false)
})

test('PC guard blocks duplicate clicks and retries once after rate-limit countdown', () => {
	let clock = 1000
	let tick = null
	let retryCalls = 0
	const countdowns = []
	const lockStates = []
	const guard = createPcLoginGuard({
		enabled: true,
		now: () => clock,
		setIntervalFn: (callback) => {
			tick = callback
			return 1
		},
		clearIntervalFn: () => {},
		onLockChange: (locked) => lockStates.push(locked),
		onCountdown: (seconds) => countdowns.push(seconds)
	})

	assert.equal(guard.beginAttempt(), true)
	assert.equal(lockStates.at(-1), true)
	assert.equal(countdowns.at(-1), 0)
	assert.equal(guard.beginAttempt(), false)
	assert.equal(guard.handleRateLimit(new Error('操作过于频繁，请稍后再试'), () => { retryCalls += 1 }), true)
	assert.equal(countdowns.at(-1), PC_LOGIN_RATE_LIMIT_SECONDS)
	clock += PC_LOGIN_RATE_LIMIT_SECONDS * 1000
	tick()
	assert.equal(retryCalls, 1)
	assert.equal(lockStates.at(-1), false)
	assert.equal(guard.beginAttempt({ automatic: true }), true)
	assert.equal(guard.handleRateLimit(new Error('操作过于频繁，请稍后再试'), () => { retryCalls += 1 }), true)
	assert.equal(countdowns.at(-1), 0)
	assert.equal(lockStates.at(-1), false)
	assert.equal(retryCalls, 1)
})

test('mobile guard keeps the existing unrestricted click path', () => {
	const guard = createPcLoginGuard({ enabled: false })
	assert.equal(guard.beginAttempt(), true)
	assert.equal(guard.beginAttempt(), true)
	assert.equal(guard.handleRateLimit(new Error('操作过于频繁，请稍后再试')), false)
})

test('PC login requests use a stable client bucket behind a shared network limit', () => {
	const apiSource = readFileSync(new URL('../api/user.js', import.meta.url), 'utf8')
	const cloudSource = readFileSync(new URL('../uniCloud-alipay/cloudfunctions/cicada-client-user/index.obj.js', import.meta.url), 'utf8')

	assert.match(apiSource, /const PC_LOGIN_CLIENT_ID_KEY = 'cicada_pc_login_client_id'/)
	assert.match(apiSource, /cloudObject\.login\(\{ code, \.\.\.\(clientId \? \{ clientId \} : \{\}\) \}\)/)
	assert.match(cloudSource, /login_network: \{ windowMs: 60 \* 1000, max: 120 \}/)
	assert.match(cloudSource, /getLoginRateLimitIdentity\(this, clientId\)/)
})
