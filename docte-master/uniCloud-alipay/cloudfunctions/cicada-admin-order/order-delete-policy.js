function normalizeText(value) {
  return String(value == null ? '' : value).trim()
}

function getOrderDeleteBlockReason(order = {}) {
  if (order.is_deleted === true) return '工单已删除'
  if (!['cancelled', 'completed'].includes(normalizeText(order.status))) {
    return '仅已取消或已完成的工单可以删除'
  }
  return ''
}

module.exports = { getOrderDeleteBlockReason }
