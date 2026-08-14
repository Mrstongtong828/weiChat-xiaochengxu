import test from 'node:test'
import assert from 'node:assert/strict'
import { createCurrentMonthRange, formatLocalDate, toApiDateRange } from './dateRange.js'

test('本月范围从1号开始并截止参考日期', () => {
  assert.deepEqual(createCurrentMonthRange(new Date(2026, 7, 14, 18, 30)), ['2026-08-01', '2026-08-14'])
})

test('API 日期参数保留本地日历日期', () => {
  assert.deepEqual(toApiDateRange(['2026-08-01', '2026-08-14']), { startDate: '2026-08-01', endDate: '2026-08-14' })
  assert.deepEqual(toApiDateRange(null), { startDate: '', endDate: '' })
  assert.equal(formatLocalDate(new Date(2026, 0, 2)), '2026-01-02')
})
