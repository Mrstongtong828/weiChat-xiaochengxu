const PRIVACY_STORAGE_KEY = 'privacy_consented'

let privacyReadyCache = null

const isWechatMiniProgram = () => typeof wx !== 'undefined'

export const markWechatPrivacyReady = () => {
	privacyReadyCache = true
	uni.setStorageSync(PRIVACY_STORAGE_KEY, '1')
	if (typeof uni.$emit === 'function') {
		uni.$emit('wechatPrivacyReady')
	}
}

export const resetWechatPrivacyReady = () => {
	privacyReadyCache = false
	uni.removeStorageSync(PRIVACY_STORAGE_KEY)
	if (typeof uni.$emit === 'function') {
		uni.$emit('wechatPrivacyNeedAuthorization')
	}
}

export const isWechatPrivacyReady = () => {
	if (privacyReadyCache === true) return true
	return Boolean(uni.getStorageSync(PRIVACY_STORAGE_KEY))
}

export const getWechatPrivacyReady = () => new Promise((resolve) => {
	// #ifdef MP-WEIXIN
	if (!isWechatMiniProgram() || typeof wx.getPrivacySetting !== 'function') {
		resetWechatPrivacyReady()
		resolve(false)
		return
	}

	wx.getPrivacySetting({
		success: (res = {}) => {
			const ready = res.needAuthorization === false
			if (ready) markWechatPrivacyReady()
			else resetWechatPrivacyReady()
			resolve(ready)
		},
		fail: () => {
			resetWechatPrivacyReady()
			resolve(false)
		}
	})
	// #endif

	// #ifndef MP-WEIXIN
	resolve(true)
	// #endif
})

export const setupWechatPrivacyAuthorization = (showDialog) => {
	// #ifdef MP-WEIXIN
	if (!isWechatMiniProgram() || typeof wx.onNeedPrivacyAuthorization !== 'function') return
	wx.onNeedPrivacyAuthorization((resolve) => {
		if (typeof showDialog === 'function') {
			showDialog(resolve)
			return
		}
		resolve({ event: 'agree' })
		markWechatPrivacyReady()
	})
	// #endif
}

export const requestWechatPrivacyAuthorization = () => new Promise((resolve, reject) => {
	// #ifdef MP-WEIXIN
	if (!isWechatMiniProgram() || typeof wx.requirePrivacyAuthorize !== 'function') {
		getWechatPrivacyReady().then(resolve).catch(reject)
		return
	}

	wx.requirePrivacyAuthorize({
		success: () => {
			markWechatPrivacyReady()
			resolve(true)
		},
		fail: (error) => {
			privacyReadyCache = false
			reject(error)
		}
	})
	// #endif

	// #ifndef MP-WEIXIN
	resolve(true)
	// #endif
})

export { PRIVACY_STORAGE_KEY }
