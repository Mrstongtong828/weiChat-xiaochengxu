const CORPORATE_PAYMENT_METHODS = ['offline_transfer', 'bank_transfer']
const MANUAL_CONFIRMABLE_PAYMENT_STATUSES = ['pending', 'uploaded', 'rejected']

function normalizePaymentMethod(value = '') {
  return String(value || '').trim()
}

function resolveManualPaymentMethod(order = {}, requestedMethod = '') {
  const requested = normalizePaymentMethod(requestedMethod)
  const current = normalizePaymentMethod(order.payment_method || order.paymentMethod)

  if (current === 'wechat_pay') {
    throw new Error('微信支付需由支付结果自动确认，不能手动标记到账')
  }
  if (requested && !CORPORATE_PAYMENT_METHODS.includes(requested)) {
    throw new Error('财务手动确认仅支持对公支付，微信支付需由支付结果自动确认')
  }
  if (requested) return requested
  if (CORPORATE_PAYMENT_METHODS.includes(current)) return current
  return 'offline_transfer'
}

function assertManualPaymentConfirmationAllowed(order = {}) {
  const paymentStatus = String(order.payment_status || order.paymentStatus || 'pending').trim()
  if (!MANUAL_CONFIRMABLE_PAYMENT_STATUSES.includes(paymentStatus)) {
    throw new Error('当前付款状态不可人工确认到账')
  }
  return true
}

function getPaymentConfirmationStatusUpdate(order = {}, now = Date.now(), canTransition = () => false) {
  const status = String(order.status || '').trim()
  if (!canTransition(status, 'fixing')) return {}

  return {
    status: 'fixing',
    status_update_time: now,
    status_enter_time: now
  }
}

module.exports = {
  MANUAL_CONFIRMABLE_PAYMENT_STATUSES,
  assertManualPaymentConfirmationAllowed,
  getPaymentConfirmationStatusUpdate,
  resolveManualPaymentMethod
}
