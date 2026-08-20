const defaultKey = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
const defaultToday = () => new Date().toISOString().slice(0, 10)

export const createManualOrderItem = ({ createKey = defaultKey } = {}) => ({
  key: createKey(),
  product_name: '',
  product_category: '',
  product_model: '',
  sn: '',
  buy_date: '',
  warranty_start_date: '',
  invoice_received_date: '',
  manufacture_date: '',
  warranty_months: 0,
  warranty_expire: '',
  fault_desc: '',
  lookupLoading: false
})

export const createManualOrderDraft = ({ today = defaultToday(), createKey = defaultKey } = {}) => ({
  received_date: today,
  customer: {
    customer_id: '',
    customer_type: 'clinic',
    name: '',
    contact: '',
    phone: '',
    address: '',
    biz_user: ''
  },
  status: 'received',
  ship_out_info: {
    name: '', phone: '', unit: '', detail: '', logistics_company: '', logistics_no: '', received_at: ''
  },
  ship_back_info: { name: '', phone: '', unit: '', detail: '' },
  items: [createManualOrderItem({ createKey })],
  admin_remark: ''
})

export const fillManualOrderShipping = (draft, { overwrite = false } = {}) => {
  const { name, contact, phone, address } = draft.customer
  const value = (next, current) => overwrite ? next : (next || current)
  Object.assign(draft.ship_out_info, {
    name: value(contact, draft.ship_out_info.name),
    phone: value(phone, draft.ship_out_info.phone),
    unit: value(name, draft.ship_out_info.unit),
    detail: value(address, draft.ship_out_info.detail),
    ...(overwrite ? { received_at: draft.received_date } : {})
  })
  Object.assign(draft.ship_back_info, {
    name: value(contact, draft.ship_back_info.name),
    phone: value(phone, draft.ship_back_info.phone),
    unit: value(name, draft.ship_back_info.unit),
    detail: value(address, draft.ship_back_info.detail)
  })
}

const validateManualOrderDraft = (draft, resolveCustomerType) => {
  const customer = draft.customer
  const customerType = resolveCustomerType(customer.customer_type)
  if (!customerType) return '请选择或输入客户类型'
  if (customerType.length > 40) return '客户类型不能超过 40 个字符'
  customer.customer_type = customerType
  if (!customer.name.trim()) return '请填写客户/单位名称'
  if (!customer.contact.trim()) return '请填写联系人'
  if (!/^1\d{10}$/.test(customer.phone.trim())) return '请填写正确的 11 位手机号'
  if (!customer.address.trim()) return '请填写客户地址'
  if (!draft.received_date) return '请选择收件日期'
  if (!draft.items.length) return '请至少添加一台维修设备'
  for (let index = 0; index < draft.items.length; index += 1) {
    const item = draft.items[index]
    const prefix = `设备 ${index + 1}`
    if (!item.product_name.trim()) return `${prefix}：请填写产品名称`
    if (item.product_name.trim().length > 80) return `${prefix}：产品名称不能超过 80 个字符`
    if (!item.product_model.trim()) return `${prefix}：请填写产品型号`
    if (item.product_model.trim().length > 80) return `${prefix}：产品型号不能超过 80 个字符`
    if (!item.sn.trim()) return `${prefix}：请填写设备 SN`
    if (!item.fault_desc.trim()) return `${prefix}：请填写故障描述`
  }
  const out = draft.ship_out_info
  const back = draft.ship_back_info
  if (!out.name.trim() || !/^1\d{10}$/.test(out.phone.trim()) || !out.detail.trim()) return '请完善客户名称、联系方式和客户地址'
  if (!back.name.trim() || !/^1\d{10}$/.test(back.phone.trim()) || !back.detail.trim()) return '请完善客户名称、联系方式和客户地址'
  if (draft.status === 'sent' && !out.logistics_no.trim()) return '运输中工单必须填写寄入物流单号'
  return ''
}

export const prepareManualOrderSubmission = (draft, resolveCustomerType) => {
  fillManualOrderShipping(draft, { overwrite: true })
  const error = validateManualOrderDraft(draft, resolveCustomerType)
  if (error) return { error, payload: null }
  return {
    error: '',
    payload: {
      customer: { ...draft.customer },
      status: draft.status,
      ship_out_info: { ...draft.ship_out_info },
      ship_back_info: { ...draft.ship_back_info },
      items: draft.items.map(({ key, lookupLoading, ...item }) => ({ ...item, warranty_months: 12 })),
      admin_remark: draft.admin_remark
    }
  }
}
