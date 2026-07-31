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

global.uniCloud = {
  database: () => ({
    command: {
      neq: value => ({ neq: value }),
      in: value => ({ in: value })
    },
    collection: () => ({ aggregate })
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
