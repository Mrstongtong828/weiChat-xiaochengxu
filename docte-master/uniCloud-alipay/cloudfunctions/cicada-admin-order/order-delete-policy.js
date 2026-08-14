function normalizeText(value) {
  return String(value == null ? '' : value).trim()
}

function getInboundTrackingNo(order = {}) {
  const info = order.ship_out_info || order.shipOutInfo || {}
  return normalizeText(info.logistics_no || info.logisticsNo || info.tracking_no || info.trackingNo)
}

function getOrderDeleteBlockReason(order = {}) {
  if (order.is_deleted === true) return '工单已删除'
  if (!['pending', 'cancelled'].includes(normalizeText(order.status))) {
    return '仅已提交或已取消的工单可以删除'
  }
  if (getInboundTrackingNo(order)) return '工单已有寄入快递单号，不能删除'

  const paymentStatus = normalizeText(order.payment_status || order.paymentStatus)
  const paymentProofs = order.payment_proofs || order.paymentProofs || []
  if (['uploaded', 'paid', 'refunded'].includes(paymentStatus)
    || normalizeText(order.wechat_pay_transaction_id || order.wechatPayTransactionId)
    || (Array.isArray(paymentProofs) && paymentProofs.length)) {
    return '工单已有付款或付款凭证记录'
  }

  if (['processing', 'refunded'].includes(normalizeText(order.refund_status || order.refundStatus))) {
    return '工单已有退款记录'
  }

  const invoice = order.invoice_info || order.invoiceInfo || {}
  if (invoice.need_invoice === true
    || invoice.needInvoice === true
    || normalizeText(invoice.invoice_no || invoice.invoiceNo)
    || normalizeText(invoice.file_url || invoice.fileUrl || invoice.invoice_url || invoice.invoiceUrl)
    || ['开具中', '已开具', '已寄出', '已签收'].includes(normalizeText(invoice.status))) {
    return '工单已有开票申请或发票记录'
  }

  if (order.inventory_deducted === true
    || order.inventoryDeducted === true
    || normalizeText(order.inventory_status || order.inventoryStatus)) {
    return '工单已有库存处理记录'
  }

  if (['issued', 'confirmed'].includes(normalizeText(order.quote_status || order.quoteStatus))
    || Number(order.total_price ?? order.totalPrice ?? 0) > 0) {
    return '工单已有正式报价记录'
  }
  return ''
}

module.exports = { getOrderDeleteBlockReason }
