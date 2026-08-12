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
  ship_out_info: { logistics_company: '顺丰', tracking_no: 'SF1234567890' }
}

global.uniCloud = {
  database() {
    return {
      command: {
        neq: value => ({ neq: value }),
        in: value => ({ in: value })
      },
      collection(name) {
        return {
          where() {
            return {
              limit() {
                return {
                  async get() {
                    if (name === 'cicada_users') {
                      return { data: [{ _id: 'user-1', token: 'valid-token', token_expire: Date.now() + 60_000 }] }
                    }
                    if (name === 'cicada_orders') return { data: [order] }
                    return { data: [] }
                  }
                }
              },
              async get() { return { data: [] } }
            }
          }
        }
      }
    }
  }
}

const service = require('./index.obj')

test('客户工单详情投影包含拒修回寄状态', async () => {
  const result = await service.getOrderDetail({ token: 'valid-token', order_id: 'order-1' })

  assert.equal(result.code, 0)
  assert.equal(result.data.needs_return, true)
  assert.equal(result.data.archive_status, 'pending_return')
})
