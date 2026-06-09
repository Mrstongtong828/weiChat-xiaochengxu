const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const defaultPrintConfig = {
  title: '设备维修回寄单',
  paperSize: 'A4',
  copies: 1,
  showSignature: true,
  footer: '感谢您的信任！为了您的设备健康，建议定期维护保养。'
}

export const parsePrintConfig = (value) => {
  if (!value) return { ...defaultPrintConfig }
  if (typeof value === 'object') return { ...defaultPrintConfig, ...value }
  try {
    return { ...defaultPrintConfig, ...JSON.parse(value) }
  } catch (error) {
    return { ...defaultPrintConfig }
  }
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

const getPaperStyle = (paperSize) => {
  if (paperSize === 'A5') return '@page { size: A5; margin: 12mm; } body { margin: 12mm; }'
  if (paperSize === 'receipt-80') return '@page { size: 80mm auto; margin: 4mm; } body { margin: 4mm; } td { font-size: 12px; }'
  return '@page { size: A4; margin: 18mm; } body { margin: 18mm; }'
}

const buildPrintSection = (order, config) => {
  const rows = [
    ['工单编号', order.id],
    ['提交时间', order.submitTime],
    ['当前状态', order.status],
    ['诊所/单位', order.clinicName],
    ['联系人', order.customerName],
    ['联系电话', order.phone],
    ['回寄地址', order.address],
    ['产品明细', formatOrderItems(order.itemsList)],
    ['寄出物流', `${order.logisticsCompany || ''} ${order.logisticsNo || ''}`.trim()],
    ['回寄物流', `${order.returnCompany || ''} ${order.returnNo || ''}`.trim()],
    ['随件留言', order.printRemark]
  ]

  return `
    <section class="print-section">
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
          .print-section { page-break-after: always; }
          .print-section:last-child { page-break-after: auto; }
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
