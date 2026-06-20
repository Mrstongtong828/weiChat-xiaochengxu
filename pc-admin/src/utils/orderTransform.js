import { toChineseStatus } from './orderStatus.js'

const normalizeUrlArray = (...values) => {
  return values.reduce((urls, value) => {
    if (Array.isArray(value)) {
      return urls.concat(value)
    }
    if (value) {
      urls.push(value)
    }
    return urls
  }, []).filter(Boolean)
}

const normalizeOrderItems = (order) => {
  const sourceItems = Array.isArray(order.itemsList) && order.itemsList.length
    ? order.itemsList
    : [{
        product_name: order.product_name,
        product_model: order.product_model,
        sn: order.sn,
        buy_date: order.buy_date,
        fault_desc: order.fault_desc,
        media_urls: order.media_urls
      }]

  return sourceItems.map((item = {}) => ({
    _id: item._id,
    product_name: item.product_name || '',
    product_model: item.product_model || '',
    sn: item.sn || '',
    buy_date: item.buy_date || '',
    fault_desc: item.fault_desc || '',
    quantity: item.quantity || 1,
    voucher_urls: normalizeUrlArray(item.voucher_urls, item.voucherUrls),
    image_urls: normalizeUrlArray(item.image_urls, item.imageUrls),
    video_urls: normalizeUrlArray(item.video_urls, item.videoUrls),
    media_urls: normalizeUrlArray(item.media_urls, item.mediaUrls)
  }))
}

const buildItemsSummary = (items) => {
  return items.map((item, index) => {
    const name = item.product_name || item.product_model || `产品${index + 1}`
    const sn = item.sn ? `SN:${item.sn}` : ''
    return [name, sn].filter(Boolean).join(' / ')
  }).join('、')
}

const normalizeQuoteItems = (order) => {
  const rawItems = order.quote_items || order.quoteItems || order.quote?.items || []
  return (Array.isArray(rawItems) ? rawItems : []).map((item = {}) => ({
    name: item.name || item.title || item.projectName || '',
    desc: item.desc || item.description || item.remark || '',
    partsFee: Number(item.parts_fee ?? item.partsFee ?? item.partFee ?? item.materialFee ?? 0) || 0,
    laborFee: Number(item.labor_fee ?? item.laborFee ?? item.workFee ?? item.serviceFee ?? 0) || 0
  }))
}

const normalizeQuoteDetail = (order = {}) => {
  const detail = order.quote_detail || order.quoteDetail || order.quote?.detail || null
  if (!detail || typeof detail !== 'object') return null
  return {
    parts: Array.isArray(detail.parts) ? detail.parts : [],
    services: Array.isArray(detail.services) ? detail.services : [],
    others: Array.isArray(detail.others) ? detail.others : [],
    parts_total: Number(detail.parts_total ?? detail.partsTotal ?? 0) || 0,
    services_total: Number(detail.services_total ?? detail.servicesTotal ?? 0) || 0,
    others_total: Number(detail.others_total ?? detail.othersTotal ?? 0) || 0,
    auto_total: Number(detail.auto_total ?? detail.autoTotal ?? 0) || 0,
    final_price: Number(detail.final_price ?? detail.finalPrice ?? order.total_price ?? order.totalPrice ?? 0) || 0,
    remark: detail.remark || order.quote_remark || order.quoteRemark || ''
  }
}

// 后端工单数据转换为前端格式
export const transformOrder = (order) => {
  if (!order) return null

  const shipOut = order.ship_out_info || {}
  const shipBack = order.ship_back_info || {}
  const invoiceInfo = order.invoice_info || {}
  const quoteDetail = normalizeQuoteDetail(order)
  const quoteItems = normalizeQuoteItems(order)
  const partsFee = Number(order.parts_fee ?? order.partsFee ?? quoteItems.reduce((sum, item) => sum + item.partsFee, 0)) || 0
  const laborFee = Number(order.labor_fee ?? order.laborFee ?? quoteItems.reduce((sum, item) => sum + item.laborFee, 0)) || 0
  const totalPrice = Number(order.total_price ?? order.totalPrice ?? partsFee + laborFee) || 0
  const itemsList = normalizeOrderItems(order)
  const firstItem = itemsList[0] || {}
  const images = normalizeUrlArray(
    order.media_urls,
    firstItem.media_urls,
    ...itemsList.map(item => item.image_urls),
    ...itemsList.map(item => item.video_urls)
  )

  return {
    _id: order._id,
    id: order.order_no || order._id,

    // 报修方信息
    clinicName: shipBack.unit || '',
    customerName: shipBack.name || '',
    phone: shipBack.phone || '',
    address: `${shipBack.region || ''} ${shipBack.detail || ''}`.trim(),

    // 物流信息
    senderName: shipOut.name || '',
    senderPhone: shipOut.phone || '',
    senderUnit: shipOut.unit || '',
    senderAddress: `${shipOut.region || ''} ${shipOut.detail || ''}`.trim(),
    returnAddress: `${shipBack.region || ''} ${shipBack.detail || ''}`.trim(),
    logisticsCompany: shipOut.logistics_company || '',
    logisticsNo: shipOut.logistics_no || '',
    returnCompany: shipBack.logistics_company || '',
    returnNo: shipBack.logistics_no || '',

    // 产品信息（从工单项目中获取）
    productModel: firstItem.product_model || order.product_model || '',
    productName: firstItem.product_name || order.product_name || '',
    fault: firstItem.fault_desc || order.fault_desc || '',
    images,
    itemsList,
    itemsSummary: buildItemsSummary(itemsList),

    // 备注隔离
    adminRemark: order.admin_remark || '',
    printRemark: order.print_remark || '',

    // 状态
    status: toChineseStatus(order.status),
    statusEn: order.status,

    // 工程师和时间线
    engineerId: order.engineer_id || '',
    timeline: order.timeline || [],

    // 报价/付款
    quoteDetail,
    quoteItems,
    quoteStatus: order.quote_status || order.quoteStatus || (totalPrice > 0 ? 'issued' : 'pending'),
    quoteRemark: order.quote_remark || order.quoteRemark || '',
    partsFee,
    laborFee,
    totalPrice,
    authorizationStatus: order.authorization_status || order.authorizationStatus || '',
    authorizationTime: order.authorization_time || order.authorizationTime || '',
    paymentStatus: order.payment_status || order.paymentStatus || '',
    paymentProofs: Array.isArray(order.payment_proofs) ? order.payment_proofs : (order.paymentProofs || []),
    inventoryDeducted: Boolean(order.inventory_deducted || order.inventoryDeducted),
    inventoryStatus: order.inventory_status || order.inventoryStatus || '',
    inventoryDeductTime: order.inventory_deduct_time || order.inventoryDeductTime || '',

    // 发票信息（内部登记，不代表已接入税控开票）
    needInvoice: invoiceInfo.need_invoice || false,
    invoiceTitle: invoiceInfo.title || '',
    taxId: invoiceInfo.tax_no || '',
    invoiceStatus: invoiceInfo.status || '',
    invoiceRemark: invoiceInfo.remark || '',

    // 时间
    submitTime: order.create_time ? new Date(order.create_time).toLocaleString('zh-CN', { hour12: false }) : '',
    updateTime: order.update_time ? new Date(order.update_time).toLocaleString('zh-CN', { hour12: false }) : '',

    // 用户ID
    userId: order.user_id || ''
  }
}

// 批量转换
export const transformOrders = (orders) => {
  return Array.isArray(orders) ? orders.map(transformOrder) : []
}
