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

export const getQuotePublishPresentation = (status = 'pending') => {
  if (status === 'rejected') {
    return {
      isRepublish: true,
      title: '修改并重新发布报价',
      description: '本次发布会用新报价替换客户拒绝的旧报价，客户可重新确认。',
      buttonLabel: '重新发布报价'
    }
  }
  if (['issued', 'confirmed'].includes(status)) {
    return {
      isRepublish: true,
      title: '更新并重新发布报价',
      description: '本次发布会覆盖原报价，客户将看到最新金额；已确认的工单请先核对再修改。',
      buttonLabel: '更新并重新发布'
    }
  }
  return {
    isRepublish: false,
    title: '发布报价给客户',
    description: '发布时会自动保存上方的设备与人工质保判定，客户随后可确认费用。',
    buttonLabel: '发布报价给客户'
  }
}
