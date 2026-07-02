import ExcelJS from 'exceljs'

const normalizeText = (value) => String(value ?? '').trim()

const pickCell = (row, keys) => {
  for (const key of keys) {
    const value = normalizeText(row[key])
    if (value) return value
  }
  return ''
}

const downloadWorkbook = async (workbook, filename) => {
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

// 下载批量导入开票结果模板
export const downloadInvoiceTemplate = async () => {
  const rows = [
    ['工单编号', '发票号码', '开票日期', '开票状态', '发票链接'],
    ['DR2026... (请填写真实编号)', '24417000000123456789', '2026-06-04', '已开具', 'https://...（选填，电子发票PDF链接）']
  ]
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('批量开票导入模板')
  worksheet.addRows(rows)
  worksheet.columns = [{ width: 28 }, { width: 26 }, { width: 16 }, { width: 14 }, { width: 40 }]
  await downloadWorkbook(workbook, '批量开票导入模板.xlsx')
}

export const normalizeInvoiceRows = (rows = []) => {
  return rows
    .map((row = {}) => ({
      order_no: pickCell(row, ['order_no', 'orderNo', '工单编号', '工单号']),
      invoice_no: pickCell(row, ['invoice_no', 'invoiceNo', '发票号码', '发票号']),
      invoice_date: pickCell(row, ['invoice_date', 'invoiceDate', '开票日期']),
      status: pickCell(row, ['status', '开票状态']),
      invoice_url: pickCell(row, ['invoice_url', 'invoiceUrl', '发票链接', '发票PDF'])
    }))
    .filter(item => item.order_no || item.invoice_no || item.invoice_url)
}

export const parseInvoiceExcelBuffer = async (buffer) => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []
  const headers = []
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeText(cell.value)
  })
  const rows = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const rowData = {}
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber]
      if (key) rowData[key] = cell.value
    })
    rows.push(rowData)
  })
  return normalizeInvoiceRows(rows)
}

export const parseInvoiceExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        resolve(parseInvoiceExcelBuffer(event.target.result))
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// 导出开票申请清单
export const exportInvoiceRows = async (list = []) => {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('开票申请清单')
  ws.addRow(['工单号', '客户', '金额(元)', '开票状态', '发票抬头', '税号', '发票号码', '开票日期', '专票邮寄公司', '专票邮寄单号', '发票链接'])
  list.forEach(r => {
    ws.addRow([
      r.order_no, r.customer, Number(r.total_price || 0).toFixed(2), r.status,
      r.title, r.tax_no, r.invoice_no, r.invoice_date, r.mail_company, r.mail_no, r.invoice_url
    ])
  })
  ws.columns = [{ width: 18 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 24 }, { width: 20 }, { width: 24 }, { width: 14 }, { width: 16 }, { width: 22 }, { width: 40 }]
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  await downloadWorkbook(workbook, `开票申请清单_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.xlsx`)
}
