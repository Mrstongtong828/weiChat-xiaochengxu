const crypto = require('crypto')

function getHeaderValue(headers = {}, name = '') {
  const target = String(name).toLowerCase()
  const key = Object.keys(headers || {}).find(item => String(item).toLowerCase() === target)
  const value = key ? headers[key] : ''
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}

function normalizePem(value = '') {
  return String(value || '').trim().replace(/\\n/g, '\n')
}

function getChunkedEnvValue(env = {}, names = [], maxChunks = 9) {
  for (const name of names) {
    const direct = String(env[name] || '').trim()
    if (direct) return direct
    const chunks = []
    let lastConfiguredIndex = 0
    for (let index = 1; index <= maxChunks; index += 1) {
      const value = String(env[`${name}_${index}`] || '').trim()
      chunks[index - 1] = value
      if (value) lastConfiguredIndex = index
    }
    if (!lastConfiguredIndex) continue
    for (let index = 0; index < lastConfiguredIndex; index += 1) {
      if (!chunks[index]) throw new Error(`${name} 分段配置不连续，缺少第 ${index + 1} 段`)
    }
    return chunks.slice(0, lastConfiguredIndex).join('')
  }
  return ''
}

function resolveVerifyKey(pem = '') {
  const normalized = normalizePem(pem)
  if (!normalized) throw new Error('未配置微信支付公钥')
  if (!normalized.includes('BEGIN CERTIFICATE')) return normalized
  if (!crypto.X509Certificate) return normalized
  return new crypto.X509Certificate(normalized).publicKey
}

function verifyWechatPaySignature({
  headers = {},
  rawBody = '',
  publicKey = '',
  publicKeyId = '',
  now = Date.now(),
  maxAgeMs = 5 * 60 * 1000,
  checkTimestamp = false
} = {}) {
  const timestamp = getHeaderValue(headers, 'Wechatpay-Timestamp')
  const nonce = getHeaderValue(headers, 'Wechatpay-Nonce')
  const signature = getHeaderValue(headers, 'Wechatpay-Signature')
  const serial = getHeaderValue(headers, 'Wechatpay-Serial')
  if (!timestamp || !nonce || !signature || !serial) {
    throw new Error('微信支付签名请求头不完整')
  }
  if (!publicKeyId) throw new Error('未配置微信支付公钥ID')
  if (serial !== publicKeyId) throw new Error('微信支付公钥ID与响应签名不匹配')
  if (checkTimestamp) {
    const signedAt = Number(timestamp) * 1000
    if (!signedAt || Math.abs(Number(now) - signedAt) > maxAgeMs) {
      throw new Error('微信支付通知时间戳超出有效期')
    }
  }
  const message = `${timestamp}\n${nonce}\n${String(rawBody || '')}\n`
  const verified = crypto.createVerify('RSA-SHA256')
    .update(message, 'utf8')
    .verify(resolveVerifyKey(publicKey), signature, 'base64')
  if (!verified) throw new Error('微信支付签名验证失败')
  return { verified: true, serial }
}

module.exports = {
  getChunkedEnvValue,
  getHeaderValue,
  normalizePem,
  verifyWechatPaySignature
}
