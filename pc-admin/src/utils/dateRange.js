const padDatePart = (value) => String(value).padStart(2, '0')

export const formatLocalDate = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

export const createCurrentMonthRange = (reference = new Date()) => {
  const end = new Date(reference)
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  return [formatLocalDate(start), formatLocalDate(end)]
}

export const toApiDateRange = (range) => {
  if (!Array.isArray(range) || range.length !== 2) return { startDate: '', endDate: '' }
  return { startDate: String(range[0] || ''), endDate: String(range[1] || '') }
}

const recentDaysRange = (days) => {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - Math.max(0, days - 1))
  return [start, end]
}

export const dateRangeShortcuts = [
  { text: '近7天', value: () => recentDaysRange(7) },
  { text: '近30天', value: () => recentDaysRange(30) },
  { text: '本月', value: () => {
    const now = new Date()
    return [new Date(now.getFullYear(), now.getMonth(), 1), now]
  } },
  { text: '今年', value: () => {
    const now = new Date()
    return [new Date(now.getFullYear(), 0, 1), now]
  } }
]
