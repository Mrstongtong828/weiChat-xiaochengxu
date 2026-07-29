function toTrackTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  const parsed = Date.parse(String(value).replace(/-/g, '/'))
  return Number.isNaN(parsed) ? 0 : parsed
}

function trackFingerprint(cache = {}) {
  const tracks = Array.isArray(cache.tracks) ? cache.tracks : []
  return JSON.stringify({
    trackingNo: cache.trackingNo || '',
    state: cache.state || '',
    status: cache.status || '',
    lastTrackAt: cache.lastTrackAt || '',
    tracks: tracks.map(item => [item.time || '', item.desc || '', item.statusCode || ''])
  })
}

function reconcileTrackCache(existing = {}, incoming = {}) {
  if (trackFingerprint(existing) === trackFingerprint(incoming)) {
    return { accepted: false, reason: 'duplicate', cache: existing }
  }
  const existingTime = toTrackTime(existing.lastTrackAt)
  const incomingTime = toTrackTime(incoming.lastTrackAt)
  if (existingTime && incomingTime && incomingTime < existingTime) {
    return { accepted: false, reason: 'stale', cache: existing }
  }
  return { accepted: true, reason: 'newer', cache: { ...existing, ...incoming } }
}

module.exports = { reconcileTrackCache }
