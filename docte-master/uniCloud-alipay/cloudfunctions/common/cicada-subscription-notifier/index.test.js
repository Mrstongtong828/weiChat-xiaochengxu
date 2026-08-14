const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildSubscriptionDedupeKey,
  createSubscriptionNotifier
} = require('./index')

function createHarness(options = {}) {
  const logs = [...(options.logs || [])]
  const users = options.users || { user1: { _id: 'user1', openid: 'openid-1' } }
  const items = options.items || []
  const requests = []
  const env = {
    WX_APPID: 'wx-app-id',
    WX_SECRET: 'wx-secret',
    WX_SUBSCRIBE_TEMPLATE_PAYMENT_QUOTE: 'quote-template',
    WX_SUBSCRIBE_TEMPLATE_DEVICE_RECEIVE_SHIP: 'ship-template',
    ...(options.env || {})
  }

  const db = {
    command: {
      in(values) { return { $in: values } }
    },
    collection(name) {
      if (name === 'cicada_subscription_logs') {
        return {
          where(condition) {
            return {
              limit() { return this },
              async get() {
                return {
                  data: logs.filter(item => Object.entries(condition).every(([key, value]) => item[key] === value))
                }
              }
            }
          },
          async add(payload) {
            logs.push(payload)
            return { id: `log-${logs.length}` }
          }
        }
      }
      if (name === 'cicada_users') {
        return {
          doc(id) {
            return { async get() { return { data: users[id] ? [users[id]] : [] } } }
          }
        }
      }
      if (name === 'cicada_order_items') {
        return {
          where(condition) {
            const orderIds = condition.order_id && condition.order_id.$in
            return {
              limit() { return this },
              async get() {
                return { data: items.filter(item => !orderIds || orderIds.includes(item.order_id)).slice(0, 1) }
              }
            }
          }
        }
      }
      throw new Error(`unexpected collection: ${name}`)
    }
  }

  const httpclient = {
    async request(url, requestOptions = {}) {
      requests.push({ url, options: requestOptions })
      if (url.includes('/cgi-bin/token')) return { data: { access_token: 'access-token', expires_in: 7200 } }
      if (options.sendError) return { data: { errcode: 43101, errmsg: 'user refuse to accept the msg' } }
      return { data: { errcode: 0 } }
    }
  }

  return {
    logs,
    requests,
    notifier: createSubscriptionNotifier({
      db,
      httpclient,
      getEnvValue: (...names) => names.map(name => env[name]).find(Boolean) || '',
      now: () => 123456,
      logger: { error() {}, warn() {}, log() {} }
    })
  }
}

const quoteOrder = {
  _id: 'order1',
  order_no: 'DR202608140001',
  user_id: 'user1',
  product_model: 'DC-8800',
  sn: 'SN001',
  total_price: 1280.5,
  quote_update_time: 123456
}

test('builds stable business dedupe keys', () => {
  assert.equal(buildSubscriptionDedupeKey({ _id: 'o1' }, 'quote_issued'), 'quote_issued:o1')
  assert.equal(buildSubscriptionDedupeKey({
    _id: 'o1',
    ship_back_info: { logistics_no: ' sf 1 ' }
  }, 'order_shipped'), 'order_shipped:o1:SF1')
  assert.equal(buildSubscriptionDedupeKey({
    _id: 'o1',
    ship_out_info: { tracking_no: 'yt-2' }
  }, 'order_received'), 'order_received:o1:YT-2')
  assert.equal(buildSubscriptionDedupeKey({ _id: 'o1' }, 'payment_confirmed'), '')
})

test('sends a mapped message and records a sent log', async () => {
  const harness = createHarness()
  const result = await harness.notifier.sendOrderSubscription(quoteOrder, 'quote_issued', '维修报价已发布')

  assert.equal(result.status, 'sent')
  assert.equal(result.dedupeKey, 'quote_issued:order1')
  assert.equal(harness.requests.length, 2)
  const payload = JSON.parse(harness.requests[1].options.data)
  assert.equal(payload.touser, 'openid-1')
  assert.equal(payload.template_id, 'quote-template')
  assert.equal(payload.data.amount4.value, '1280.50元')
  assert.equal(harness.logs.at(-1).status, 'sent')
  assert.equal(harness.logs.at(-1).dedupe_key, 'quote_issued:order1')
})

test('skips an already sent dedupe key without calling WeChat', async () => {
  const harness = createHarness({
    logs: [{ dedupe_key: 'quote_issued:order1', status: 'sent' }]
  })
  const result = await harness.notifier.sendOrderSubscription(quoteOrder, 'quote_issued')

  assert.equal(result.status, 'duplicate')
  assert.equal(harness.requests.length, 0)
  assert.equal(harness.logs.length, 1)
})

test('logs skipped when the template is not configured', async () => {
  const harness = createHarness({ env: { WX_SUBSCRIBE_TEMPLATE_PAYMENT_QUOTE: '' } })
  const result = await harness.notifier.sendOrderSubscription(quoteOrder, 'quote_issued')

  assert.equal(result.status, 'skipped')
  assert.equal(harness.logs.at(-1).fail_reason, '未配置订阅消息模板ID')
  assert.equal(harness.requests.length, 0)
})

test('logs skipped when the order user has no openid', async () => {
  const harness = createHarness({ users: { user1: { _id: 'user1', openid: '' } } })
  const result = await harness.notifier.sendOrderSubscription(quoteOrder, 'quote_issued')

  assert.equal(result.status, 'skipped')
  assert.equal(harness.logs.at(-1).fail_reason, '用户缺少openid')
  assert.equal(harness.requests.length, 0)
})

test('logs failed and does not throw when WeChat rejects the message', async () => {
  const harness = createHarness({ sendError: true })
  const result = await harness.notifier.sendOrderSubscription(quoteOrder, 'quote_issued')

  assert.equal(result.status, 'failed')
  assert.match(harness.logs.at(-1).fail_reason, /user refuse/)
})
