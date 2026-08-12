const DEFAULT_PRODUCT_WARRANTY_MONTHS = 12
const DEFAULT_REPAIR_PART_WARRANTY_MONTHS = 3

function normalizeText(value) {
  return String(value == null ? '' : value).trim()
}

function normalizeSnKey(value) {
  return normalizeText(value).toUpperCase().replace(/[\s-]+/g, '')
}

function parseDate(value) {
  const text = normalizeText(value)
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDaysToDateStr(dateStr, days) {
  const date = parseDate(dateStr)
  const amount = Number(days)
  if (!date || !Number.isFinite(amount)) return ''
  date.setDate(date.getDate() + amount)
  return formatDate(date)
}

function addMonthsToDateStr(dateStr, months) {
  const date = parseDate(dateStr)
  const amount = Number(months)
  if (!date || !Number.isFinite(amount) || amount <= 0) return ''
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + amount)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return formatDate(date)
}

function getWarrantyStart(source = {}) {
  const invoiceDate = normalizeText(
    source.invoice_received_date
      || source.invoiceReceivedDate
      || source.purchase_invoice_date
      || source.purchaseInvoiceDate
  )
  if (parseDate(invoiceDate)) return { date: invoiceDate, source: 'invoice_received' }

  const manufactureDate = normalizeText(
    source.manufacture_date
      || source.manufactureDate
      || source.factory_date
      || source.factoryDate
  )
  if (parseDate(manufactureDate)) {
    return { date: addDaysToDateStr(manufactureDate, 30), source: 'factory_plus_30_days' }
  }

  const explicitStart = normalizeText(source.warranty_start_date || source.warrantyStartDate)
  if (parseDate(explicitStart)) return { date: explicitStart, source: 'manual_start_date' }

  const legacyBuyDate = normalizeText(source.buy_date || source.buyDate)
  if (parseDate(legacyBuyDate)) return { date: legacyBuyDate, source: 'legacy_purchase_date' }
  return { date: '', source: 'unknown' }
}

function getBaseWarrantyExpire(source = {}) {
  const stored = normalizeText(source.warranty_expire || source.warrantyExpire)
  if (parseDate(stored)) return stored
  const start = getWarrantyStart(source)
  if (!start.date) return ''
  return addMonthsToDateStr(start.date, DEFAULT_PRODUCT_WARRANTY_MONTHS)
}

function getEffectiveWarranty(source = {}) {
  const baseExpire = getBaseWarrantyExpire(source)
  let expire = baseExpire
  let extended = false
  const extensions = Array.isArray(source.ext_warranty) ? source.ext_warranty : []
  for (const extension of extensions) {
    const scope = normalizeText(extension && extension.scope)
    if (scope === 'same_fault_same_replaced_part' && source.repair_warranty_match !== true) continue
    const nextExpire = normalizeText(extension && (extension.new_expire || extension.newExpire))
    if (!parseDate(nextExpire)) continue
    if (!expire || parseDate(nextExpire).getTime() > parseDate(expire).getTime()) {
      expire = nextExpire
      extended = true
    }
  }
  return { baseExpire, expire, extended }
}

function computeWarrantyState(source = {}, now = Date.now()) {
  const start = getWarrantyStart(source)
  const effective = getEffectiveWarranty(source)
  if (!effective.expire) {
    return {
      warranty_status: 'unknown',
      in_warranty: false,
      expire: '',
      start_date: start.date,
      start_source: start.source
    }
  }
  const expireTs = new Date(`${effective.expire}T23:59:59`).getTime()
  if (Number.isNaN(expireTs)) {
    return {
      warranty_status: 'unknown',
      in_warranty: false,
      expire: '',
      start_date: start.date,
      start_source: start.source
    }
  }
  const inWarranty = now <= expireTs
  return {
    warranty_status: inWarranty ? (effective.extended ? 'extended' : 'in_warranty') : 'expired',
    in_warranty: inWarranty,
    expire: effective.expire,
    start_date: start.date,
    start_source: start.source
  }
}

function normalizeParts(quote = {}) {
  const detail = quote.quote_detail || quote.quoteDetail || {}
  const parts = Array.isArray(detail.parts) ? detail.parts : []
  return parts
    .map(item => ({
      code: normalizeText(item.part_code || item.partCode || item.code),
      name: normalizeText(item.name || item.part_name || item.partName),
      quantity: Number(item.quantity || 0) || 0,
      deviceSn: normalizeText(item.device_sn || item.deviceSn),
      warrantyEligible: item.warranty_eligible === true || item.warrantyEligible === true
    }))
    .filter(item => item.quantity > 0 && (item.code || item.name) && item.warrantyEligible)
}

function isFreeCoverageReason(value) {
  return ['quality_issue', 'repair_warranty'].includes(normalizeText(value))
}

function isWarrantyFreeItemSet(items = [], order = {}) {
  if (!(order.charge_type === 'free'
    && Boolean(order.in_warranty)
    && ['in_warranty', 'extended'].includes(normalizeText(order.warranty_status)))) {
    return false
  }
  if (!Array.isArray(items) || !items.length) return false
  return items.every(item => {
    const itemStatus = normalizeText(item && item.warranty_status)
    const status = itemStatus || computeWarrantyState(item).warranty_status
    return normalizeText(item && item.coverage_result) === 'free'
      && isFreeCoverageReason(item && item.coverage_reason)
      && ['in_warranty', 'extended'].includes(status)
  })
}

function buildRepairWarrantyExtension(order = {}, items = [], now = Date.now()) {
  const paymentStatus = normalizeText(order.payment_status || order.paymentStatus)
  const total = Number(order.total_price || order.totalPrice || 0) || 0
  const itemSns = [...new Set((Array.isArray(items) ? items : [])
    .map(item => normalizeText(item && (item.sn || item.serial)))
    .filter(Boolean))]
  const parts = normalizeParts(order).filter(part => {
    if (!itemSns.length) return false
    if (itemSns.length === 1) return !part.deviceSn || normalizeSnKey(part.deviceSn) === normalizeSnKey(itemSns[0])
    return itemSns.some(sn => normalizeSnKey(sn) === normalizeSnKey(part.deviceSn))
  })
  if (total <= 0 || paymentStatus !== 'paid' || !parts.length) return null
  const months = DEFAULT_REPAIR_PART_WARRANTY_MONTHS
  const startDate = formatDate(new Date(now))
  const newExpire = addMonthsToDateStr(startDate, months)
  return {
    months,
    order_no: normalizeText(order.order_no || order.orderNo),
    order_id: normalizeText(order._id || order.order_id || order.orderId),
    scope: 'same_fault_same_replaced_part',
    fault_desc: Array.isArray(items) ? normalizeText(items.map(item => item && item.fault_desc).filter(Boolean).join('；')).slice(0, 500) : '',
    part_codes: [...new Set(parts.map(item => item.code).filter(Boolean))],
    part_names: [...new Set(parts.map(item => item.name).filter(Boolean))],
    device_sn: itemSns.length === 1 ? itemSns[0] : '',
    start_date: startDate,
    new_expire: newExpire,
    create_time: now
  }
}

function appendWarrantyExtension(existing = [], extension = null) {
  const list = Array.isArray(existing) ? existing : []
  if (!extension || list.some(item => normalizeText(item && (item.order_id || item.orderId)) === extension.order_id)) return list
  return [...list, extension]
}

module.exports = {
  DEFAULT_PRODUCT_WARRANTY_MONTHS,
  DEFAULT_REPAIR_PART_WARRANTY_MONTHS,
  addDaysToDateStr,
  addMonthsToDateStr,
  getWarrantyStart,
  getBaseWarrantyExpire,
  getEffectiveWarranty,
  computeWarrantyState,
  isFreeCoverageReason,
  isWarrantyFreeItemSet,
  buildRepairWarrantyExtension,
  appendWarrantyExtension
}
