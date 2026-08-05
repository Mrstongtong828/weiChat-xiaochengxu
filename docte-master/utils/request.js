import { clearAuthSession, getToken } from './storage.js'

const viteEnv = import.meta.env || {}
const processEnv = typeof process !== 'undefined' && process.env ? process.env : {}
const envBaseURL =
	viteEnv.VITE_API_BASE_URL ||
	viteEnv.VUE_APP_BASE_API ||
	processEnv.VUE_APP_BASE_API ||
	processEnv.VITE_API_BASE_URL

const FALLBACK_BASE_URL = 'https://api.cisco-d.com/api/v1'
const AUTH_ERROR_CODES = [401, 1004, 100401]
const LOGIN_PAGE_ROUTE = 'pages/login/index'

export const baseURL = (envBaseURL || FALLBACK_BASE_URL).replace(/\/$/, '')

const isAbsoluteUrl = (url = '') => /^https?:\/\//i.test(url)
const createRequestError = (message, details = {}) => Object.assign(new Error(message), details)

let loginRedirecting = false

const redirectToLogin = () => {
	if (loginRedirecting || typeof uni === 'undefined' || typeof uni.navigateTo !== 'function') return
	const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	const currentRoute = pages.length ? String(pages[pages.length - 1].route || '') : ''
	if (currentRoute === LOGIN_PAGE_ROUTE) return

	loginRedirecting = true
	uni.navigateTo({
		url: `/${LOGIN_PAGE_ROUTE}`,
		complete: () => setTimeout(() => {
			loginRedirecting = false
		}, 500)
	})
}

export default function request(options = {}) {
	const { url = '', method = 'GET', data = {}, header = {}, timeout = 30000, auth = true } = options
	const token = getToken()
	const requestHeader = { ...header }

	if (auth && !token) {
		redirectToLogin()
		return Promise.reject(createRequestError('请先登录', { code: 'AUTH_REQUIRED' }))
	}

	if (token) requestHeader.Authorization = `Bearer ${token}`

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

				const isAuthError = res.statusCode === 401 || AUTH_ERROR_CODES.includes(Number(body.code))
				if (auth && isAuthError) {
					clearAuthSession()
					redirectToLogin()
				}

				const message = body.message || body.msg || `请求失败（${res.statusCode}）`
				reject(createRequestError(message, {
					code: body.code,
					statusCode: res.statusCode,
					data: body
				}))
			},
			fail: (error) => reject(createRequestError(
				String((error && error.errMsg) || '网络请求失败'),
				{ code: error && error.errno, cause: error }
			))
		})
	})
}
