import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkOrderQuery } from './query.js'

test('work order query keeps processing filters and page normalization in one module', async () => {
  const calls = []
  const query = createWorkOrderQuery({
    fetchPage: async (...args) => {
      calls.push(args)
      return { list: [{ id: 'WO-1' }], total: 8 }
    },
    transform: rows => rows.map(row => ({ ...row, transformed: true })),
    toStatus: value => `status:${value}`,
    resolveCustomerType: value => value,
    toDateRange: () => ({ startDate: '2026-08-01', endDate: '2026-08-20' })
  })

  const result = await query.loadPage('token', {
    filter: '处理中', page: 2, pageSize: 20, search: ' WO ', invoiceStatus: '未开票'
  })

  assert.deepEqual(calls[0].slice(1, 4), [['inspecting', 'fixing'], 2, 20])
  assert.equal(calls[0][4].keyword, 'WO')
  assert.equal(calls[0][4].responseMode, 'page')
  assert.deepEqual(result, { accepted: true, rows: [{ id: 'WO-1', transformed: true }], total: 8 })
})
