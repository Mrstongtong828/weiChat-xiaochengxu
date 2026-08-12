const assert = require('node:assert/strict')
const test = require('node:test')

const pendingQuoteOrder = {
  _id: 'order-1',
  order_no: 'DR-1',
  status: 'received',
  quote_status: 'pending',
  create_time: Date.now()
}

let aggregateOrders = [pendingQuoteOrder]

const aggregate = () => ({
  match() { return this },
  sort() { return this },
  skip() { return this },
  limit() { return this },
  async end() { return { data: aggregateOrders } }
})

const where = () => ({
  async count() {
    return { total: 0 }
  }
})

global.uniCloud = {
  database: () => ({
    command: {
      neq: value => ({ neq: value }),
      in: value => ({ in: value }),
      gt: value => ({ gt: value })
    },
    collection: () => ({ aggregate, where })
  })
}

const service = require('./index.obj.js')

test('提醒中心为待报价工单返回状态文案', async () => {
  aggregateOrders = [pendingQuoteOrder]
  const result = await service.getNotificationSummary.call({
    currentAdminUser: { role: 'admin' }
  })

  assert.equal(result.code, 0)
  const quoteGroup = result.data.groups.find(group => group.key === 'quote')
  assert.ok(quoteGroup)
  assert.equal(quoteGroup.samples[0].desc, '当前状态：已签收')
})

test('拒绝报价的工单不再进入待报价提醒', async () => {
  aggregateOrders = [{
    _id: 'order-rejected',
    order_no: 'DR-REJECTED',
    status: 'received',
    quote_status: 'rejected',
    needs_return: true,
    create_time: Date.now()
  }]

  const result = await service.getNotificationSummary.call({
    currentAdminUser: { role: 'admin' }
  })

  assert.equal(result.code, 0)
  assert.equal(result.data.groups.some(group => group.key === 'quote'), false)
})

test('待回寄统计包含已签收且拒绝报价的工单', async () => {
  aggregateOrders = [{
    _id: 'order-return',
    order_no: 'DR-RETURN',
    status: 'received',
    quote_status: 'rejected',
    needs_return: true,
    create_time: Date.now()
  }]
  const result = await service.getTodoSummary.call({
    currentAdminUser: { role: 'admin' }
  })

  assert.equal(result.code, 0)
  const returnGroup = result.data.groups.find(group => group.key === 'return')
  assert.equal(returnGroup.count, 1)
  assert.equal(returnGroup.desc, '已报价或拒修且尚未回寄')
})

test('待回寄统计排除尚未报价的检测中工单', async () => {
  aggregateOrders = [pendingQuoteOrder]
  const result = await service.getTodoSummary.call({
    currentAdminUser: { role: 'admin' }
  })

  assert.equal(result.code, 0)
  const returnGroup = result.data.groups.find(group => group.key === 'return')
  assert.equal(returnGroup.count, 0)
})
