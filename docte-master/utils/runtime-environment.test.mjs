import assert from 'node:assert/strict'
import test from 'node:test'

import { disableRuntimeVConsole, isPcWebViewEnvironment } from './runtime-environment.js'

test('PC WebView detection excludes real mobile devices', () => {
	assert.equal(isPcWebViewEnvironment({ platform: 'devtools', deviceType: 'pc' }, {}), true)
	assert.equal(isPcWebViewEnvironment({ platform: 'devtools', deviceType: 'phone', system: 'iOS 19' }, {}), false)
	assert.equal(isPcWebViewEnvironment({ platform: 'windows', deviceType: 'pc' }, {}), true)
	assert.equal(isPcWebViewEnvironment({ platform: 'android', deviceType: 'phone', system: 'Android 15' }, {}), false)
	assert.equal(isPcWebViewEnvironment({ platform: 'ios', deviceType: 'phone', system: 'iOS 19' }, {}), false)
})

test('PC WebView cleanup disables debug and removes injected vConsole UI', () => {
	let debugEnabled = true
	let destroyed = false
	let removed = 0
	const globalObject = {
		wx: {
			setEnableDebug: ({ enableDebug }) => { debugEnabled = enableDebug }
		},
		vConsole: {
			destroy: () => { destroyed = true }
		},
		document: {
			querySelectorAll: () => [{ remove: () => { removed += 1 } }]
		}
	}

	assert.equal(disableRuntimeVConsole({
		production: false,
		systemInfo: { platform: 'devtools', deviceType: 'pc' },
		globalObject
	}), true)
	assert.equal(debugEnabled, false)
	assert.equal(destroyed, true)
	assert.equal(removed, 1)
})

test('mobile test runtime keeps its debugging console', () => {
	let debugCalls = 0
	assert.equal(disableRuntimeVConsole({
		production: false,
		systemInfo: { platform: 'android', deviceType: 'phone' },
		globalObject: {
			wx: { setEnableDebug: () => { debugCalls += 1 } }
		}
	}), false)
	assert.equal(debugCalls, 0)
})
