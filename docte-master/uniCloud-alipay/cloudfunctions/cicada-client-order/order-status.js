function getMiniStatusBucket(status = '') {
  const key = String(status || '').trim()
  if (['pending', 'sent', 'received'].includes(key)) return 'pending'
  if (['inspecting', 'fixing'].includes(key)) return 'fixing'
  if (key === 'shipped') return 'shipped'
  return ''
}

module.exports = { getMiniStatusBucket }
