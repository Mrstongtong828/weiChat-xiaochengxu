export const CUSTOMER_TYPE_OPTIONS = Object.freeze([
  Object.freeze({ value: 'clinic', label: '门诊/医院', type: 'success' }),
  Object.freeze({ value: 'dealer', label: '代理商/经销商', type: 'warning' })
])

const LEGACY_CUSTOMER_TYPE_META = Object.freeze({
  individual: Object.freeze({ value: 'individual', label: '个人', type: 'info', legacy: true })
})

export const normalizeCustomerTypeValue = (value = '') => String(value ?? '').trim()

const CUSTOMER_TYPE_LABEL_ALIASES = Object.freeze({
  '门诊/医院': 'clinic',
  '代理商/经销商': 'dealer',
  '个人': 'individual'
})

export const resolveCustomerTypeValue = (value = '') => {
  const normalized = normalizeCustomerTypeValue(value)
  return CUSTOMER_TYPE_LABEL_ALIASES[normalized] || normalized
}

export const customerTypeMeta = (value = '') => {
  const normalized = normalizeCustomerTypeValue(value)
  if (!normalized) return null
  return CUSTOMER_TYPE_OPTIONS.find(option => option.value === normalized)
    || LEGACY_CUSTOMER_TYPE_META[normalized]
    || { value: normalized, label: normalized, type: 'info', custom: true }
}

export const customerTypeLabel = (value = '') => {
  const meta = customerTypeMeta(value)
  return meta ? meta.label : ''
}

export const customerTypeOptionsWithCurrent = (value = '') => {
  const current = customerTypeMeta(value)
  if (!current || CUSTOMER_TYPE_OPTIONS.some(option => option.value === current.value)) {
    return CUSTOMER_TYPE_OPTIONS
  }
  return [...CUSTOMER_TYPE_OPTIONS, current]
}
