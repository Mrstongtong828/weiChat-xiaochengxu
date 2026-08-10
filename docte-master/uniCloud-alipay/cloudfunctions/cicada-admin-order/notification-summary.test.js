const assert = require('node:assert/strict')
const test = require('node:test')

const pendingQuoteOrder = {
  _id: 'order-1',
  order_no: 'DR-1',
  status: 'received',
  quote_status: 'pending',
  create_time: Date.now()
}

const aggregate = () => ({
  match() { return this },
  sort() { return this },
  skip() { return this },
  limit() { return this },
  async end() { return { data: [pendingQuoteOrder] } }
})

const countMatches = []
let failReturnCount = false
const where = match => ({
  async count() {
    countMatches.push(match)
    const returnStatuses = match.status && match.status.in
    const returnQuoteStatuses = match.quote_status && match.quote_status.in
    const isReturnTodoQuery = Array.isArray(returnStatuses)
      && returnStatuses.includes('fixing')
      && returnStatuses.includes('inspecting')
      && Array.isArray(returnQuoteStatuses)
      && returnQuoteStatuses.includes('issued')
      && returnQuoteStatuses.includes('confirmed')
      && returnQuoteStatuses.includes('rejected')
      && !Object.prototype.hasOwnProperty.call(match, 'payment_status')
    if (failReturnCount && isReturnTodoQuery) throw new Error('count unavailable')
    return { total: isReturnTodoQuery ? 1 : 0 }
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
  const result = await service.getNotificationSummary.call({
    currentAdminUser: { role: 'admin' }
  })

  assert.equal(result.code, 0)
  const quoteGroup = result.data.groups.find(group => group.key === 'quote')
  assert.ok(quoteGroup)
  assert.equal(quoteGroup.samples[0].desc, '当前状态：已签收')
})

test('待回寄统计包含已报价且维修中的未付款工单', async () => {
  countMatches.length = 0
  failReturnCount = false
  const result = await service.getTodoSummary.call({
    currentAdminUser: { role: 'admin' }
  })

  assert.equal(result.code, 0)
  const returnGroup = result.data.groups.find(group => group.key === 'return')
  assert.equal(returnGroup.count, 1)
  assert.equal(returnGroup.desc, '已报价或拒修且尚未回寄')
})

test('待回寄统计兜底路径排除尚未报价的检测中工单', async () => {
  failReturnCount = true
  const result = await service.getTodoSummary.call({
    currentAdminUser: { role: 'admin' }
  })

  assert.equal(result.code, 0)
  const returnGroup = result.data.groups.find(group => group.key === 'return')
  assert.equal(returnGroup.count, 0)
  failReturnCount = false
})
