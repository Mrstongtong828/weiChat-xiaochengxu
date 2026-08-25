const PAYMENT_STAGE_STATUSES = new Set(['received', 'inspecting', 'fixing'])

export const summarizePaymentStage = (orders = []) => {
  return orders.reduce((summary, order = {}) => {
    const status = order.statusEn || order.status
    if (!PAYMENT_STAGE_STATUSES.has(status)) return summary

    const paymentStatus = order.paymentStatus || order.payment_status || 'pending'
    if (paymentStatus === 'paid') {
      summary.paid += 1
      return summary
    }

    const totalPrice = Number(order.totalPrice ?? order.total_price ?? 0) || 0
    if (paymentStatus !== 'not_required' && totalPrice > 0) summary.pending += 1
    return summary
  }, { pending: 0, paid: 0 })
}
