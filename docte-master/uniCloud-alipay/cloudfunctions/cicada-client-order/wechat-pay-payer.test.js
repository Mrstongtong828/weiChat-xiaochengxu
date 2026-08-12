const assert = require('node:assert/strict')
const crypto = require('crypto')
const test = require('node:test')

const merchantKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const platformKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicKeyId = 'PUB_KEY_ID_TEST'

Object.assign(process.env, {
  WX_APPID: 'wx-test-app',
  WX_SECRET: 'test-secret',
  WX_PAY_APPID: 'wx-test-app',
  WX_PAY_MCH_ID: 'test-mch-id',
  WX_PAY_SERIAL_NO: 'test-merchant-serial',
  WX_PAY_NOTIFY_URL: 'https://example.test/wechat-pay-notify',
  WX_PAY_PRIVATE_KEY: merchantKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  WX_PAY_PUBLIC_KEY_ID: publicKeyId,
  WX_PAY_PUBLIC_KEY: platformKeys.publicKey.export({ type: 'spki', format: 'pem' })
})

const state = {
  order: null,
  update: null,
  payerOpenid: '',
  payRequests: 0
}

function signedWechatPayResponse(body) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const nonce = 'payment-response-nonce'
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(`${timestamp}\n${nonce}\n${body}\n`),
    platformKeys.privateKey
  ).toString('base64')
  return {
    'Wechatpay-Timestamp': timestamp,
    'Wechatpay-Nonce': nonce,
    'Wechatpay-Signature': signature,
    'Wechatpay-Serial': publicKeyId
  }
}

global.uniCloud = {
  database() {
    return {
      command: {
        neq: value => ({ neq: value })
      },
      collection(name) {
        if (name === 'cicada_users') {
          return {
            where() {
              return {
                limit() {
                  return {
                    async get() {
                      return {
                        data: [{
                          _id: 'user-1',
                          openid: 'login-openid',
                          token: 'valid-token',
                          token_expire: Date.now() + 60_000
                        }]
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (name === 'cicada_orders') {
          return {
            where() {
              return {
                limit() {
                  return { async get() { return { data: state.order ? [state.order] : [] } } }
                }
              }
            },
            doc() {
              return {
                async update(patch) {
                  state.update = patch
                  Object.assign(state.order, patch)
                  return { updated: 1 }
                }
              }
            }
          }
        }
        throw new Error(`测试不应访问集合 ${name}`)
      }
    }
  },
  httpclient: {
    async request(url, options = {}) {
      if (url.startsWith('https://api.weixin.qq.com/sns/jscode2session')) {
        return { status: 200, data: { openid: 'current-payer-openid' } }
      }
      if (url === 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi') {
        state.payRequests += 1
        const requestBody = JSON.parse(options.data)
        state.payerOpenid = requestBody.payer && requestBody.payer.openid
        const body = JSON.stringify({ prepay_id: 'prepay-current-payer' })
        return { status: 200, data: body, headers: signedWechatPayResponse(body) }
      }
      throw new Error(`未预期的 HTTP 请求: ${url}`)
    }
  }
}

const orderCloudObject = require('./index.obj')

function buildOrder(overrides = {}) {
  return {
    _id: 'order-1',
    order_no: 'DR-PAYER-1',
    user_id: 'user-1',
    status: 'received',
    quote_status: 'issued',
    payment_status: 'pending',
    total_price: 0.02,
    timeline: [],
    wechat_pay_out_trade_no: 'DR-PAYER-1POLD',
    wechat_pay_prepay_id: 'prepay-old-payer',
    wechat_pay_payer_openid: 'old-payer-openid',
    wechat_pay_amount: 2,
    wechat_pay_create_time: Date.now(),
    ...overrides
  }
}

async function createPayment(overrides = {}) {
  state.order = buildOrder(overrides)
  state.update = null
  state.payerOpenid = ''
  state.payRequests = 0
  return orderCloudObject.createWechatPayPayment({
    token: 'valid-token',
    order_id: 'order-1',
    payer_code: 'fresh-wechat-code'
  })
}

test('当前支付 openid 不同时不复用旧预支付单', async () => {
  const result = await createPayment()

  assert.equal(result.code, 0)
  assert.equal(state.payRequests, 1)
  assert.equal(state.payerOpenid, 'current-payer-openid')
  assert.equal(result.data.prepayId, 'prepay-current-payer')
  assert.equal(state.update.wechat_pay_payer_openid, 'current-payer-openid')
})

test('历史预支付单未记录 payer openid 时为当前账号重新创建', async () => {
  const result = await createPayment({ wechat_pay_payer_openid: '' })

  assert.equal(result.code, 0)
  assert.equal(state.payRequests, 1)
  assert.equal(result.data.prepayId, 'prepay-current-payer')
  assert.equal(state.update.wechat_pay_payer_openid, 'current-payer-openid')
})

test('当前支付 openid 相同时可复用有效预支付单', async () => {
  const result = await createPayment({ wechat_pay_payer_openid: 'current-payer-openid' })

  assert.equal(result.code, 0)
  assert.equal(state.payRequests, 0)
  assert.equal(result.data.prepayId, 'prepay-old-payer')
  assert.equal(state.update, null)
})
