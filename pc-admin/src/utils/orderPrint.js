const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const clamp = (value, min, max, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback
}

const safeNum = (value = 0) => Number(value || 0) || 0
const money = (value) => '\u00a5' + safeNum(value).toFixed(2)

const DEFAULT_COMPANY_NAME = '佛山市登煌医疗器械有限公司'
const DEFAULT_COMPANY_NAME_EN = 'Foshan CICADA Dental Instrument Co., Ltd.'
const DEFAULT_LOGO_URL = '/brand/cicada-admin-logo.png'
const normalizeCompanyName = (value = '') => String(value || '')
  .replace(/佛山市壹煌医疗器械有限公司/g, DEFAULT_COMPANY_NAME)
  .replace(/壹煌/g, '登煌')
  .slice(0, 80)

const DOC_META = [
  { key: 'repair_order', label: '售后维修单', title: '售后维修单', orientation: 'landscape' },
  { key: 'inspection_report', label: '检测报告单', title: '售后服务检测报告单', orientation: 'landscape' },
  { key: 'quote', label: '报价单', title: '维修报价单', orientation: 'portrait' },
  { key: 'settlement', label: '结算单', title: '维修结算单', orientation: 'portrait' },
  { key: 'parts_outbound', label: '配件出库单', title: '配件出库单', orientation: 'portrait', configurable: false }
]

export const PRINT_DOC_TYPES = DOC_META.filter(item => item.configurable !== false)

const field = (key, label, group, options = {}) => ({
  key,
  label,
  group,
  visible: options.visible !== false,
  width: options.width || 0,
  custom: false
})

const FIELD_DEFINITIONS = {
  repair_order: [
    field('receivedAt', '收货日期', 'meta'),
    field('orderNo', '维修单号', 'meta', { visible: false }),
    field('logisticsNo', '快递单号', 'meta'),
    field('freight', '运费（手填）', 'meta'),
    field('customerName', '客户名称', 'meta'),
    field('supplier', '供货商（手填）', 'meta'),
    field('address', '客户名称/地址', 'meta'),
    field('complaintCode', '投诉编码', 'meta', { visible: false }),
    field('phone', '联系电话', 'meta', { visible: false }),
    field('sequence', '序列号', 'item', { width: 6 }),
    field('productName', '产品名称', 'item', { width: 10 }),
    field('productModel', '型号规格', 'item', { width: 9, visible: false }),
    field('unit', '单位', 'item', { width: 5, visible: false }),
    field('quantity', '数量', 'item', { width: 5, visible: false }),
    field('batchNo', '批号', 'item', { width: 9 }),
    field('partsDetail', '配件明细（手填）', 'item', { width: 13 }),
    field('faultReason', '故障原因', 'item', { width: 13 }),
    field('repairAction', '维修措施', 'item', { width: 17 }),
    field('warrantyScope', '保修范围', 'item', { width: 9 }),
    field('chargeAmount', '收费（元）', 'item', { width: 8 }),
    field('remark', '备注', 'item', { width: 9 }),
    field('receivedParts', '收货配件明细', 'section'),
    field('completedAt', '维修完成日期', 'footer'),
    field('shippedAt', '发货日期', 'footer'),
    field('returnNo', '寄出快递单号', 'footer'),
    field('salesSignature', '售后部', 'signature'),
    field('financeSignature', '财务部', 'signature'),
    field('businessSignature', '业务部', 'signature'),
    field('qualitySignature', '质量部', 'signature'),
    field('serviceSignature', '售后服务部', 'signature', { visible: false })
  ],
  inspection_report: [
    field('receivedAt', '收货日期', 'meta'),
    field('orderNo', '收货单号', 'meta'),
    field('customerName', '客户信息', 'meta'),
    field('phone', '联系电话', 'meta'),
    field('address', '客户地址', 'meta'),
    field('sequence', '序号', 'item', { width: 6 }),
    field('productName', '产品名称', 'item', { width: 14 }),
    field('batchNo', '序列号', 'item', { width: 15 }),
    field('faultReason', '故障描述', 'item', { width: 16 }),
    field('repairAction', '维修措施', 'item', { width: 29 }),
    field('remark', '备注', 'item', { width: 12 }),
    field('reportRemark', '备注说明', 'footer'),
    field('salesSignature', '售后部', 'signature'),
    field('engineeringSignature', '工程部', 'signature'),
    field('qualitySignature', '品质部', 'signature'),
    field('approvalSignature', '审批', 'signature')
  ],
  quote: [
    field('quoteNo', '报价单号', 'info'),
    field('quoteDate', '报价日期', 'info'),
    field('customerName', '客户名称', 'info'),
    field('contactName', '联系人', 'info'),
    field('phone', '联系电话', 'info'),
    field('products', '设备信息', 'info'),
    field('parts', '配件费用', 'section'),
    field('services', '维修服务费', 'section'),
    field('others', '其他费用', 'section'),
    field('partsTotal', '配件小计', 'total'),
    field('servicesTotal', '服务小计', 'total'),
    field('othersTotal', '其他小计', 'total'),
    field('finalPrice', '合计报价', 'total'),
    field('validUntil', '报价有效期', 'footer'),
    field('quoteRemark', '报价说明', 'footer')
  ],
  settlement: [
    field('settlementNo', '结算单号', 'info'),
    field('completedAt', '维修完成日期', 'info'),
    field('customerName', '客户名称', 'info'),
    field('contactName', '联系人', 'info'),
    field('products', '设备信息', 'info'),
    field('partsTotal', '配件费', 'total'),
    field('servicesTotal', '服务费', 'total'),
    field('othersTotal', '其他费用', 'total'),
    field('finalPrice', '结算总额', 'total'),
    field('paymentStatus', '付款状态', 'total'),
    field('paymentMethod', '付款方式', 'total'),
    field('refundStatus', '退款状态', 'total'),
    field('invoiceStatus', '发票状态', 'total'),
    field('settlementRemark', '结算说明', 'footer')
  ],
  parts_outbound: []
}

const baseTemplate = (docType) => {
  const meta = DOC_META.find(item => item.key === docType) || DOC_META[0]
  return {
    version: 2,
    docType: meta.key,
    templateName: '标准模板',
    title: meta.title,
    paperSize: 'A4',
    orientation: meta.orientation,
    copies: 1,
    minRows: ['repair_order', 'inspection_report'].includes(meta.key) ? (meta.key === 'inspection_report' ? 3 : 6) : 1,
    showLogo: true,
    showSignature: true,
    companyName: DEFAULT_COMPANY_NAME,
    companyNameEn: DEFAULT_COMPANY_NAME_EN,
    logoUrl: DEFAULT_LOGO_URL,
    footer: '感谢您的信任！为了您的设备健康，建议定期维护保养。',
    notice: meta.key === 'inspection_report' ? '备注：产品在保修期内如需维修，请按公司产品保修卡执行。' : '',
    watermarkEnabled: false,
    watermarkText: '',
    watermarkOpacity: 0.08,
    fields: (FIELD_DEFINITIONS[meta.key] || []).map(item => ({ ...item }))
  }
}

const toObject = (value) => {
  if (value && typeof value === 'object') return value
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

const normalizeFields = (docType, savedFields) => {
  const defaults = (FIELD_DEFINITIONS[docType] || []).map((item, index) => ({ ...item, order: index }))

  if (!Array.isArray(savedFields)) {
    const legacy = savedFields && typeof savedFields === 'object' ? savedFields : {}
    return defaults.map(item => {
      if (item.key === 'phone' && legacy.showPhone !== undefined) return { ...item, visible: legacy.showPhone !== false }
      if (item.key === 'address' && legacy.showAddress !== undefined) return { ...item, visible: legacy.showAddress !== false }
      if (item.key === 'chargeAmount' && legacy.showCost !== undefined) return { ...item, visible: legacy.showCost !== false }
      return item
    })
  }

  const savedMap = new Map(savedFields.map((item, index) => [item && item.key, { ...item, order: index }]))
  const known = defaults.map(({ order, ...item }) => {
    const saved = savedMap.get(item.key)
    return saved
      ? {
          ...item,
          key: item.key,
          group: item.group,
          custom: false,
          visible: saved.visible !== undefined ? saved.visible !== false : item.visible !== false,
          width: item.width
        }
      : item
  })
  const custom = savedFields
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item && item.custom && item.key && !FIELD_DEFINITIONS[docType]?.some(def => def.key === item.key))
    .map(({ item, index }) => ({
      key: String(item.key),
      label: String(item.label || '自定义项目').slice(0, 30),
      group: item.group === 'item' && ['repair_order', 'inspection_report'].includes(docType) ? 'item' : 'extra',
      visible: item.visible !== false,
      width: clamp(item.width, 4, 30, 10),
      defaultValue: String(item.defaultValue || '').slice(0, 100),
      custom: true,
      order: index
    }))

  return [
    ...known,
    ...custom
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map(({ order, ...item }) => item)
  ]
}

export const defaultPrintTemplate = (docType = 'repair_order') => baseTemplate(docType)

export const parsePrintConfig = (value, docType = 'repair_order') => {
  const obj = toObject(value)
  const resolvedType = DOC_META.some(item => item.key === obj.docType) ? obj.docType : docType
  const base = baseTemplate(resolvedType)
  const legacyHeader = obj.header && !obj.companyName ? obj.header : ''
  return {
    ...base,
    ...obj,
    version: 2,
    docType: resolvedType,
    title: String(obj.title || base.title).slice(0, 60),
    templateName: String(obj.templateName || base.templateName).slice(0, 30),
    paperSize: ['A4', 'A5', 'receipt-80'].includes(obj.paperSize) ? obj.paperSize : base.paperSize,
    orientation: ['portrait', 'landscape'].includes(obj.orientation) ? obj.orientation : base.orientation,
    copies: clamp(obj.copies, 1, 5, 1),
    minRows: clamp(obj.minRows, 1, 12, base.minRows),
    showLogo: obj.showLogo !== false,
    showSignature: obj.showSignature !== false,
    companyName: normalizeCompanyName(obj.companyName || legacyHeader || base.companyName),
    companyNameEn: String(obj.companyNameEn || base.companyNameEn).slice(0, 120),
    logoUrl: String(obj.logoUrl !== undefined ? obj.logoUrl : base.logoUrl).slice(0, 1000),
    footer: String(obj.footer !== undefined ? obj.footer : base.footer).slice(0, 200),
    notice: String(obj.notice !== undefined ? obj.notice : base.notice).slice(0, 1000),
    watermarkEnabled: Boolean(obj.watermarkEnabled),
    watermarkText: String(obj.watermarkText || '').slice(0, 60),
    watermarkOpacity: clamp(obj.watermarkOpacity, 0.03, 0.3, base.watermarkOpacity),
    fields: normalizeFields(resolvedType, obj.fields)
  }
}

export const parsePrintTemplates = (templatesValue, legacyValue) => {
  const raw = toObject(templatesValue)
  const source = raw.documents && typeof raw.documents === 'object' ? raw.documents : raw
  const result = {}
  DOC_META.forEach(({ key }) => {
    if (source[key]) result[key] = parsePrintConfig(source[key], key)
    else if (key === 'repair_order' && legacyValue) result[key] = parsePrintConfig(legacyValue, key)
    else result[key] = defaultPrintTemplate(key)
  })
  return result
}

export const pickPrintTemplate = (templatesValue, legacyValue, docType = 'repair_order') => {
  const templates = parsePrintTemplates(templatesValue, legacyValue)
  return templates[docType] || defaultPrintTemplate(docType)
}

export const formatOrderItems = (items = []) => items.map((item, index) => {
  const lines = [
    '产品' + (index + 1) + ': ' + (item.product_name || '-'),
    '型号: ' + (item.product_model || '-'),
    'SN: ' + (item.sn || '-'),
    '购买日期: ' + (item.buy_date || '-'),
    '故障描述: ' + (item.fault_desc || '-')
  ]
  return lines.join('；')
}).join('\n')

const formatDate = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日'
  }
  return String(value).split(' ')[0]
}

const formatDateTime = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('zh-CN', { hour12: false })
}

const activeFields = (config, group) => (config.fields || [])
  .filter(item => item && item.group === group && item.visible !== false)

const getQuoteSummary = (order = {}) => {
  const detail = order.quoteDetail || order.quote_detail || {}
  const parts = Array.isArray(detail.parts) ? detail.parts : []
  const services = Array.isArray(detail.services) ? detail.services : []
  const others = Array.isArray(detail.others) ? detail.others : []
  const rowTotal = (rows = []) => rows.reduce((sum, item) => {
    const quantity = safeNum(item.quantity ?? item.qty ?? 1) || 1
    const unitPrice = safeNum(item.unitPrice ?? item.unit_price ?? item.price)
    return sum + safeNum(item.amount ?? (unitPrice * quantity))
  }, 0)
  const partsTotal = safeNum(detail.parts_total ?? detail.partsTotal ?? (parts.length ? rowTotal(parts) : (order.partsFee ?? order.parts_fee)))
  const servicesTotal = safeNum(detail.services_total ?? detail.servicesTotal ?? (services.length ? rowTotal(services) : (order.laborFee ?? order.labor_fee)))
  const othersTotal = safeNum(detail.others_total ?? detail.othersTotal ?? rowTotal(others))
  const autoTotal = safeNum(detail.auto_total ?? detail.autoTotal ?? (partsTotal + servicesTotal + othersTotal))
  const finalPrice = safeNum(detail.final_price ?? detail.finalPrice ?? order.totalPrice ?? order.total_price ?? autoTotal)
  return {
    parts,
    services,
    others,
    partsTotal,
    servicesTotal,
    othersTotal,
    autoTotal,
    finalPrice,
    remark: detail.remark || order.quoteRemark || order.quote_remark || ''
  }
}

const PAYMENT_STATUS_LABELS = {
  pending: '待付款',
  unpaid: '未付款',
  uploaded: '待财务审核',
  rejected: '付款凭证已驳回',
  paid: '已付款',
  not_required: '无需付款',
  refunding: '退款中',
  refunded: '已退款',
  partial_refunded: '部分退款',
  waived: '已免单'
}

const PAYMENT_METHOD_LABELS = {
  wechat: '微信支付',
  bank_transfer: '对公转账',
  offline: '线下付款',
  cash: '现金'
}

const REFUND_STATUS_LABELS = {
  processing: '退款处理中',
  refunded: '已退款',
  failed: '退款失败',
  partial_refunded: '部分退款'
}

const paymentLabel = (value = '') => PAYMENT_STATUS_LABELS[value] || (value || '未付款')
const paymentMethodLabel = (value = '') => PAYMENT_METHOD_LABELS[value] || value
const refundLabel = (value = '') => REFUND_STATUS_LABELS[value] || value

const fieldValue = (fieldItem, order, context = {}) => {
  const quote = context.quote || getQuoteSummary(order)
  const values = {
    receivedAt: formatDate(order.receivedTime || order.received_at || order.submitTime),
    orderNo: order.id || order.order_no,
    logisticsNo: order.logisticsNo || order.logistics_no || order.inboundLogisticsNo || '',
    returnNo: order.returnNo || order.return_no || '',
    shippedAt: formatDate(order.shippedAt || order.shipped_at || order.returnShipTime || ''),
    freight: '',
    supplier: '',
    customerName: order.clinicName || order.customerName,
    complaintCode: order.complaintCode || order.complaint_code || '',
    phone: order.phone,
    address: order.address,
    quoteNo: order.quoteNo || order.quote_no || ((order.id || '') + '-BJ'),
    quoteDate: formatDate(order.quoteTime || order.quote_time || new Date()),
    contactName: order.customerName,
    products: formatOrderItems(order.itemsList || []),
    partsTotal: money(quote.partsTotal),
    servicesTotal: money(quote.servicesTotal),
    othersTotal: money(quote.othersTotal),
    finalPrice: money(quote.finalPrice),
    validUntil: formatDate(order.paymentDeadline || order.payment_deadline),
    quoteRemark: quote.remark,
    reportRemark: order.printRemark || order.adminRemark || quote.remark || '',
    settlementNo: order.settlementNo || order.settlement_no || ((order.id || '') + '-JS'),
    completedAt: context.docType === 'repair_order'
      ? ''
      : formatDate(order.completedTime || order.completed_time || order.completeTime || order.complete_time),
    paymentStatus: paymentLabel(order.paymentStatus || order.payment_status),
    paymentMethod: paymentMethodLabel(order.paymentMethod || order.payment_method),
    refundStatus: refundLabel(order.refundStatus || order.refund_status),
    invoiceStatus: order.invoiceStatus || order.invoice_status || (order.needInvoice ? '待开票' : '无需开票'),
    settlementRemark: quote.remark || order.printRemark || ''
  }
  if (fieldItem.custom) return fieldItem.defaultValue || ''
  return values[fieldItem.key] ?? ''
}

const itemValue = (fieldItem, item = {}, index = 0, order = {}) => {
  const coverageMap = {
    free: '质保范围内',
    paid: '保外收费',
    partial: '部分保修',
    not_covered: '不在保修范围',
    pending: '待核验'
  }
  const values = {
    sequence: index + 1,
    productName: item.product_name,
    productModel: item.product_model,
    partsDetail: '',
    unit: item.unit || '台',
    quantity: item.quantity || 1,
    batchNo: item.batch_no || item.batchNo || item.sn || '',
    faultReason: item.fault_reason || item.coverage_note || item.fault_desc,
    repairAction: item.repair_action || item.fix_solution || item.fixSolution || '',
    warrantyScope: item.warranty_scope || coverageMap[item.coverage_result] || item.coverage_result || '',
    chargeAmount: item.charge_amount || item.chargeAmount || '',
    remark: item.repair_remark || item.remark || ''
  }
  if (fieldItem.custom) return item[fieldItem.key] || fieldItem.defaultValue || ''
  if (fieldItem.key === 'chargeAmount' && !values.chargeAmount && index === 0 && (order.itemsList || []).length === 1) {
    const finalPrice = getQuoteSummary(order).finalPrice
    return finalPrice ? finalPrice.toFixed(2) : ''
  }
  return values[fieldItem.key] ?? ''
}

const renderHeader = (config) => {
  const logo = config.showLogo && config.logoUrl
    ? '<img class="document-logo" src="' + escapeHtml(config.logoUrl) + '" alt="CICADA" />'
    : ''
  return `
    <header class="document-header">
      <div class="document-brand">${logo}</div>
      <div class="company-lockup">
        <strong>${escapeHtml(config.companyName)}</strong>
        <span>${escapeHtml(config.companyNameEn)}</span>
      </div>
      <div class="document-brand-spacer"></div>
    </header>
    <h1 class="document-title">${escapeHtml(config.title)}</h1>
  `
}

const renderWatermark = (config) => config.watermarkEnabled && config.watermarkText
  ? '<div class="watermark" style="opacity:' + escapeHtml(config.watermarkOpacity) + '">' + escapeHtml(config.watermarkText) + '</div>'
  : ''

const renderDocumentFooter = (config) => `
  <footer class="document-footer">
    <span>${escapeHtml(config.footer || '')}</span>
    <span>打印时间：${escapeHtml(new Date().toLocaleString('zh-CN', { hour12: false }))}</span>
  </footer>
`

const renderInfoTable = (fields, order, context = {}) => {
  if (!fields.length) return ''
  return '<table class="info-table"><tbody>' + fields.map(item =>
    '<tr><th>' + escapeHtml(item.label) + '</th><td>' + escapeHtml(fieldValue(item, order, context) || '-') + '</td></tr>'
  ).join('') + '</tbody></table>'
}

const renderPairedMetaTable = (fields, order) => {
  if (!fields.length) return ''
  const rows = []
  for (let index = 0; index < fields.length; index += 2) {
    const first = fields[index]
    const second = fields[index + 1]
    rows.push(`
      <tr>
        <th>${escapeHtml(first.label)}</th>
        <td>${escapeHtml(fieldValue(first, order) || '')}</td>
        ${second
          ? '<th>' + escapeHtml(second.label) + '</th><td>' + escapeHtml(fieldValue(second, order) || '') + '</td>'
          : '<th></th><td></td>'}
      </tr>
    `)
  }
  return '<table class="repair-meta"><tbody>' + rows.join('') + '</tbody></table>'
}

const renderCustomFields = (config, order) => {
  const fields = activeFields(config, 'extra')
  if (!fields.length) return ''
  return '<div class="document-group"><div class="group-heading">补充项目</div>' + renderInfoTable(fields, order) + '</div>'
}

const normalizeReceivedParts = (order = {}) => {
  const rows = Array.isArray(order.receivedParts)
    ? order.receivedParts
    : (Array.isArray(order.received_parts) ? order.received_parts : [])
  return rows.map(item => ({
    name: item && (item.name || item.part_name) || '',
    quantity: safeNum(item && (item.quantity ?? item.qty)) || 0,
    remark: item && (item.remark || item.note) || ''
  })).filter(item => item.name || item.remark)
}

const normalizeReceivedPartPhotos = (order = {}) => {
  const photos = Array.isArray(order.receivedPartPhotos)
    ? order.receivedPartPhotos
    : (Array.isArray(order.received_part_photos) ? order.received_part_photos : [])
  return photos.map(photo => {
    if (photo && typeof photo === 'object') return photo.url || photo.previewUrl || photo.tempUrl || photo.fileID || ''
    return String(photo || '')
  }).filter(url => url && !url.startsWith('cloud://'))
}

const renderReceivedPartsSection = (order = {}) => {
  const parts = normalizeReceivedParts(order)
  const receipt = order.receivedPartsReceipt || order.received_parts_receipt || {}
  const photoUrls = normalizeReceivedPartPhotos(order)
  const rows = parts.length
    ? parts.map(item => `<tr><td>${escapeHtml(item.name || '-')}</td><td class="number-cell">${escapeHtml(item.quantity || '-')}</td><td>${escapeHtml(item.remark || '-')}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty-note">暂无收货配件明细</td></tr>'
  const receiptText = receipt.status === 'confirmed'
    ? `已确认签收　签收人：${receipt.confirmed_by_name || '-'}　时间：${formatDateTime(receipt.confirmed_at) || '-'}`
    : '待确认签收'
  const photos = photoUrls.length
    ? `<div class="received-part-print-photos"><span>拍照凭证</span>${photoUrls.map(url => `<img src="${escapeHtml(url)}" alt="收货配件凭证" />`).join('')}</div>`
    : '<div class="received-part-print-photo-note">拍照凭证：暂无可访问缩略图</div>'
  return `
    <div class="document-group received-part-print-group">
      <div class="group-heading">收货配件明细</div>
      <table class="line-items received-part-print-table">
        <thead><tr><th>配件名称</th><th>数量</th><th>备注</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="received-part-print-receipt">${escapeHtml(receiptText)}</div>
      ${photos}
    </div>
  `
}

const buildRepairSection = (order, config) => {
  const metaFields = activeFields(config, 'meta')
  const itemFields = activeFields(config, 'item')
  const sectionFields = activeFields(config, 'section')
  const footerFields = activeFields(config, 'footer')
  const signatureFields = activeFields(config, 'signature')
  const sourceItems = Array.isArray(order.itemsList) ? order.itemsList : []
  const rowCount = Math.max(sourceItems.length, config.minRows)
  const rows = Array.from({ length: rowCount }, (_, index) => sourceItems[index] || {})
  const totalWidth = itemFields.reduce((sum, item) => sum + safeNum(item.width), 0) || 100
  const colgroup = itemFields.map(item => {
    const width = item.width ? (safeNum(item.width) / totalWidth * 100).toFixed(2) : ''
    return '<col' + (width ? ' style="width:' + width + '%"' : '') + ' />'
  }).join('')
  const itemTable = itemFields.length
    ? `
      <table class="repair-items">
        <colgroup>${colgroup}</colgroup>
        <thead><tr>${itemFields.map(item => '<th>' + escapeHtml(item.label) + '</th>').join('')}</tr></thead>
        <tbody>
          ${rows.map((item, index) => '<tr>' + itemFields.map(fieldItem =>
            '<td>' + escapeHtml(itemValue(fieldItem, item, index, order)) + '</td>'
          ).join('') + '</tr>').join('')}
        </tbody>
      </table>
    `
    : ''
  const completion = footerFields.length
    ? '<table class="repair-completion"><tbody>' + footerFields.map(item =>
        '<tr><th>' + escapeHtml(item.label) + '</th><td>' + escapeHtml(fieldValue(item, order, { docType: 'repair_order' }) || '') + '</td></tr>'
      ).join('') + '</tbody></table>'
    : ''
  const signatures = config.showSignature && signatureFields.length
    ? '<div class="department-signatures">' + signatureFields.map(item =>
        '<span><b>' + escapeHtml(item.label) + '：</b>' + escapeHtml(fieldValue(item, order) || '') + '</span>'
      ).join('') + '</div>'
    : ''

  return `
    <section class="print-section repair-sheet">
      ${renderWatermark(config)}
      ${renderHeader(config)}
      ${renderPairedMetaTable(metaFields, order)}
      ${itemTable}
      ${sectionFields.some(item => item.key === 'receivedParts') ? renderReceivedPartsSection(order) : ''}
      ${completion}
      ${renderCustomFields(config, order)}
      ${signatures}
      ${renderDocumentFooter(config)}
    </section>
  `
}

const findActiveField = (config, key) => activeFields(config, 'meta')
  .concat(activeFields(config, 'footer'))
  .find(item => item.key === key)

const inspectionValue = (config, key, order) => {
  const item = findActiveField(config, key)
  return item ? fieldValue(item, order, { docType: 'inspection_report' }) : ''
}

const inspectionLabel = (config, key, fallback) => findActiveField(config, key)?.label || fallback

const getInspectionParts = (order = {}) => {
  const repairParts = Array.isArray(order.repairRecord?.parts) ? order.repairRecord.parts : []
  return repairParts.map(item => normalizeLineItem(item, '配件'))
}

const buildInspectionReportSection = (order, config) => {
  const itemFields = activeFields(config, 'item')
  const signatureFields = activeFields(config, 'signature')
  const sourceItems = Array.isArray(order.itemsList) ? order.itemsList : []
  const itemRows = Array.from({ length: Math.max(sourceItems.length, config.minRows) }, (_, index) => sourceItems[index] || {})
  const parts = getInspectionParts(order)
  const partRows = Array.from({ length: Math.max(parts.length, 6) }, (_, index) => parts[index] || null)
  const customerLine = [
    inspectionValue(config, 'customerName', order),
    inspectionValue(config, 'phone', order),
    inspectionValue(config, 'address', order)
  ].filter(Boolean).join('　')
  const reportRemark = inspectionValue(config, 'reportRemark', order)
  const notice = config.notice || '备注：产品在保修期内如需维修，请按公司产品保修卡执行。'

  return `
    <section class="print-section inspection-report-sheet">
      ${renderWatermark(config)}
      ${renderHeader(config)}
      <table class="inspection-meta"><tbody>
        <tr>
          <th>${escapeHtml(inspectionLabel(config, 'receivedAt', '收货日期'))}</th>
          <td>${escapeHtml(inspectionValue(config, 'receivedAt', order))}</td>
          <th>${escapeHtml(inspectionLabel(config, 'orderNo', '收货单号'))}</th>
          <td>${escapeHtml(inspectionValue(config, 'orderNo', order))}</td>
        </tr>
        <tr>
          <th>${escapeHtml(inspectionLabel(config, 'customerName', '客户信息'))}</th>
          <td colspan="3">${escapeHtml(customerLine)}</td>
        </tr>
      </tbody></table>
      <table class="inspection-items">
        <colgroup>${itemFields.map(item => '<col style="width:' + (safeNum(item.width) || 10) + '%" />').join('')}</colgroup>
        <thead><tr>${itemFields.map(item => '<th>' + escapeHtml(item.label) + '</th>').join('')}</tr></thead>
        <tbody>${itemRows.map((item, index) => '<tr>' + itemFields.map(fieldItem =>
          '<td>' + escapeHtml(itemValue(fieldItem, item, index, order)) + '</td>'
        ).join('') + '</tr>').join('')}</tbody>
      </table>
      <table class="inspection-parts">
        <thead>
          <tr><th rowspan="${partRows.length + 1}" class="parts-side-title">更换配件清单</th><th>配件名称</th><th>单位</th><th>数量</th><th>单价（手填）</th><th>金额（手填）</th><th>备注</th></tr>
        </thead>
        <tbody>
          ${partRows.map(part => `
            <tr>
              <td>${escapeHtml(part?.name || '')}</td>
              <td>${escapeHtml(part?.unit || '')}</td>
              <td>${escapeHtml(part?.quantity || '')}</td>
              <td></td>
              <td></td>
              <td>${escapeHtml(part?.spec || '')}</td>
            </tr>
          `).join('')}
          <tr><th colspan="5" class="amount-total">合计金额（手填）：</th><td colspan="2"></td></tr>
        </tbody>
      </table>
      ${reportRemark ? '<div class="inspection-remark"><b>备注：</b>' + escapeHtml(reportRemark) + '</div>' : ''}
      <div class="inspection-notice">${escapeHtml(notice)}</div>
      ${config.showSignature && signatureFields.length ? '<div class="department-signatures inspection-signatures">' + signatureFields.map(item =>
        '<span><b>' + escapeHtml(item.label) + '：</b></span>'
      ).join('') + '</div>' : ''}
    </section>
  `
}

const normalizeLineItem = (item = {}, fallbackName = '项目') => {
  const name = item.name || item.part_name || item.partName || item.title || fallbackName
  const spec = item.spec || item.model || item.product_model || item.productCategory || item.desc || ''
  const quantity = safeNum(item.quantity ?? item.qty ?? 1) || 1
  const unitPrice = safeNum(item.unitPrice ?? item.unit_price ?? item.price)
  const amount = safeNum(item.amount ?? (unitPrice * quantity))
  return { name, spec, unit: item.unit || '', quantity, unitPrice, amount }
}

const renderLineItems = (label, rows, fallbackName) => {
  const normalized = (rows || []).map(item => normalizeLineItem(item, fallbackName))
  if (!normalized.length) return '<div class="empty-note">' + escapeHtml(label) + '：暂无明细</div>'
  return `
    <div class="document-group">
      <div class="group-heading">${escapeHtml(label)}</div>
      <table class="line-items">
        <thead><tr><th>项目</th><th>规格/说明</th><th>单价（元）</th><th>数量</th><th>金额（元）</th></tr></thead>
        <tbody>
          ${normalized.map(item => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${escapeHtml(item.spec || '-')}</td>
              <td class="number-cell">${escapeHtml(item.unitPrice.toFixed(2))}</td>
              <td class="number-cell">${escapeHtml(item.quantity)}</td>
              <td class="number-cell">${escapeHtml(item.amount.toFixed(2))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

const buildQuoteSection = (order, config) => {
  const quote = getQuoteSummary(order)
  const infoFields = activeFields(config, 'info')
  const sectionFields = activeFields(config, 'section')
  const totalFields = activeFields(config, 'total')
  const footerFields = activeFields(config, 'footer')
  const sectionRows = {
    parts: [quote.parts, '配件'],
    services: [quote.services, '服务'],
    others: [quote.others, '其他']
  }
  const sections = sectionFields.map(item => {
    const [rows, fallback] = sectionRows[item.key] || [[], '项目']
    return renderLineItems(item.label, rows, fallback)
  }).join('')
  const footer = footerFields.length
    ? '<div class="document-group">' + renderInfoTable(footerFields, order, { quote }) + '</div>'
    : ''

  return `
    <section class="print-section">
      ${renderWatermark(config)}
      ${renderHeader(config)}
      ${renderInfoTable(infoFields, order, { quote })}
      ${sections}
      <div class="document-group">
        <div class="group-heading">费用合计</div>
        ${renderInfoTable(totalFields, order, { quote })}
      </div>
      ${footer}
      ${renderCustomFields(config, order)}
      ${config.showSignature ? '<div class="signature-line">客户确认签字：____________　　报价人：____________　　日期：____________</div>' : ''}
      ${renderDocumentFooter(config)}
    </section>
  `
}

const buildSettlementSection = (order, config) => {
  const quote = getQuoteSummary(order)
  const infoFields = activeFields(config, 'info')
  const totalFields = activeFields(config, 'total')
  const footerFields = activeFields(config, 'footer')
  return `
    <section class="print-section">
      ${renderWatermark(config)}
      ${renderHeader(config)}
      ${renderInfoTable(infoFields, order, { quote })}
      <div class="document-group">
        <div class="group-heading">费用结算</div>
        ${renderInfoTable(totalFields, order, { quote })}
      </div>
      ${footerFields.length ? '<div class="document-group">' + renderInfoTable(footerFields, order, { quote }) + '</div>' : ''}
      ${renderCustomFields(config, order)}
      ${config.showSignature ? '<div class="signature-line">工程师签字：____________　　客户签收：____________　　日期：____________</div>' : ''}
      ${renderDocumentFooter(config)}
    </section>
  `
}

const buildPartsOutboundSection = (order, config) => {
  const quote = getQuoteSummary(order)
  const parts = (quote.parts || []).map(item => normalizeLineItem(item, '配件'))
  const body = parts.length
    ? renderLineItems('出库配件明细', quote.parts, '配件')
    : '<div class="empty-note">该工单暂未登记配件用料</div>'
  return `
    <section class="print-section">
      ${renderWatermark(config)}
      ${renderHeader(config)}
      <table class="info-table"><tbody>
        <tr><th>关联工单</th><td>${escapeHtml(order.id || '-')}</td></tr>
        <tr><th>领用单位</th><td>${escapeHtml(order.clinicName || '-')}</td></tr>
        <tr><th>出库日期</th><td>${escapeHtml(formatDate(new Date()))}</td></tr>
      </tbody></table>
      ${body}
      ${config.showSignature ? '<div class="signature-line">出库人签字：____________　　领用人签字：____________</div>' : ''}
      ${renderDocumentFooter(config)}
    </section>
  `
}

const buildSection = (order, config, docType) => {
  if (docType === 'inspection_report') return buildInspectionReportSection(order, config)
  if (docType === 'quote') return buildQuoteSection(order, config)
  if (docType === 'settlement') return buildSettlementSection(order, config)
  if (docType === 'parts_outbound') return buildPartsOutboundSection(order, config)
  return buildRepairSection(order, config)
}

const pageSizeCss = (config) => {
  if (config.paperSize === 'receipt-80') return '@page { size: 80mm auto; margin: 4mm; }'
  return '@page { size: ' + config.paperSize + ' ' + config.orientation + '; margin: ' + (config.orientation === 'landscape' ? '8mm' : '12mm') + '; }'
}

const previewScaleCss = (config) => config.orientation === 'landscape'
  ? `
      body.preview-mode { min-width: 1120px; zoom: .56; }
      @media screen and (max-width: 680px) { body.preview-mode { zoom: .48; } }
      @media screen and (max-width: 560px) { body.preview-mode { zoom: .40; } }
      @media screen and (max-width: 460px) { body.preview-mode { zoom: .34; } }
    `
  : `
      body.preview-mode { min-width: 820px; zoom: .76; }
      @media screen and (max-width: 680px) { body.preview-mode { zoom: .68; } }
      @media screen and (max-width: 560px) { body.preview-mode { zoom: .58; } }
      @media screen and (max-width: 460px) { body.preview-mode { zoom: .49; } }
    `

const autoPrintScript = (enabled) => enabled ? `
        <script>
          (() => {
            let started = false;
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            const waitForImages = () => Promise.all(Array.from(document.images || []).map(image => {
              if (image.complete) return Promise.resolve();
              return new Promise(resolve => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
              });
            }));
            const waitForFonts = () => document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
            const doPrint = () => {
              if (started || window.__cicadaPrintStarted) return;
              started = true;
              window.__cicadaPrintStarted = true;
              window.focus();
              window.print();
            };
            const schedulePrint = () => Promise.race([
              Promise.all([waitForImages(), waitForFonts()]),
              delay(2500)
            ]).then(() => delay(250)).then(doPrint).catch(() => delay(250).then(doPrint));
            if (document.readyState === 'complete') schedulePrint();
            else window.addEventListener('load', schedulePrint, { once: true });
          })();
        </script>
  ` : ''

const renderPrintToolbar = (enabled) => enabled ? `
    <div class="print-toolbar">
      <button type="button" class="print-toolbar-button print-toolbar-button--primary" onclick="window.print()">打印</button>
      <button type="button" class="print-toolbar-button" onclick="window.close()">关闭</button>
    </div>
  ` : ''

export const buildPrintHtml = (printOrders = [], rawConfig = {}, docType = 'repair_order', options = {}) => {
  const config = parsePrintConfig(rawConfig, docType)
  const copies = clamp(config.copies, 1, 5, 1)
  const expandedOrders = Array.from({ length: copies }).flatMap(() => printOrders)
  const previewClass = options.preview ? 'preview-mode' : ''
  const showToolbar = Boolean(options.printToolbar)
  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(config.title)}-${escapeHtml(printOrders.map(item => item.id).filter(Boolean).join('_'))}</title>
        <style>
          ${pageSizeCss(config)}
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body { color: #111; background: #fff; font-family: "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif; }
          body.preview-mode { background: #eef1f5; padding: 18px; }
          body.preview-mode .print-section { background: #fff; box-shadow: 0 8px 24px rgba(15, 23, 42, .12); margin: 0 auto 18px; }
          .print-section { position: relative; width: 100%; min-height: 100%; page-break-after: always; break-after: page; }
          .print-section:last-child { page-break-after: auto; break-after: auto; }
          .document-header { min-height: 17mm; display: grid; grid-template-columns: 27% 46% 27%; align-items: center; border-bottom: 1px solid #111; }
          .document-brand { display: flex; align-items: center; justify-content: flex-start; padding: 2mm 3mm; min-width: 0; }
          .document-logo { display: block; max-width: 45mm; max-height: 12mm; object-fit: contain; }
          .company-lockup { text-align: center; line-height: 1.25; }
          .company-lockup strong { display: block; font-family: SimSun, "Songti SC", serif; font-size: 15pt; letter-spacing: 1px; }
          .company-lockup span { display: block; margin-top: 1.5mm; font-family: Consolas, monospace; font-size: 11pt; font-weight: 700; letter-spacing: 1px; }
          .document-title { margin: 0; padding: 1.5mm 0; border-bottom: 1px solid #111; text-align: center; font-family: SimSun, "Songti SC", serif; font-size: 14pt; letter-spacing: 8px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #111; padding: 2mm 2.2mm; font-size: 10pt; line-height: 1.35; vertical-align: middle; word-break: break-word; white-space: pre-line; }
          th { background: #f7f7f7; font-weight: 600; }
          .repair-meta th { width: 12%; font-family: SimSun, "Songti SC", serif; font-size: 11pt; text-align: left; }
          .repair-meta td { width: 38%; text-align: center; font-family: SimSun, "Songti SC", serif; font-size: 11pt; }
          .repair-items th { padding: 1.6mm 1mm; text-align: center; font-family: SimSun, "Songti SC", serif; font-size: 10.5pt; }
          .repair-items td { height: 13mm; padding: 1.5mm 1mm; text-align: center; }
          .repair-items td:nth-child(n+7) { text-align: left; }
          .repair-completion th { width: 16%; text-align: left; font-family: SimSun, "Songti SC", serif; font-size: 11pt; }
          .repair-completion td { height: 8mm; }
          .department-signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8mm; padding: 8mm 1mm 5mm; font-family: SimSun, "Songti SC", serif; font-size: 11pt; }
          .department-signatures span { min-height: 8mm; border-bottom: 1px solid #777; }
          .inspection-report-sheet .document-header { min-height: 20mm; }
          .inspection-report-sheet .document-title { font-size: 15pt; }
          .inspection-meta th { width: 12%; text-align: left; font-family: SimSun, "Songti SC", serif; }
          .inspection-meta td { width: 38%; font-family: SimSun, "Songti SC", serif; }
          .inspection-items th, .inspection-parts th { padding: 1.5mm 1mm; text-align: center; font-family: SimSun, "Songti SC", serif; }
          .inspection-items td { height: 16mm; padding: 1.5mm 1mm; text-align: center; }
          .inspection-items td:nth-child(n+4) { text-align: left; }
          .inspection-parts td { height: 7mm; padding: 1.3mm 1mm; text-align: center; }
          .inspection-parts .parts-side-title { width: 10%; writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 1mm; }
          .inspection-parts .amount-total { text-align: right; }
          .inspection-remark { min-height: 10mm; border: 1px solid #111; border-top: 0; padding: 2mm; font-size: 9.5pt; }
          .inspection-notice { margin-top: 4mm; font-family: SimSun, "Songti SC", serif; font-size: 9.5pt; line-height: 1.7; }
          .inspection-signatures { padding-top: 7mm; }
          .info-table { margin-top: 4mm; }
          .info-table th { width: 28%; text-align: left; }
          .info-table td { width: 72%; }
          .document-group { margin-top: 5mm; }
          .group-heading { margin-bottom: 2mm; padding-left: 2.5mm; border-left: 3px solid #165dff; font-size: 11pt; font-weight: 700; }
          .line-items th { text-align: center; }
          .line-items td { font-size: 9.5pt; }
          .number-cell { text-align: right; white-space: nowrap; }
          .empty-note { margin: 5mm 0; padding: 4mm; border: 1px dashed #aaa; color: #666; font-size: 10pt; }
          .received-part-print-table th, .received-part-print-table td { font-size: 9.5pt; }
          .received-part-print-table th:nth-child(1) { width: 35%; }
          .received-part-print-table th:nth-child(2) { width: 15%; }
          .received-part-print-table th:nth-child(3) { width: 50%; }
          .received-part-print-receipt, .received-part-print-photo-note { margin-top: 2mm; color: #444; font-size: 9pt; }
          .received-part-print-photos { display: flex; align-items: center; flex-wrap: wrap; gap: 2mm; margin-top: 2mm; color: #444; font-size: 9pt; }
          .received-part-print-photos img { width: 22mm; height: 22mm; border: 1px solid #bbb; object-fit: cover; }
          .signature-line { margin-top: 10mm; display: flex; justify-content: space-between; font-size: 10.5pt; }
          .document-footer { margin-top: 7mm; padding-top: 2mm; border-top: 1px solid #bbb; display: flex; justify-content: space-between; gap: 10mm; color: #555; font-size: 8.5pt; }
          .watermark { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-28deg); z-index: 0; color: #000; font-size: 46pt; font-weight: 800; white-space: nowrap; pointer-events: none; }
          .print-toolbar { position: fixed; right: 18px; top: 18px; z-index: 20; display: flex; gap: 8px; padding: 8px; border: 1px solid #d8dee8; border-radius: 8px; background: rgba(255, 255, 255, .96); box-shadow: 0 8px 24px rgba(15, 23, 42, .16); }
          .print-toolbar-button { height: 34px; padding: 0 14px; border: 1px solid #d8dee8; border-radius: 6px; background: #fff; color: #1f2937; font-size: 14px; font-family: "Microsoft YaHei", Arial, sans-serif; cursor: pointer; }
          .print-toolbar-button--primary { border-color: #165dff; background: #165dff; color: #fff; }
          .print-section > *:not(.watermark) { position: relative; z-index: 1; }
          thead { display: table-header-group; }
          tr, td, th { break-inside: avoid; page-break-inside: avoid; }
          @media screen {
            body.preview-mode .print-section { padding: 8mm; max-width: ${config.orientation === 'landscape' ? '297mm' : '210mm'}; min-height: ${config.orientation === 'landscape' ? '210mm' : '297mm'}; }
          }
          ${previewScaleCss(config)}
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-toolbar { display: none !important; }
          }
        </style>
      </head>
      <body class="${previewClass}">
        ${renderPrintToolbar(showToolbar)}
        ${expandedOrders.map(order => buildSection(order, config, docType)).join('')}
        ${autoPrintScript(Boolean(options.autoPrint))}
      </body>
    </html>
  `
}

const invokePrint = (printWindow) => {
  if (!printWindow || printWindow.closed || printWindow.__cicadaPrintStarted) return
  printWindow.__cicadaPrintStarted = true
  printWindow.focus()
  printWindow.print()
}

const waitForDocumentAssets = (printWindow) => {
  const documentRef = printWindow && printWindow.document
  if (!documentRef) return Promise.resolve()
  const images = Array.from(documentRef.images || [])
  if (!images.length) return Promise.resolve()
  const waits = images.map(image => {
    if (image.complete) return Promise.resolve()
    return new Promise(resolve => {
      const done = () => resolve()
      image.addEventListener('load', done, { once: true })
      image.addEventListener('error', done, { once: true })
    })
  })
  return Promise.race([
    Promise.all(waits),
    new Promise(resolve => setTimeout(resolve, 2500))
  ])
}

const openDocumentWindow = (printOrders, rawConfig, docType, shouldPrint) => {
  if (!printOrders.length) return true
  const printWindow = window.open('', '_blank', 'width=1100,height=760')
  if (!printWindow) return false

  printWindow.document.open()
  printWindow.document.write(buildPrintHtml(printOrders, rawConfig, docType, {
    preview: !shouldPrint,
    autoPrint: shouldPrint,
    printToolbar: shouldPrint
  }))
  printWindow.document.close()

  if (shouldPrint) {
    waitForDocumentAssets(printWindow).then(() => {
      if (printWindow.closed) return
      setTimeout(() => invokePrint(printWindow), 400)
    })
  } else {
    printWindow.focus()
  }
  return true
}

export const openPrintWindow = (printOrders = [], rawConfig = {}, docType = 'repair_order') => {
  return openDocumentWindow(printOrders, rawConfig, docType, true)
}

export const openPrintPreviewWindow = (printOrders = [], rawConfig = {}, docType = 'repair_order') => {
  return openDocumentWindow(printOrders, rawConfig, docType, false)
}

export const createPrintPreviewHtml = (order, rawConfig = {}, docType = 'repair_order') => {
  return buildPrintHtml([order], rawConfig, docType, { preview: true })
}
