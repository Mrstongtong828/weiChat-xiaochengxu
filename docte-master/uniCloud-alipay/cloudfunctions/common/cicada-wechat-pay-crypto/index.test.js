const assert = require('node:assert/strict')
const crypto = require('crypto')
const test = require('node:test')
const { getChunkedEnvValue, verifyWechatPaySignature } = require('./index')

function signedHeaders(privateKey, serial, body, timestamp = '1784710800', nonce = 'notify-nonce') {
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${timestamp}\n${nonce}\n${body}\n`), privateKey).toString('base64')
  return {
    'Wechatpay-Timestamp': timestamp,
    'Wechatpay-Nonce': nonce,
    'Wechatpay-Signature': signature,
    'Wechatpay-Serial': serial
  }
}

test('verifies a response signed by the configured WeChat Pay public key', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const body = JSON.stringify({ prepay_id: 'wx-test' })
  const publicKeyId = 'PUB_KEY_ID_TEST'
  const result = verifyWechatPaySignature({
    headers: signedHeaders(privateKey, publicKeyId, body),
    rawBody: body,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    publicKeyId
  })
  assert.equal(result.verified, true)
})

test('rejects a response signed under another public key id', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const body = '{}'
  assert.throws(() => verifyWechatPaySignature({
    headers: signedHeaders(privateKey, 'PUB_KEY_ID_OTHER', body),
    rawBody: body,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    publicKeyId: 'PUB_KEY_ID_EXPECTED'
  }), /公钥ID与响应签名不匹配/)
})

test('rejects stale notification timestamps', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const body = '{}'
  const timestamp = '1784710800'
  assert.throws(() => verifyWechatPaySignature({
    headers: signedHeaders(privateKey, 'PUB_KEY_ID_TEST', body, timestamp),
    rawBody: body,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    publicKeyId: 'PUB_KEY_ID_TEST',
    now: Number(timestamp) * 1000 + 301000,
    checkTimestamp: true
  }), /时间戳超出有效期/)
})

test('reads a long secret from numbered environment variable chunks', () => {
  const value = getChunkedEnvValue({
    WX_PAY_PRIVATE_KEY_BASE64_1: 'first-',
    WX_PAY_PRIVATE_KEY_BASE64_2: 'second-',
    WX_PAY_PRIVATE_KEY_BASE64_3: 'third'
  }, ['WX_PAY_PRIVATE_KEY_BASE64'])
  assert.equal(value, 'first-second-third')
})

test('prefers the original single environment variable when configured', () => {
  const value = getChunkedEnvValue({
    WX_PAY_PRIVATE_KEY_BASE64: 'single',
    WX_PAY_PRIVATE_KEY_BASE64_1: 'chunk'
  }, ['WX_PAY_PRIVATE_KEY_BASE64'])
  assert.equal(value, 'single')
})

test('prefers canonical chunks over a legacy alias single value', () => {
  const value = getChunkedEnvValue({
    WX_PAY_PRIVATE_KEY_BASE64_1: 'canonical-',
    WX_PAY_PRIVATE_KEY_BASE64_2: 'chunks',
    WXPAY_PRIVATE_KEY_BASE64: 'stale-legacy-value'
  }, ['WX_PAY_PRIVATE_KEY_BASE64', 'WXPAY_PRIVATE_KEY_BASE64'])
  assert.equal(value, 'canonical-chunks')
})

test('rejects non-contiguous environment variable chunks', () => {
  assert.throws(() => getChunkedEnvValue({
    WX_PAY_PRIVATE_KEY_BASE64_1: 'first',
    WX_PAY_PRIVATE_KEY_BASE64_3: 'third'
  }, ['WX_PAY_PRIVATE_KEY_BASE64']), /分段配置不连续/)
})
