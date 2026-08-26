const getOrderStatus = (order = {}) => String(order.statusEn || order.status || '')

const statusRank = {
  pending: 0,
  sent: 1,
  received: 2,
  inspecting: 3,
  fixing: 4,
  shipped: 5,
  completed: 6,
  cancelled: 6
}

const getUpdateTime = (order = {}) => {
  const value = order.updateTime || order.update_time || 0
  if (typeof value === 'number') return value
  const timestamp = Date.parse(String(value || '').replace(/-/g, '/'))
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export const preserveOrderSnapshot = (orders = [], snapshot = null) => {
  if (!Array.isArray(orders) || !snapshot || !snapshot._id) return orders

  const index = orders.findIndex(order => order && order._id === snapshot._id)
  if (index < 0) return orders

  const current = orders[index]
  const snapshotRank = statusRank[getOrderStatus(snapshot)] ?? -1
  const currentRank = statusRank[getOrderStatus(current)] ?? -1
  if (currentRank > snapshotRank) return orders
  if (snapshotRank > currentRank) {
    const next = [...orders]
    next[index] = { ...current, ...snapshot }
    return next
  }
  if (snapshot.returnNo && snapshot.returnNo !== current.returnNo) {
    const next = [...orders]
    next[index] = { ...current, ...snapshot }
    return next
  }
  if (getUpdateTime(snapshot) <= getUpdateTime(current)) return orders

  const next = [...orders]
  next[index] = { ...current, ...snapshot }
  return next
}

export const preserveReceivedOrderSnapshot = (orders = [], snapshot = null) => (
  getOrderStatus(snapshot) === 'received' ? preserveOrderSnapshot(orders, snapshot) : orders
)
