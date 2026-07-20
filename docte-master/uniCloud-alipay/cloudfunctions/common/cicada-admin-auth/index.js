const ADMIN_AUTH_ERROR_CODE = 401

function createAdminAuthError(message = '鉴权失败') {
  const error = new Error(message)
  error.code = ADMIN_AUTH_ERROR_CODE
  return error
}

function isAdminAuthFailure(value) {
  const message = value && (value.msg || value.message) ? String(value.msg || value.message) : ''
  return Number(value && value.code) === ADMIN_AUTH_ERROR_CODE ||
    message.startsWith('鉴权失败') ||
    message === 'Token已过期'
}

function toAdminErrorResponse(error) {
  const message = error && error.message ? error.message : '请求失败'
  return {
    code: isAdminAuthFailure(error) ? ADMIN_AUTH_ERROR_CODE : -1,
    msg: message
  }
}

function normalizeAdminAuthResult(result) {
  if (!result || Number(result.code) === 0 || !isAdminAuthFailure(result)) return result
  return { ...result, code: ADMIN_AUTH_ERROR_CODE }
}

function isAdminTokenExpired(tokenExpire, now = Date.now()) {
  const expireAt = Number(tokenExpire)
  return !Number.isFinite(expireAt) || expireAt <= 0 || now >= expireAt
}

module.exports = {
  ADMIN_AUTH_ERROR_CODE,
  createAdminAuthError,
  isAdminAuthFailure,
  toAdminErrorResponse,
  normalizeAdminAuthResult,
  isAdminTokenExpired
}
