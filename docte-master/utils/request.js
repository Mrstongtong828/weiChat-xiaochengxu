const viteEnv = import.meta.env || {}
const processEnv = typeof process !== 'undefined' && process.env ? process.env : {}
const envBaseURL =
	viteEnv.VITE_API_BASE_URL ||
	viteEnv.VUE_APP_BASE_API ||
	processEnv.VUE_APP_BASE_API ||
	processEnv.VITE_API_BASE_URL

// 线上生产环境 API 地址（.env.example 中配置的正式域名）
const FALLBACK_BASE_URL = 'https://api.cisco-d.com/api/v1'

export const baseURL = (envBaseURL || FALLBACK_BASE_URL).replace(/\/$/, '')

const isAbsoluteUrl = (url = '') => /^https?:\/\//i.test(url)

export default function request(options = {}) {
	const { url = '', method = 'GET', data = {}, header = {}, timeout = 8000 } = options
	const token = uni.getStorageSync('token')
	const requestHeader = { ...header }

	if (token) {
		requestHeader.Authorization = `Bearer ${token}`
	}

	return new Promise((resolve, reject) => {
		uni.request({
			url: isAbsoluteUrl(url) ? url : `${baseURL}${url}`,
			method: String(method).toUpperCase(),
			data,
			header: requestHeader,
			timeout,
			success: (res) => {
				const body = res.data || {}
				const ok = res.statusCode >= 200 && res.statusCode < 300

				if (ok && (body.code === 0 || body.code === undefined)) {
					resolve(body.code === undefined ? body : body.data)
					return
				}

				if (res.statusCode === 401 || [401, 1004, 100401].includes(Number(body.code))) {
					uni.removeStorageSync('token')
					uni.removeStorageSync('userInfo')
					uni.removeStorageSync('isLoggedIn')
				}

				reject(body.message ? body : { message: '请求失败', data: body })
			},
			fail: reject
		})
	})
}
