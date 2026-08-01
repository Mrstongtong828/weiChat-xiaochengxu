const SUBSCRIPTION_CONFIG_SCENES = Object.freeze([
  { scene: 'repair_submit', title: '报修受理通知', envKey: 'REPAIR_SUBMIT' },
  { scene: 'device_receive_ship', title: '设备取货通知', envKey: 'DEVICE_RECEIVE_SHIP' },
  { scene: 'payment_quote', title: '待支付提醒', envKey: 'PAYMENT_QUOTE' },
  { scene: 'process_tip', title: '设备报修处理进度提醒', envKey: 'PROCESS_TIP' },
  { scene: 'order_finish_invoice', title: '设备维修完成通知', envKey: 'ORDER_FINISH_INVOICE' }
])

const SUBSCRIPTION_TEMPLATE_KEYS = Object.freeze({
  repair_submitted: 'REPAIR_SUBMIT',
  order_received: 'DEVICE_RECEIVE_SHIP',
  order_shipped: 'DEVICE_RECEIVE_SHIP',
  quote_issued: 'PAYMENT_QUOTE',
  payment_confirmed: 'PAYMENT_QUOTE',
  payment_rejected: 'PAYMENT_QUOTE',
  process_tip: 'PROCESS_TIP',
  order_completed: 'ORDER_FINISH_INVOICE'
})

function normalizeText(value) {
  return String(value == null ? '' : value).trim()
}

function truncate(value, limit, fallback = '') {
  return (normalizeText(value) || fallback).slice(0, limit)
}

function toCharacterString(value, fallback = 'PENDING') {
  const text = normalizeText(value).replace(/[^A-Za-z0-9_@.\-+/#()]/g, '')
  return (text || fallback).slice(0, 32)
}

function formatNotifyTime(value = Date.now()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatNotifyTime(Date.now())
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function firstOrderItem(order = {}) {
  const candidates = [
    ...(Array.isArray(order.itemsList) ? order.itemsList : []),
    ...(Array.isArray(order.items) ? order.items : [])
  ]
  return candidates.find(Boolean) || {}
}

function getDeviceName(order = {}) {
  const item = firstOrderItem(order)
  return normalizeText(
    order.product_model || order.device_model || item.product_model ||
    order.product_name || order.device_name || item.product_name
  ) || '维修设备'
}

function getDeviceSerial(order = {}) {
  const item = firstOrderItem(order)
  return normalizeText(order.sn || order.serial_no || order.device_sn || item.sn || item.serial_no)
}

function getOrderNo(order = {}) {
  return toCharacterString(order.order_no || order._id, 'ORDER')
}

function getTrackingNo(info = {}) {
  return toCharacterString(
    info.logistics_no || info.logisticsNo || info.return_no || info.returnNo || info.tracking_no || info.trackingNo,
    'PENDING'
  )
}

function getAddress(info = {}) {
  const region = normalizeText(info.region) || [info.province, info.city, info.district].map(normalizeText).filter(Boolean).join('')
  return [
    region,
    info.address,
    info.detail,
    info.recipient_address,
    info.recipientAddress,
    info.unit
  ].map(normalizeText).filter((value, index, list) => value && list.indexOf(value) === index).join(' ')
}

function getPaymentTime(order = {}, scene = '') {
  if (scene === 'quote_issued') {
    return order.quote_update_time || order.quoteUpdateTime || order.update_time || order.create_time
  }
  return order.payment_update_time || order.paymentUpdateTime || order.update_time || order.create_time
}

function getPaymentTip(scene = '') {
  if (scene === 'payment_confirmed') return '款项已核验到账，将启动维修'
  if (scene === 'payment_rejected') return '付款审核未通过，请重新核对支付'
  return '维修报价已出具，请核对费用后付款'
}

function getInvoiceHint(order = {}) {
  const invoiceInfo = order.invoice_info || order.invoiceInfo || {}
  const status = normalizeText(invoiceInfo.status)
  if (['已开具', '已寄出', '已签收'].includes(status)) return '发票已开具，请到工单下载'
  if (invoiceInfo.need_invoice || status === '待开票' || status === '开具中') return '发票开具后，请到工单下载'
  return '如需发票，请到工单申请'
}

function getRepairResult(order = {}, remark = '') {
  const item = firstOrderItem(order)
  const result = normalizeText(
    order.repair_result || order.repairResult || order.fix_solution || item.fix_solution || remark
  ) || '维修完成'
  const invoiceHint = getInvoiceHint(order)
  const resultLimit = 20 - invoiceHint.length - 1
  return `${result.slice(0, resultLimit)}，${invoiceHint}`
}

function buildSubscriptionData(order = {}, scene = '', remark = '') {
  const deviceName = getDeviceName(order)
  const orderNo = getOrderNo(order)

  if (scene === 'repair_submitted') {
    return {
      thing1: { value: truncate(deviceName, 20) },
      character_string2: { value: orderNo },
      phrase3: { value: '已受理' },
      thing4: { value: '报修已受理，请留意后续进度' }
    }
  }

  if (scene === 'order_received' || scene === 'order_shipped') {
    const isReturn = scene === 'order_shipped'
    const shipInfo = isReturn ? (order.ship_back_info || {}) : (order.ship_out_info || {})
    const warehouseAddress = normalizeText(order.warehouse_address || order.repair_warehouse_address) || '佛山市南海区罗村新光源基地B5座五楼'
    const location = isReturn ? (getAddress(shipInfo) || '诊所收件地址') : warehouseAddress
    return {
      character_string1: { value: orderNo },
      thing3: { value: truncate(location, 20) },
      character_string6: { value: getTrackingNo(shipInfo) },
      thing5: { value: truncate(remark || (isReturn ? '维修设备已回寄' : '寄修设备已签收'), 20) }
    }
  }

  if (scene === 'quote_issued' || scene === 'payment_confirmed' || scene === 'payment_rejected') {
    const amount = Math.max(Number(order.total_price || order.totalPrice || 0) || 0, 0)
    return {
      thing1: { value: truncate(getPaymentTip(scene), 20) },
      thing2: { value: truncate(deviceName, 20) },
      date3: { value: formatNotifyTime(getPaymentTime(order, scene)) },
      amount4: { value: `${amount.toFixed(2)}元` },
      character_string5: { value: orderNo }
    }
  }

  if (scene === 'process_tip') {
    return {
      character_string1: { value: toCharacterString(deviceName, 'DEVICE') },
      character_string2: { value: toCharacterString(getDeviceSerial(order), 'NO-SN') },
      thing3: { value: truncate(remark || '维修工单处理中', 20) }
    }
  }

  if (scene === 'order_completed') {
    return {
      character_string1: { value: orderNo },
      thing3: { value: truncate(deviceName, 20) },
      thing4: { value: getRepairResult(order, remark) }
    }
  }

  throw new Error(`不支持的订阅消息场景：${scene || 'empty'}`)
}

function getSubscriptionTemplateKey(scene = '') {
  return SUBSCRIPTION_TEMPLATE_KEYS[scene] || String(scene || '').trim().toUpperCase()
}

module.exports = {
  SUBSCRIPTION_CONFIG_SCENES,
  SUBSCRIPTION_TEMPLATE_KEYS,
  getSubscriptionTemplateKey,
  buildSubscriptionData,
  formatNotifyTime
}
