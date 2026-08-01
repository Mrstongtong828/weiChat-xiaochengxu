function buildLogisticsReadiness(config = {}) {
  const missing = []
  if (!config.key) missing.push('KUAIDI100_KEY')
  if (!config.customer) missing.push('KUAIDI100_CUSTOMER')
  const callbackUrlValid = /^https:\/\/[^\s]+\/notify\/?$/i.test(String(config.callbackUrl || ''))
  const callbackSaltValid = String(config.callbackSalt || '').length >= 32
  if (!callbackUrlValid) missing.push('KUAIDI100_CALLBACK_URL')
  if (!callbackSaltValid) missing.push('KUAIDI100_CALLBACK_SALT')
  const queryConfigured = Boolean(config.queryConfigured)
  const subscribeConfigured = Boolean(config.subscribeConfigured)
  const callbackConfigured = callbackUrlValid && callbackSaltValid
  return {
    provider: config.provider || 'kuaidi100',
    queryConfigured,
    subscribeConfigured,
    callbackConfigured,
    ready: queryConfigured && subscribeConfigured && callbackConfigured,
    mode: queryConfigured ? (subscribeConfigured && callbackConfigured ? 'live' : 'query_only') : 'fallback',
    missing
  }
}

module.exports = { buildLogisticsReadiness }
