const CORPORATE_TRANSFER_METHODS = ['offline_transfer', 'bank_transfer']
const INVOICE_PAYMENT_METHODS = [...CORPORATE_TRANSFER_METHODS, 'wechat_pay']
const CONFIRMED_PAYMENT_STATUSES = ['paid', '已付款', '已支付', '已核款', '核款通过', '付款已确认']
const COMPLETED_ORDER_STATUSES = ['completed', '已完成']
const INVOICE_TAX_CATEGORY = '修理修配劳务'
const INVOICE_ITEM_NAME = '牙科设备检修服务费'
const INVOICE_TYPE = '发票'
const INVOICE_DELIVERY_METHOD = 'manual'
const INVOICE_EXPECTED_WORKING_DAYS = '7-15'

function normalizeText(value) {
  return String(value == null ? '' : value).trim()
}

function isCorporateTransferPayment(value) {
  return CORPORATE_TRANSFER_METHODS.includes(normalizeText(value))
}

function isInvoicePaymentMethod(value) {
  return INVOICE_PAYMENT_METHODS.includes(normalizeText(value))
}

function isCompletedOrder(order = {}) {
  return [order.statusKey, order.status_en, order.statusEn, order.status]
    .map(normalizeText)
    .some(status => COMPLETED_ORDER_STATUSES.includes(status))
}

function getInvoiceRequestBlockReason(order = {}) {
  const paymentMethod = normalizeText(order.payment_method || order.paymentMethod)
  if (!isInvoicePaymentMethod(paymentMethod)) {
    return '当前支付方式不支持申请开票'
  }
  if (!isCompletedOrder(order)) {
    return '检修服务完成并结单后才能申请开票'
  }
  const paymentStatus = normalizeText(order.payment_status || order.paymentStatus)
  if (!CONFIRMED_PAYMENT_STATUSES.includes(paymentStatus)) {
    return isCorporateTransferPayment(paymentMethod)
      ? '需财务先确认对公款项到账后才能开票'
      : '付款完成后才能申请开票'
  }
  if (!(Number(order.total_price ?? order.totalPrice ?? order.totalFee ?? 0) > 0)) {
    return '开票金额需大于 0'
  }
  return ''
}

module.exports = {
  CORPORATE_TRANSFER_METHODS,
  INVOICE_PAYMENT_METHODS,
  CONFIRMED_PAYMENT_STATUSES,
  COMPLETED_ORDER_STATUSES,
  INVOICE_ITEM_NAME,
  INVOICE_TAX_CATEGORY,
  INVOICE_TYPE,
  INVOICE_DELIVERY_METHOD,
  INVOICE_EXPECTED_WORKING_DAYS,
  getInvoiceRequestBlockReason,
  isCompletedOrder,
  isCorporateTransferPayment,
  isInvoicePaymentMethod
}
