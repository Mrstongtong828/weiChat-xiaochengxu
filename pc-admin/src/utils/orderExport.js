import ExcelJS from 'exceljs'
import { formatOrderItems } from './orderPrint.js'

export const formatOrderAttachments = (items = []) => {
  return items.map((item, index) => {
    const attachments = [
      ...(item.voucher_urls || []).map(url => `购买凭证: ${url}`),
      ...(item.image_urls || []).map(url => `故障图片: ${url}`),
      ...(item.video_urls || []).map(url => `故障视频: ${url}`),
      ...(item.media_urls || []).map(url => `历史附件: ${url}`)
    ]
    return attachments.length ? `产品${index + 1}\n${attachments.join('\n')}` : ''
  }).filter(Boolean).join('\n')
}

export const downloadWorkbook = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportOrdersToWorkbook = async (orders, selectedFieldConfigs, filename = '报修工单导出.xlsx') => {
  const dataToExport = orders.map(order => {
    return selectedFieldConfigs.reduce((rowData, field) => {
      const cellValue = field.getter(order)
      rowData[field.label] = cellValue === undefined || cellValue === null ? '' : cellValue
      return rowData
    }, {})
  })

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('工单明细')
  worksheet.columns = selectedFieldConfigs.map(field => ({
    header: field.label,
    key: field.label,
    width: Math.max(field.label.length * 2 + 4, 14)
  }))
  worksheet.addRows(dataToExport)
  await downloadWorkbook(workbook, filename)
}

export { formatOrderItems }
