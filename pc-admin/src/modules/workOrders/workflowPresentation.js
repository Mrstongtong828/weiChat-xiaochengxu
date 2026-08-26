const getValue = (order = {}, camelKey, snakeKey = '') => order[camelKey] || (snakeKey ? order[snakeKey] : '') || ''

const getPaymentStatus = (order = {}, fallback = '') => fallback || getValue(order, 'paymentStatus', 'payment_status')

export const isRepairStageReady = (order = {}, paymentFallback = '') => {
  const quoteStatus = getValue(order, 'quoteStatus', 'quote_status')
  if (!['issued', 'confirmed'].includes(quoteStatus)) return false

  const paymentStatus = getPaymentStatus(order, paymentFallback)
  const authorizationStatus = getValue(order, 'authorizationStatus', 'authorization_status')
  const chargeType = getValue(order, 'chargeType', 'charge_type')
  const warrantyStatus = getValue(order, 'warrantyStatus', 'warranty_status')
  const inWarranty = Boolean(order.inWarranty ?? order.in_warranty)
  const warrantyFreeReady = paymentStatus === 'not_required'
    && chargeType === 'free'
    && inWarranty
    && ['in_warranty', 'extended'].includes(warrantyStatus)

  return authorizationStatus === 'confirmed' || paymentStatus === 'paid' || warrantyFreeReady
}

export const getWorkflowStageIndex = (order = {}, paymentFallback = '') => {
  const status = getValue(order, 'status')
  const returnNo = getValue(order, 'returnNo', 'return_no')
  const quoteStatus = getValue(order, 'quoteStatus', 'quote_status')

  if (status === '已完成' || status === '已回寄' || returnNo) return 4
  if (['处理中', '维修中'].includes(status) || isRepairStageReady(order, paymentFallback)) return 3
  if (['issued', 'confirmed', 'rejected'].includes(quoteStatus) || Number(order.totalPrice ?? order.total_price ?? 0) > 0) return 2
  if (['已签收', '检测中'].includes(status)) return 1
  return 0
}

export const getRecommendedWorkflowTab = (order = {}, { paymentStatus = '', invoiceState = '' } = {}) => {
  const status = getValue(order, 'status')
  const returnNo = getValue(order, 'returnNo', 'return_no')
  const quoteStatus = getValue(order, 'quoteStatus', 'quote_status')
  const resolvedPaymentStatus = getPaymentStatus(order, paymentStatus)

  if (['pending', 'draft', ''].includes(quoteStatus) && !['已提交', '运输中'].includes(status)) return 'quote'
  if (status === '已回寄' || returnNo || quoteStatus === 'rejected') return 'return'
  if (quoteStatus === 'issued' && !isRepairStageReady(order, resolvedPaymentStatus)) return 'quote'
  if (isRepairStageReady(order, resolvedPaymentStatus)) return 'repair'
  if (order.needInvoice && resolvedPaymentStatus === 'paid' && !['已发票', '已寄出', '已签收'].includes(invoiceState)) return 'invoice'
  if (resolvedPaymentStatus === 'paid' || resolvedPaymentStatus === 'not_required') return 'repair'
  return 'base'
}
