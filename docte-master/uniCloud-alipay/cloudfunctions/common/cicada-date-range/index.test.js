const test = require('node:test')
const assert = require('node:assert/strict')
const { parseLocalDate, normalizeOptionalDateRange, isTimeInOptionalRange } = require('./index')

test('日期边界覆盖所选日期的完整一天', () => {
  const start = parseLocalDate('2026-08-01')
  const end = parseLocalDate('2026-08-01', true)
  assert.equal(new Date(start).getHours(), 0)
  assert.equal(new Date(end).getHours(), 23)
  assert.equal(end - start, 24 * 60 * 60 * 1000 - 1)
})

test('日期范围允许只设置一端', () => {
  assert.deepEqual(normalizeOptionalDateRange('2026-08-01', ''), {
    startTime: parseLocalDate('2026-08-01'),
    endTime: null
  })
  assert.deepEqual(normalizeOptionalDateRange('', '2026-08-14'), {
    startTime: null,
    endTime: parseLocalDate('2026-08-14', true)
  })
})

test('反选起止日期后自动交换且保持整天边界', () => {
  assert.deepEqual(normalizeOptionalDateRange('2026-08-14', '2026-08-01'), {
    startTime: parseLocalDate('2026-08-01'),
    endTime: parseLocalDate('2026-08-14', true)
  })
})

test('可选范围按闭区间筛选时间', () => {
  const range = normalizeOptionalDateRange('2026-08-01', '2026-08-14')
  assert.equal(isTimeInOptionalRange(parseLocalDate('2026-08-01'), range), true)
  assert.equal(isTimeInOptionalRange(parseLocalDate('2026-08-14', true), range), true)
  assert.equal(isTimeInOptionalRange(parseLocalDate('2026-07-31', true), range), false)
})
