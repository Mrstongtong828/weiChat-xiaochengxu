const assert = require('node:assert/strict')
const test = require('node:test')

const { buildLogisticsReadiness } = require('./logistics-readiness')

test('物流配置自检只返回状态而不泄露凭证', () => {
  const result = buildLogisticsReadiness({
    provider: 'kuaidi100',
    key: 'secret-key',
    customer: 'secret-customer',
    callbackUrl: 'https://example.test/notify',
    callbackSalt: '12345678901234567890123456789012',
    queryConfigured: true,
    subscribeConfigured: true
  })
  assert.equal(result.ready, true)
  assert.equal(result.mode, 'live')
  assert.equal('key' in result, false)
  assert.equal('customer' in result, false)
  assert.equal('callbackSalt' in result, false)
})

test('物流配置自检列出缺失项并标记降级模式', () => {
  const result = buildLogisticsReadiness({ provider: 'kuaidi100' })
  assert.equal(result.ready, false)
  assert.equal(result.mode, 'fallback')
  assert.deepEqual(result.missing, [
    'KUAIDI100_KEY',
    'KUAIDI100_CUSTOMER',
    'KUAIDI100_CALLBACK_URL',
    'KUAIDI100_CALLBACK_SALT'
  ])
})

test('物流配置自检拒绝非 HTTPS 回调和过短 Salt', () => {
  const result = buildLogisticsReadiness({
    key: 'key',
    customer: 'customer',
    callbackUrl: 'http://example.test/notify',
    callbackSalt: 'short',
    queryConfigured: true,
    subscribeConfigured: true
  })
  assert.equal(result.ready, false)
  assert.equal(result.mode, 'query_only')
  assert.equal(result.callbackConfigured, false)
  assert.deepEqual(result.missing, ['KUAIDI100_CALLBACK_URL', 'KUAIDI100_CALLBACK_SALT'])
})
