export const parseCloudErrorDetail = (detail = '') => {
  const text = String(detail || '')
  if (!text) return ''

  const messageMatch = text.match(/"message":"([^"]+)"/)
  const message = messageMatch ? messageMatch[1].replace(/\\"/g, '"') : text
  const errorPrefix = 'error: '
  const prefixIndex = message.indexOf(errorPrefix)
  const normalized = prefixIndex >= 0 ? message.slice(prefixIndex + errorPrefix.length) : message
  return normalized.split('. stack:')[0].trim()
}

export const getErrorMessage = (payload, fallback = '请求失败') => {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload || fallback
  return payload.msg ||
    payload.message ||
    parseCloudErrorDetail(payload.errDetail) ||
    fallback
}
