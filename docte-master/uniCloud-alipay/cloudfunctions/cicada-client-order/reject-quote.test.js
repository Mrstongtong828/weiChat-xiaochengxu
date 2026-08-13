const assert = require('node:assert/strict')
const test = require('node:test')

const state = {
  order: null,
  update: null,
  events: []
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
                      return { data: [{ _id: 'user-1', token: 'valid-token', token_expire: Date.now() + 60_000 }] }
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
                  return { updated: 1 }
                }
              }
            }
          }
        }
        if (name === 'cicada_order_events') {
          return {
            async add(event) {
              state.events.push(event)
              return { id: `event-${state.events.length}` }
            }
          }
        }
        throw new Error(`测试不应访问集合 ${name}`)
      }
    }
  }
}

const orderCloudObject = require('./index.obj')

function buildOrder(overrides = {}) {
  return {
    _id: 'order-1',
    order_no: 'DR-1',
    user_id: 'user-1',
    status: 'pending',
    quote_status: 'issued',
    payment_status: 'pending',
    timeline: [],
    ...overrides
  }
}

async function rejectCurrentOrder(overrides = {}) {
  state.order = buildOrder(overrides)
  state.update = null
  state.events = []
  return orderCloudObject.rejectQuote({
    token: 'valid-token',
    order_id: 'order-1',
    reason: '暂不维修'
  })
}

test('已签收设备拒绝报价后进入待回寄而不是取消工单', async () => {
  const result = await rejectCurrentOrder({ status: 'received' })

  assert.equal(result.code, 0)
  assert.equal(state.update.status, undefined)
  assert.equal(state.update.quote_status, 'rejected')
  assert.equal(state.update.payment_status, undefined)
  assert.equal(state.update.needs_return, true)
  assert.equal(state.update.archive_status, 'pending_return')
})

test('尚未寄出的报修拒绝报价后直接取消归档', async () => {
  const result = await rejectCurrentOrder({ status: 'pending', ship_out_info: {} })

  assert.equal(result.code, 0)
  assert.equal(state.update.status, 'cancelled')
  assert.equal(state.update.needs_return, undefined)
  assert.equal(state.update.archive_status, undefined)
})

test('已有寄入运单的待处理报修拒价后进入待回寄', async () => {
  const result = await rejectCurrentOrder({
    status: 'pending',
    ship_out_info: { logistics_company: '顺丰', logistics_no: 'SF1234567890' }
  })

  assert.equal(result.code, 0)
  assert.equal(state.update.status, undefined)
  assert.equal(state.update.needs_return, true)
  assert.equal(state.update.archive_status, 'pending_return')
})

test('使用历史 tracking_no 字段的待处理报修拒价后进入待回寄', async () => {
  const result = await rejectCurrentOrder({
    status: 'pending',
    ship_out_info: { logistics_company: '顺丰', tracking_no: 'SF1234567890' }
  })

  assert.equal(result.code, 0)
  assert.equal(state.update.status, undefined)
  assert.equal(state.update.needs_return, true)
  assert.equal(state.update.archive_status, 'pending_return')
})

test('运输中的设备拒绝报价后保留工单等待回寄', async () => {
  const result = await rejectCurrentOrder({ status: 'sent' })

  assert.equal(result.code, 0)
  assert.equal(state.update.status, undefined)
  assert.equal(state.update.needs_return, true)
  assert.equal(state.update.archive_status, 'pending_return')
})

test('已经到账的工单不能拒绝报价', async () => {
  const result = await rejectCurrentOrder({ status: 'fixing', payment_status: 'paid' })

  assert.equal(result.code, -1)
  assert.equal(result.msg, '工单已支付，不能拒绝报价')
  assert.equal(state.update, null)
})

test('付款凭证待核销时不能选择不维修', async () => {
  const result = await rejectCurrentOrder({ status: 'fixing', payment_status: 'uploaded' })

  assert.equal(result.code, -1)
  assert.equal(result.msg, '付款凭证正在等待财务核销，暂不能选择不维修')
  assert.equal(state.update, null)
})

test('已有付款凭证时不能绕过状态选择不维修', async () => {
  const result = await rejectCurrentOrder({
    status: 'fixing',
    payment_status: 'pending',
    payment_proofs: [{ file_id: 'cloud://proof.jpg' }]
  })

  assert.equal(result.code, -1)
  assert.equal(result.msg, '付款凭证正在等待财务核销，暂不能选择不维修')
  assert.equal(state.update, null)
})
