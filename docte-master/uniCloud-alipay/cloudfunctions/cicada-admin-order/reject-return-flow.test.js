const assert = require('node:assert/strict')
const test = require('node:test')

const order = {
  _id: 'order-1',
  order_no: 'DR-1',
  user_id: 'user-1',
  status: 'received',
  quote_status: 'rejected',
  payment_status: 'pending',
  needs_return: true,
  archive_status: 'pending_return',
  ship_back_info: {},
  timeline: []
}

let activeOrder = order
let updatedOrder = null

global.uniCloud = {
  database() {
    return {
      command: {
        neq: value => ({ neq: value }),
        in: value => ({ in: value }),
        gt: value => ({ gt: value }),
        or: value => ({ or: value })
      },
      collection(name) {
        if (name === 'cicada_orders') {
          return {
            where(match) {
              return {
                limit() {
                  return {
                    async get() {
                      return { data: match && match.order_no ? [activeOrder] : [] }
                    }
                  }
                }
              }
            },
            doc() {
              return {
                async get() { return { data: [activeOrder] } },
                async update(patch) {
                  updatedOrder = patch
                  return { updated: 1 }
                }
              }
            }
          }
        }
        if (name === 'cicada_order_events') {
          return { async add() { return { id: 'event-1' } } }
        }
        return {
          async add() { return { id: 'record-1' } },
          where() {
            return {
              limit() { return { async get() { return { data: [] } } } },
              async get() { return { data: [] } }
            }
          }
        }
      }
    }
  }
}

const service = require('./index.obj')
const adminContext = { currentAdminUser: { _id: 'admin-1', role: 'admin', name: '管理员' } }

test('已签收拒修订单录入回寄物流后直接进入已回寄并清除待回寄标记', async () => {
  activeOrder = order
  updatedOrder = null
  const result = await service.batchUpdateShipping.call(adminContext, {
    shippingList: [{ orderNo: 'DR-1', returnCompany: '顺丰速运', returnNo: 'SF123456789012' }]
  })

  assert.equal(result.code, 0, result.msg)
  assert.equal(result.data.success, 1)
  assert.equal(updatedOrder.status, 'shipped')
  assert.equal(updatedOrder.needs_return, false)
  assert.equal(updatedOrder.archive_status, 'returned')
})

test('已签收订单不能绕过回寄运单直接改成已回寄', async () => {
  activeOrder = order
  updatedOrder = null
  const result = await service.updateOrderStatus.call(adminContext, {
    order_id: 'order-1',
    status: 'shipped'
  })

  assert.equal(result.code, -1)
  assert.equal(result.msg, '请先录入回寄物流单号，再标记为已回寄')
  assert.equal(updatedOrder, null)
})

test('未确认方案的正常已签收维修单不能直接回寄', async () => {
  activeOrder = {
    ...order,
    quote_status: 'issued',
    needs_return: false,
    archive_status: 'active'
  }
  updatedOrder = null

  const result = await service.batchUpdateShipping.call(adminContext, {
    shippingList: [{ orderNo: 'DR-1', returnCompany: '顺丰速运', returnNo: 'SF123456789012' }]
  })

  assert.equal(result.code, 0)
  assert.equal(result.data.success, 0)
  assert.equal(result.data.errors[0].reason, '维修前必须先确认维修方案')
  assert.equal(updatedOrder, null)
})

test('已确认付款的已签收维修单可以直接回寄', async () => {
  activeOrder = {
    ...order,
    quote_status: 'confirmed',
    authorization_status: 'confirmed',
    payment_status: 'paid',
    total_price: 100,
    needs_return: false,
    archive_status: 'active'
  }
  updatedOrder = null

  const result = await service.batchUpdateShipping.call(adminContext, {
    shippingList: [{ orderNo: 'DR-1', returnCompany: '顺丰速运', returnNo: 'SF123456789012' }]
  })

  assert.equal(result.code, 0, result.msg)
  assert.equal(result.data.success, 1)
  assert.equal(updatedOrder.status, 'shipped')
})

test('拒修设备回寄后结案会推进为已归档', async () => {
  activeOrder = {
    ...order,
    status: 'shipped',
    needs_return: false,
    archive_status: 'returned',
    ship_back_info: { logistics_company: '顺丰速运', logistics_no: 'SF123456789012' }
  }
  updatedOrder = null

  const result = await service.updateOrderStatus.call(adminContext, {
    order_id: 'order-1',
    status: 'completed'
  })

  assert.equal(result.code, 0)
  assert.equal(updatedOrder.status, 'completed')
  assert.equal(updatedOrder.needs_return, false)
  assert.equal(updatedOrder.archive_status, 'archived')
})
