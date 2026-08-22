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
