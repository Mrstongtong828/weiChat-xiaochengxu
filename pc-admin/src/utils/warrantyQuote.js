const WARRANTY_FREE_STATUSES = new Set(['in_warranty', 'extended'])
const WARRANTY_FREE_REASONS = new Set(['quality_issue', 'repair_warranty'])

export const isWarrantyFreeSnapshot = (order = {}) => {
  const warrantyStatus = order.warrantyStatus || order.warranty_status || ''
  const chargeType = order.chargeType || order.charge_type || ''
  const inWarranty = order.inWarranty ?? order.in_warranty
  return chargeType === 'free'
    && inWarranty === true
    && WARRANTY_FREE_STATUSES.has(warrantyStatus)
}

export const resolveZeroPriceWarrantyAction = ({ order = {}, items = [] } = {}) => {
  if (isWarrantyFreeSnapshot(order)) return 'publish'
  if (Array.isArray(items) && items.length > 0 && items.every(item => (
    item
    && item._id
    && item.coverage_result === 'free'
    && WARRANTY_FREE_REASONS.has(item.coverage_reason)
  ))) return 'save'
  return 'block'
}
