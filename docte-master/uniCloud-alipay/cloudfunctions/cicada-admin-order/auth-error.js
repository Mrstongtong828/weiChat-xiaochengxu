const ADMIN_AUTH_ERROR_CODE = 401

function createAdminAuthError(message = '鉴权失败') {
  const error = new Error(message)
  error.code = ADMIN_AUTH_ERROR_CODE
  return error
}

function toAdminErrorResponse(error) {
  const message = error && error.message ? error.message : '请求失败'
  const isAuthError = Number(error && error.code) === ADMIN_AUTH_ERROR_CODE || message.startsWith('鉴权失败')
  return {
    code: isAuthError ? ADMIN_AUTH_ERROR_CODE : -1,
    msg: message
  }
}

module.exports = {
  ADMIN_AUTH_ERROR_CODE,
  createAdminAuthError,
  toAdminErrorResponse
}
