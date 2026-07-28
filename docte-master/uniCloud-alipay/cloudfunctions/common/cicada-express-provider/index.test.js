const test = require('node:test')
const assert = require('node:assert/strict')

const ENV_NAMES = ['EXPRESS_PROVIDER', 'KUAIDI100_KEY', 'KUAIDI100_CUSTOMER']
const originalEnv = Object.fromEntries(ENV_NAMES.map(name => [name, process.env[name]]))
const originalUniCloud = global.uniCloud

function configureProvider(responseOrError) {
  process.env.EXPRESS_PROVIDER = 'kuaidi100'
  process.env.KUAIDI100_KEY = 'test-key'
  process.env.KUAIDI100_CUSTOMER = 'test-customer'
  global.uniCloud = {
    httpclient: {
      request: async () => {
        if (responseOrError instanceof Error) throw responseOrError
        return { data: responseOrError }
      }
    }
  }
}

test.afterEach(() => {
  for (const name of ENV_NAMES) {
    if (originalEnv[name] === undefined) delete process.env[name]
    else process.env[name] = originalEnv[name]
  }
  global.uniCloud = originalUniCloud
})

test('verifies a waybill with real tracks', async () => {
  configureProvider({
    status: '200',
    com: 'shunfeng',
    state: '1',
    data: [{ status: '已揽收', context: '快件已揽收', ftime: '2026-07-28 09:00:00' }]
  })
  const { verifyWaybill } = require('./index')
  const result = await verifyWaybill({ company: '顺丰', trackingNo: 'SF123456789012' })

  assert.equal(result.ok, true)
  assert.equal(result.verified, true)
  assert.equal(result.cache.companyCode, 'shunfeng')
  assert.equal(result.cache.tracks.length, 1)
})

test('blocks a successful query that has no track evidence', async () => {
  configureProvider({ status: '200', com: 'shunfeng', data: [] })
  const { verifyWaybill } = require('./index')
  const result = await verifyWaybill({ company: '顺丰', trackingNo: 'SF123456789012' })

  assert.equal(result.ok, false)
  assert.equal(result.verified, false)
  assert.match(result.message, /未查询到.*物流轨迹/)
})

test('blocks an explicit invalid-waybill response', async () => {
  configureProvider({ status: '201', message: '快递单号错误' })
  const { verifyWaybill } = require('./index')
  const result = await verifyWaybill({ company: '中通', trackingNo: 'ZTO1234567890' })

  assert.equal(result.ok, false)
  assert.match(result.message, /单号错误/)
})

test('blocks a provider-reported company mismatch', async () => {
  configureProvider({
    status: '200',
    com: 'zhongtong',
    data: [{ context: '快件已揽收', ftime: '2026-07-28 09:00:00' }]
  })
  const { verifyWaybill } = require('./index')
  const result = await verifyWaybill({ company: '顺丰', trackingNo: 'SF123456789012' })

  assert.equal(result.ok, false)
  assert.match(result.message, /中通快递.*不匹配/)
})

test('degrades provider outages to a non-blocking warning', async () => {
  configureProvider(new Error('request timeout'))
  const { verifyWaybill } = require('./index')
  const result = await verifyWaybill({ company: '圆通', trackingNo: 'YT1234567890' })

  assert.equal(result.ok, true)
  assert.equal(result.verified, false)
  assert.match(result.warning, /timeout/)
})

test('rejects an unsupported or missing company before querying', async () => {
  configureProvider({ status: '200', data: [] })
  const { verifyWaybill } = require('./index')
  const result = await verifyWaybill({ company: '', trackingNo: '1234567890' })

  assert.equal(result.ok, false)
  assert.match(result.message, /物流公司.*未填写/)
})
