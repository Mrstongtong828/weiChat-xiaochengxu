export const resolveRepairFaultDescription = (item = {}, fallbackContent = '') => {
  const candidates = [
    item.fault,
    item.faultReason,
    item.fault_reason,
    item.fault_desc,
    item.faultDesc,
    fallbackContent
  ]
  const resolved = candidates.find(value => String(value || '').trim())
  return resolved == null ? '' : String(resolved)
}

export const resolveOrderFaultFallback = (order = {}, productIndex = 0) => {
  if (productIndex !== 0) return ''
  const candidates = [order.fault, order.fault_desc, order.faultDesc]
  const resolved = candidates.find(value => String(value || '').trim())
  return resolved == null ? '' : String(resolved)
}
