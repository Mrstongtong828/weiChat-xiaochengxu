const receiptSyncSourceStatuses = new Set(['pending', 'sent'])

const getOrderStatus = (order = {}) => String(order.statusEn || order.status || '').trim()

const getReceiptStatus = (order = {}) => String(
  order.receivedPartsReceipt?.status || order.received_parts_receipt?.status || ''
).trim()

export const needsReceivedPartsStatusSync = (order = {}) => (
  getReceiptStatus(order) === 'confirmed' && receiptSyncSourceStatuses.has(getOrderStatus(order))
)

export const selectPreferredDrawerStatus = ({ order = {}, allowedStatuses = [], activeTab = '' } = {}) => {
  if (!Array.isArray(allowedStatuses) || !allowedStatuses.length) return order.status || ''
  if (needsReceivedPartsStatusSync(order) && allowedStatuses.includes('已签收')) return '已签收'
  if (activeTab === 'return' && allowedStatuses.includes('已回寄')) return '已回寄'
  if (activeTab === 'repair' && allowedStatuses.includes('处理中')) return '处理中'
  return allowedStatuses[0]
}
