const CORPORATE_TRANSFER_METHODS = ['offline_transfer', 'bank_transfer']
const CONFIRMED_PAYMENT_STATUSES = ['paid', '已付款', '已支付', '已核款', '核款通过', '付款已确认']

function normalizeText(value) {
  return String(value == null ? '' : value).trim()
}

function isCorporateTransferPayment(value) {
  return CORPORATE_TRANSFER_METHODS.includes(normalizeText(value))
}

function getInvoiceRequestBlockReason(order = {}) {
  if (!isCorporateTransferPayment(order.payment_method || order.paymentMethod)) {
    return '仅对公转账订单支持申请开票'
  }
  const paymentStatus = normalizeText(order.payment_status || order.paymentStatus)
  if (!CONFIRMED_PAYMENT_STATUSES.includes(paymentStatus)) {
    return '需财务先确认对公款项到账后才能开票'
  }
  if (!(Number(order.total_price ?? order.totalPrice ?? order.totalFee ?? 0) > 0)) {
    return '开票金额需大于 0'
  }
  return ''
}

module.exports = {
  CORPORATE_TRANSFER_METHODS,
  CONFIRMED_PAYMENT_STATUSES,
  getInvoiceRequestBlockReason,
  isCorporateTransferPayment
}
