function normalizeText(value) {
  return String(value == null ? '' : value).trim()
}

function isCloudFileId(value) {
  return /^cloud:\/\/\S+$/.test(normalizeText(value))
}

const PAYMENT_PROOF_TERMINAL_ORDER_STATUSES = ['cancelled', 'completed']
const PAYMENT_PROOF_ALLOWED_QUOTE_STATUSES = ['issued', 'confirmed']
const PAYMENT_PROOF_ALLOWED_PAYMENT_STATUSES = ['pending', 'rejected']

function assertPaymentProofAllowed(order = {}) {
  if (PAYMENT_PROOF_TERMINAL_ORDER_STATUSES.includes(order.status)) {
    throw new Error(order.status === 'cancelled' ? '已取消工单不可上传付款凭证' : '已完成工单不可上传付款凭证')
  }
  const paymentStatus = order.payment_status || order.paymentStatus || 'pending'
  if (paymentStatus === 'paid') {
    throw new Error('该工单已支付，无需上传付款凭证')
  }
  if (paymentStatus === 'uploaded') {
    throw new Error('付款凭证已上传，请等待核销')
  }
  if (!PAYMENT_PROOF_ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
    throw new Error('当前支付状态不可上传付款凭证')
  }
  if (!PAYMENT_PROOF_ALLOWED_QUOTE_STATUSES.includes(order.quote_status || order.quoteStatus)) {
    throw new Error('当前工单暂无可支付报价')
  }
  if (Number(order.total_price ?? order.totalPrice ?? 0) <= 0) {
    throw new Error('当前工单暂无待支付金额')
  }
  return true
}

function normalizePaymentProof(proof = {}, now = Date.now()) {
  const fileID = normalizeText(proof.fileID || proof.fileId)
  if (!isCloudFileId(fileID)) {
    throw new Error('付款凭证必须先上传为有效云文件')
  }

  return {
    id: normalizeText(proof.id) || `pay-${now}`,
    url: fileID,
    fileID,
    time: normalizeText(proof.time) || now,
    create_time: now
  }
}

module.exports = {
  PAYMENT_PROOF_ALLOWED_PAYMENT_STATUSES,
  PAYMENT_PROOF_ALLOWED_QUOTE_STATUSES,
  PAYMENT_PROOF_TERMINAL_ORDER_STATUSES,
  assertPaymentProofAllowed,
  isCloudFileId,
  normalizePaymentProof
}
