const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const defaultFields = () => ({ showPhone: true, showAddress: true, showCost: false })

const defaultPrintConfig = {
  title: '设备维修回寄单',
  paperSize: 'A4',
  copies: 1,
  showSignature: true,
  footer: '感谢您的信任！为了您的设备健康，建议定期维护保养。',
  header: '',
  logoUrl: '',
  watermarkEnabled: false,
  watermarkText: '',
  watermarkOpacity: 0.12,
  fields: defaultFields()
}

// 四类打印模板默认配置
export const PRINT_DOC_TYPES = [
  { key: 'repair_order', label: '报修工单', title: '设备维修回寄单' },
  { key: 'quote', label: '维修报价单', title: '设备维修报价单' },
  { key: 'settlement', label: '竣工结算单', title: '设备维修结算单' },
  { key: 'parts_outbound', label: '配件出库单', title: '配件出库单' }
]

export const defaultPrintTemplate = (docType = 'repair_order') => {
  const meta = PRINT_DOC_TYPES.find(item => item.key === docType)
  return { ...defaultPrintConfig, title: (meta && meta.title) || defaultPrintConfig.title, fields: defaultFields() }
}

export const parsePrintConfig = (value) => {
  let obj = {}
  if (value && typeof value === 'object') obj = value
  else if (value) {
    try { obj = JSON.parse(value) } catch (error) { obj = {} }
  }
  return { ...defaultPrintConfig, ...obj, fields: { ...defaultFields(), ...(obj.fields || {}) } }
}

// 解析多模板配置（print_templates），按 docType 返回模板，缺失时回退到 legacyValue / 默认
export const parsePrintTemplates = (templatesValue, legacyValue) => {
  let templates = {}
  if (templatesValue && typeof templatesValue === 'object') templates = templatesValue
  else if (templatesValue) {
    try { templates = JSON.parse(templatesValue) } catch (error) { templates = {} }
  }
  const result = {}
  PRINT_DOC_TYPES.forEach(({ key }) => {
    const base = templates[key]
    if (base) {
      result[key] = parsePrintConfig(base)
    } else if (key === 'repair_order' && legacyValue) {
      result[key] = parsePrintConfig(legacyValue)
    } else {
      result[key] = defaultPrintTemplate(key)
    }
  })
  return result
}

export const pickPrintTemplate = (templatesValue, legacyValue, docType = 'repair_order') => {
  return parsePrintTemplates(templatesValue, legacyValue)[docType] || defaultPrintTemplate(docType)
}

export const formatOrderItems = (items = []) => {
  return items.map((item, index) => {
    const lines = [
      `产品${index + 1}: ${item.product_name || '-'}`,
      `型号: ${item.product_model || '-'}`,
      `SN: ${item.sn || '-'}`,
      `购买日期: ${item.buy_date || '-'}`,
      `故障描述: ${item.fault_desc || '-'}`
    ]
    return lines.join('；')
  }).join('\n')
}

const safeNum = (value = 0) => Number(value || 0) || 0

const getQuoteSummary = (order = {}) => {
  const detail = order.quoteDetail || order.quote_detail || {}
  const parts = Array.isArray(detail.parts) ? detail.parts : []
  const services = Array.isArray(detail.services) ? detail.services : []
  const others = Array.isArray(detail.others) ? detail.others : []
  const rowTotal = (rows = []) => rows.reduce((sum, item) => sum + safeNum(item.amount || (safeNum(item.unitPrice || item.unit_price) * safeNum(item.quantity || 0))), 0)
  const partsTotal = safeNum(detail.parts_total ?? detail.partsTotal ?? rowTotal(parts) ?? order.partsFee ?? order.parts_fee)
  const servicesTotal = safeNum(detail.services_total ?? detail.servicesTotal ?? rowTotal(services) ?? order.laborFee ?? order.labor_fee)
  const othersTotal = safeNum(detail.others_total ?? detail.othersTotal ?? rowTotal(others))
  const autoTotal = safeNum(detail.auto_total ?? detail.autoTotal ?? (partsTotal + servicesTotal + othersTotal))
  const finalPrice = safeNum(detail.final_price ?? detail.finalPrice ?? order.totalPrice ?? order.total_price ?? autoTotal)
  return { parts, services, others, partsTotal, servicesTotal, othersTotal, autoTotal, finalPrice, remark: detail.remark || order.quoteRemark || order.quote_remark || '' }
}

const getPaperStyle = (paperSize) => {
  if (paperSize === 'A5') return '@page { size: A5; margin: 12mm; } body { margin: 12mm; }'
  if (paperSize === 'receipt-80') return '@page { size: 80mm auto; margin: 4mm; } body { margin: 4mm; } td { font-size: 12px; }'
  return '@page { size: A4; margin: 18mm; } body { margin: 18mm; }'
}

const buildPrintSection = (order, config) => {
  const fields = config.fields || defaultFields()
  const quoteSummary = getQuoteSummary(order)
  const quoteLines = [
    quoteSummary.parts.length ? `配件费用\n${quoteSummary.parts.map((item, index) => `${index + 1}. ${item.name || item.part_name || '配件'} x${safeNum(item.quantity || 0)} = ¥${safeNum(item.amount || 0).toFixed(2)}`).join('\n')}` : '',
    quoteSummary.services.length ? `服务费用\n${quoteSummary.services.map((item, index) => `${index + 1}. ${item.name || '服务'} x${safeNum(item.quantity || 0)} = ¥${safeNum(item.amount || 0).toFixed(2)}`).join('\n')}` : '',
    quoteSummary.others.length ? `其他费用\n${quoteSummary.others.map((item, index) => `${index + 1}. ${item.name || '其他'} x${safeNum(item.quantity || 0)} = ¥${safeNum(item.amount || 0).toFixed(2)}`).join('\n')}` : ''
  ].filter(Boolean)
  const rows = [
    ['工单编号', order.id],
    ['提交时间', order.submitTime],
    ['当前状态', order.status],
    ['诊所/单位', order.clinicName],
    ['联系人', order.customerName],
    fields.showPhone !== false ? ['联系电话', order.phone] : null,
    fields.showAddress !== false ? ['回寄地址', order.address] : null,
    ['产品明细', formatOrderItems(order.itemsList)],
    ['寄出物流', `${order.logisticsCompany || ''} ${order.logisticsNo || ''}`.trim()],
    ['回寄物流', `${order.returnCompany || ''} ${order.returnNo || ''}`.trim()],
    fields.showCost ? ['配件小计', `¥${quoteSummary.partsTotal.toFixed(2)}`] : null,
    fields.showCost ? ['服务小计', `¥${quoteSummary.servicesTotal.toFixed(2)}`] : null,
    fields.showCost ? ['其他小计', `¥${quoteSummary.othersTotal.toFixed(2)}`] : null,
    fields.showCost ? ['最终报价', `¥${quoteSummary.finalPrice.toFixed(2)}`] : null,
    fields.showCost && quoteSummary.remark ? ['报价备注', quoteSummary.remark] : null,
    fields.showCost && quoteLines.length ? ['报价明细', quoteLines.join('\n\n')] : null,
    ['随件留言', order.printRemark]
  ].filter(Boolean)

  const watermark = config.watermarkEnabled && config.watermarkText
    ? `<div class="watermark" style="opacity:${Number(config.watermarkOpacity) || 0.12}">${escapeHtml(config.watermarkText)}</div>`
    : ''

  const header = (config.logoUrl || config.header)
    ? `<div class="print-header">
        ${config.logoUrl ? `<img class="print-logo" src="${escapeHtml(config.logoUrl)}" alt="logo" />` : ''}
        ${config.header ? `<span class="print-header-text">${escapeHtml(config.header)}</span>` : ''}
      </div>`
    : ''

  return `
    <section class="print-section">
      ${watermark}
      ${header}
      <h1>${escapeHtml(config.title)}</h1>
      <table>
        ${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value || '-')}</td></tr>`).join('')}
      </table>
      ${config.showSignature ? '<div class="signature">工程师签字：____________　客户签收：____________</div>' : ''}
      <div class="footer">
        <span>${escapeHtml(config.footer || '')}</span>
        <span>打印时间：${escapeHtml(new Date().toLocaleString('zh-CN', { hour12: false }))}</span>
      </div>
    </section>
  `
}

export const openPrintWindow = (printOrders = [], rawConfig = {}) => {
  if (!printOrders.length) return true
  const config = parsePrintConfig(rawConfig)
  const copies = Math.min(Math.max(Number(config.copies) || 1, 1), 5)
  const expandedOrders = Array.from({ length: copies }).flatMap(() => printOrders)
  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) return false

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>工单打印-${escapeHtml(printOrders.map(item => item.id).join('_'))}</title>
        <style>
          ${getPaperStyle(config.paperSize)}
          body { font-family: "Microsoft YaHei", Arial, sans-serif; color: #1d2129; }
          h1 { font-size: 22px; margin: 0 0 18px; text-align: center; }
          table { width: 100%; border-collapse: collapse; }
          td { border: 1px solid #dcdfe6; padding: 10px 12px; font-size: 14px; vertical-align: top; white-space: pre-line; }
          td:first-child { width: 120px; background: #f5f7fa; font-weight: 700; }
          .signature { margin-top: 24px; display: flex; justify-content: space-between; font-size: 14px; }
          .footer { margin-top: 24px; display: flex; justify-content: space-between; gap: 24px; font-size: 13px; color: #606266; }
          .print-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
          .print-logo { height: 48px; object-fit: contain; }
          .print-header-text { font-size: 16px; font-weight: 700; color: #1d2129; }
          .print-section { page-break-after: always; position: relative; }
          .print-section:last-child { page-break-after: auto; }
          .watermark { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 64px; font-weight: 800; color: #000; pointer-events: none; white-space: nowrap; z-index: 0; }
          .print-section table, .print-section h1, .print-section .print-header { position: relative; z-index: 1; }
        </style>
      </head>
      <body>
        ${expandedOrders.map(order => buildPrintSection(order, config)).join('')}
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  return true
}
