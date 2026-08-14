function parseLocalDate(value, endOfDay = false) {
  const text = String(value || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date.getTime()
}

function normalizeOptionalDateRange(startDate = '', endDate = '') {
  let startTime = parseLocalDate(startDate, false)
  let endTime = parseLocalDate(endDate, true)
  if (startTime !== null && endTime !== null && startTime > endTime) {
    const originalStartDate = String(startDate || '').slice(0, 10)
    const originalEndDate = String(endDate || '').slice(0, 10)
    startTime = parseLocalDate(originalEndDate, false)
    endTime = parseLocalDate(originalStartDate, true)
  }
  return { startTime, endTime }
}

function isTimeInOptionalRange(value, range = {}) {
  const time = Number(value || 0)
  if (!time) return false
  if (range.startTime !== null && range.startTime !== undefined && time < range.startTime) return false
  if (range.endTime !== null && range.endTime !== undefined && time > range.endTime) return false
  return true
}

module.exports = { parseLocalDate, normalizeOptionalDateRange, isTimeInOptionalRange }
