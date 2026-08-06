const normalizeRuntimeValue = (value) => String(value || '').trim().toLowerCase()

export const getRuntimeSystemInfo = () => {
	try {
		return typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function'
			? (uni.getSystemInfoSync() || {})
			: {}
	} catch (error) {
		return {}
	}
}

export const isPcWebViewEnvironment = (systemInfo = getRuntimeSystemInfo(), globalObject = globalThis) => {
	const platform = normalizeRuntimeValue(systemInfo.platform)
	const deviceType = normalizeRuntimeValue(systemInfo.deviceType)
	const system = normalizeRuntimeValue(systemInfo.system)
	const hostEnvironment = normalizeRuntimeValue(systemInfo.host && systemInfo.host.env)
	const userAgent = normalizeRuntimeValue(globalObject && globalObject.navigator && globalObject.navigator.userAgent)

	if (/devtools/.test(`${platform} ${hostEnvironment}`)) return true
	if (/^(pc|desktop)$/.test(deviceType)) return true
	if (/windows|macos|mac os|linux/.test(`${platform} ${system}`)) return true
	return Boolean(userAgent) && !/android|iphone|ipad|ipod|mobile/.test(userAgent)
}

let cleanupObserver = null
let cleanupTimer = null

const removeVConsoleNodes = (documentObject) => {
	if (!documentObject || typeof documentObject.querySelectorAll !== 'function') return
	documentObject
		.querySelectorAll('#__vconsole, .vc-switch, .vc-mask, .vc-panel')
		.forEach((node) => {
			if (node && typeof node.remove === 'function') node.remove()
		})
}

const stopVConsoleObserver = (globalObject) => {
	if (cleanupObserver && typeof cleanupObserver.disconnect === 'function') cleanupObserver.disconnect()
	cleanupObserver = null
	if (cleanupTimer && globalObject && typeof globalObject.clearTimeout === 'function') {
		globalObject.clearTimeout(cleanupTimer)
	}
	cleanupTimer = null
}

export const disableRuntimeVConsole = (options = {}) => {
	const globalObject = options.globalObject || globalThis
	const systemInfo = options.systemInfo || getRuntimeSystemInfo()
	const production = options.production === undefined
		? Boolean(import.meta.env && import.meta.env.PROD)
		: Boolean(options.production)
	if (!production && !isPcWebViewEnvironment(systemInfo, globalObject)) return false

	const wxApi = options.wxApi || (globalObject && globalObject.wx)
	if (wxApi && typeof wxApi.setEnableDebug === 'function') {
		wxApi.setEnableDebug({ enableDebug: false, fail: () => {} })
	}

	const candidates = [
		globalObject && globalObject.vConsole,
		globalObject && globalObject.__vConsole,
		globalObject && globalObject.__VCONSOLE__
	]
	candidates.forEach((instance) => {
		if (instance && typeof instance.destroy === 'function') {
			try {
				instance.destroy()
			} catch (error) {}
		}
	})

	const documentObject = options.documentObject || (globalObject && globalObject.document)
	removeVConsoleNodes(documentObject)
	stopVConsoleObserver(globalObject)
	if (documentObject && globalObject && typeof globalObject.MutationObserver === 'function') {
		cleanupObserver = new globalObject.MutationObserver(() => removeVConsoleNodes(documentObject))
		cleanupObserver.observe(documentObject.documentElement || documentObject.body, { childList: true, subtree: true })
		if (typeof globalObject.setTimeout === 'function') {
			cleanupTimer = globalObject.setTimeout(() => stopVConsoleObserver(globalObject), 10000)
		}
	}
	return true
}
