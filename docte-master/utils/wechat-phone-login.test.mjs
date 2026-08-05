import assert from 'node:assert/strict'
import test from 'node:test'

import {
	getLoginErrorMessage,
	isLoginCancelledError,
	loginWithWechatOpenid
} from './wechat-phone-login.js'

const withUni = async (mock, callback) => {
	const original = globalThis.uni
	globalThis.uni = mock
	try {
		return await callback()
	} finally {
		globalThis.uni = original
	}
}

test('login cancellation stays silent while offline and timeout errors stay distinct', () => {
	assert.equal(isLoginCancelledError({ errMsg: 'authorize:fail cancel' }), true)
	assert.equal(getLoginErrorMessage({ errMsg: 'authorize:fail cancel' }), '')
	assert.equal(
		getLoginErrorMessage({ code: 'LOGIN_NETWORK_OFFLINE', message: 'offline' }),
		'网络连接不稳定，请稍后重试'
	)
	assert.equal(
		getLoginErrorMessage({ code: 'LOGIN_REQUEST_TIMEOUT', message: 'timeout' }),
		'登录服务响应超时，请稍后重试'
	)
	assert.equal(
		getLoginErrorMessage({ errMsg: 'request:fail connection reset' }),
		'登录服务暂时不可用，请稍后重试'
	)
})

test('offline login stops before requesting a WeChat code and shows only one final error', async () => {
	let loginCalls = 0
	await withUni({
		getNetworkType: ({ success }) => success({ networkType: 'none' }),
		login: async () => {
			loginCalls += 1
			return { code: 'unexpected' }
		}
	}, async () => {
		await assert.rejects(
			loginWithWechatOpenid(async () => ({ token: 'unexpected' }), { retries: 1 }),
			(error) => error.code === 'LOGIN_NETWORK_OFFLINE'
		)
	})
	assert.equal(loginCalls, 0)
})

test('retryable transport errors request a fresh WeChat code before retrying', async () => {
	let codeCalls = 0
	let loginCalls = 0
	let retryCalls = 0
	await withUni({
		getNetworkType: ({ success }) => success({ networkType: 'wifi' }),
		login: async () => ({ code: `code-${++codeCalls}` })
	}, async () => {
		const result = await loginWithWechatOpenid(async ({ code }) => {
			loginCalls += 1
			if (loginCalls === 1) throw { errMsg: 'request:fail connection reset' }
			return { token: code }
		}, {
			retries: 1,
			onRetry: () => { retryCalls += 1 }
		})

		assert.equal(result.token, 'code-2')
	})
	assert.equal(codeCalls, 2)
	assert.equal(loginCalls, 2)
	assert.equal(retryCalls, 1)
})
