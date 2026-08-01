const assert = require('node:assert/strict')
const test = require('node:test')

const databaseState = {
  recentOrders: [],
  orderItems: {},
  rateLimits: new Map()
}

global.uniCloud = {
  database() {
    return {
      command: {
        gte: value => value,
        lt: value => value,
        inc: value => value,
        neq: value => value,
        or: value => value
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
                        data: [{ _id: 'user-1', token: 'valid-token', token_expire: Date.now() + 60_000 }]
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (name === 'cicada_rate_limits') {
          return {
            where(query = {}) {
              const findRecord = () => {
                if (query.key) return databaseState.rateLimits.get(query.key)
                return [...databaseState.rateLimits.values()].find(record => record._id === query._id)
              }
              return {
                limit() {
                  return { async get() { const record = findRecord(); return { data: record ? [record] : [] } } }
                },
                async update(patch) {
                  const record = findRecord()
                  if (!record) return { updated: 0 }
                  if (query.lock_token !== undefined && record.lock_token !== query.lock_token) return { updated: 0 }
                  if (query.state !== undefined && record.state !== query.state) return { updated: 0 }
                  Object.assign(record, patch)
                  return { updated: 1 }
                },
                async remove() {
                  const record = findRecord()
                  if (!record) return { deleted: 0 }
                  if (query.lock_token !== undefined && record.lock_token !== query.lock_token) return { deleted: 0 }
                  databaseState.rateLimits.delete(record.key)
                  return { deleted: 1 }
                }
              }
            },
            async add(data) {
              if (databaseState.rateLimits.has(data.key)) throw new Error('duplicate key')
              databaseState.rateLimits.set(data.key, { ...data, _id: `rate-${databaseState.rateLimits.size + 1}` })
              return { id: data.key }
            }
          }
        }
        if (name === 'cicada_customers') {
          return {
            where() {
              return {
                limit() {
                  return { async get() { return { data: [] } } }
                }
              }
            }
          }
        }
        if (name === 'cicada_orders') {
          return {
            where() {
              return {
                field() {
                  return {
                    orderBy() {
                      return {
                        limit() {
                          return { async get() { return { data: databaseState.recentOrders } } }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (name === 'cicada_order_items') {
          return {
            where(query) {
              return {
                field() {
                  return {
                    limit() {
                      return {
                        async get() {
                          return { data: databaseState.orderItems[query.order_id] || [] }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        throw new Error(`测试不应访问集合 ${name}`)
      }
    }
  }
}

const orderCloudObject = require('./index.obj')
const {
  acquireRepairSubmission,
  buildRepairRequestFingerprint,
  completeRepairSubmission,
  getOrderItemSnError,
  isSameRepairRequest
} = orderCloudObject.__test__

function buildRequest(overrides = {}) {
  return {
    customer_type: 'clinic',
    ship_out_info: {
      name: '张三',
      phone: '13800138000',
      unit: '口腔诊所',
      region: ['浙江省', '杭州市', '西湖区'],
      detail: '文三路 1 号',
      logistics_company: '顺丰',
      logistics_no: 'SF123456'
    },
    ship_back_info: {
      name: '张三',
      phone: '13800138000',
      unit: '口腔诊所',
      region: ['浙江省', '杭州市', '西湖区'],
      detail: '文三路 1 号'
    },
    items: [
      {
        product_name: '牙科手机',
        product_category: '治疗设备',
        product_model: 'A1',
        sn: 'ab-12 34',
        buy_date: '2026-01-01',
        fault_desc: '工作时有异响',
        image_urls: ['cloud://fault-1.jpg']
      },
      {
        product_name: '洁牙机',
        product_category: '清洁设备',
        product_model: 'B2',
        sn: 'XY-99',
        buy_date: '2025-06-01',
        fault_desc: '无法启动'
      }
    ],
    ...overrides
  }
}

test('相同多产品报修在产品顺序和 SN 格式变化后仍视为重复提交', () => {
  const submitted = buildRequest()
  const persisted = buildRequest({
    items: [
      { ...submitted.items[1], sn: 'xy99' },
      { ...submitted.items[0], sn: 'AB1234' }
    ]
  })

  assert.equal(isSameRepairRequest(submitted, persisted), true)
})

test('同一 SN 的故障描述变化时视为新的报修请求', () => {
  const submitted = buildRequest()
  const newFault = buildRequest({
    items: submitted.items.map((item, index) => index === 0
      ? { ...item, fault_desc: '机头完全停止转动' }
      : item)
  })

  assert.equal(isSameRepairRequest(submitted, newFault), false)
})

test('回寄信息或用户类型变化时不视为重复提交', () => {
  const submitted = buildRequest()
  const changedAddress = buildRequest({
    ship_back_info: { ...submitted.ship_back_info, detail: '文三路 2 号' }
  })
  const changedCustomerType = buildRequest({ customer_type: 'dealer' })

  assert.equal(isSameRepairRequest(submitted, changedAddress), false)
  assert.equal(isSameRepairRequest(submitted, changedCustomerType), false)
})

test('SN 最多允许 80 个字符，超长时返回明确错误', () => {
  assert.equal(getOrderItemSnError([{ sn: 'A'.repeat(80) }]), '')
  assert.equal(getOrderItemSnError([{ sn: 'A'.repeat(81) }]), '产品序列号不能超过80个字符')
})

test('提交报修时明确拒绝超长 SN，而不是静默截断', async () => {
  const result = await orderCloudObject.createOrder({
    token: 'valid-token',
    customer_type: 'clinic',
    ship_out_info: {
      name: '张三',
      phone: '13800138000',
      detail: '文三路 1 号'
    },
    ship_back_info: {
      name: '张三',
      phone: '13800138000',
      unit: '口腔诊所',
      detail: '文三路 1 号'
    },
    items: [{
      product_name: '牙科手机',
      product_model: 'A1',
      sn: 'A'.repeat(81),
      fault_desc: '工作时有异响'
    }]
  })

  assert.deepEqual(result, { code: -1, msg: '产品序列号不能超过80个字符' })
})

test('连续提交完全相同的报修请求时返回最近工单', async () => {
  const request = buildRequest()
  databaseState.recentOrders = [{
    _id: 'order-1',
    order_no: 'DR202607310001',
    status: 'pending',
    customer_type: request.customer_type,
    ship_out_info: request.ship_out_info,
    ship_back_info: request.ship_back_info,
    create_time: Date.now()
  }]
  databaseState.orderItems['order-1'] = request.items

  const result = await orderCloudObject.createOrder({ token: 'valid-token', ...request })

  assert.deepEqual(result, {
    code: 0,
    msg: '检测到相同报修刚提交过，已为您返回最近工单',
    data: {
      order_id: 'order-1',
      order_no: 'DR202607310001',
      duplicate: true
    }
  })
})

test('并发提交相同报修时只有一个请求取得建单资格', async () => {
  const fingerprint = buildRepairRequestFingerprint(buildRequest())
  const now = Date.now()
  const [first, second] = await Promise.all([
    acquireRepairSubmission('concurrent-user', fingerprint, now),
    acquireRepairSubmission('concurrent-user', fingerprint, now)
  ])
  const owner = [first, second].find(result => result.state === 'owner')
  const blocked = [first, second].find(result => result.state === 'pending')

  assert.ok(owner)
  assert.ok(blocked)

  await completeRepairSubmission(owner, 'order-concurrent', 'DR-CONCURRENT', now + 1)
  const retry = await acquireRepairSubmission('concurrent-user', fingerprint, now + 2)
  assert.deepEqual(retry, {
    state: 'duplicate',
    orderId: 'order-concurrent',
    orderNo: 'DR-CONCURRENT'
  })
})

test('订单和幂等锁字段已声明在数据库 schema', () => {
  const orderSchema = require('../../database/cicada_orders.schema.json')
  const rateLimitSchema = require('../../database/cicada_rate_limits.schema.json')

  assert.equal(orderSchema.properties.request_fingerprint.bsonType, 'string')
  assert.equal(rateLimitSchema.properties.lock_token.bsonType, 'string')
  assert.deepEqual(rateLimitSchema.properties.state.enum, ['pending', 'completed'])
})
