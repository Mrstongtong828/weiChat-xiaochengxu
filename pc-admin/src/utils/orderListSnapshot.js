const staleReceiptStatuses = new Set(['pending', 'sent'])

const getOrderStatus = (order = {}) => String(order.statusEn || order.status || '')

export const preserveReceivedOrderSnapshot = (orders = [], snapshot = null) => {
  if (!Array.isArray(orders) || !snapshot || !snapshot._id || getOrderStatus(snapshot) !== 'received') return orders

  const index = orders.findIndex(order => order && order._id === snapshot._id)
  if (index < 0 || !staleReceiptStatuses.has(getOrderStatus(orders[index]))) return orders

  const next = [...orders]
  next[index] = { ...orders[index], ...snapshot }
  return next
}
