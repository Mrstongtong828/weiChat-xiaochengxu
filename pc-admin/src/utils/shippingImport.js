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

const importTypeConfig = {
  inbound: {
    sheetName: '客户寄入签收模板',
    filename: '客户寄入签收模板.xlsx',
    timeHeader: '签收时间',
    sampleTime: '2026-06-04',
    note: '客户寄入已签收'
  },
  return: {
    sheetName: '后台回寄发货模板',
    filename: '后台回寄发货模板.xlsx',
    timeHeader: '发货时间',
    sampleTime: '2026-06-04',
    note: '维修完成回寄'
  }
}

const getImportConfig = (type = 'return') => importTypeConfig[type] || importTypeConfig.return

export const getLogisticsImportTypeLabel = (type = 'return') => (type === 'inbound' ? '客户寄入签收' : '后台回寄发货')

export const downloadShippingTemplate = async (type = 'return') => {
  const config = getImportConfig(type)
  const rows = [
    ['工单编号', '物流公司', '物流单号', config.timeHeader, '备注'],
    ['DR2026... (请填写真实编号)', '顺丰速运 (必填)', 'SF123456... (必填)', config.sampleTime, config.note]
  ]
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(config.sheetName)
  worksheet.addRows(rows)
  worksheet.columns = [{ width: 28 }, { width: 18 }, { width: 24 }, { width: 18 }, { width: 24 }]
  await downloadWorkbook(workbook, config.filename)
}

export const normalizeShippingRows = (rows = [], type = 'return') => {
  const isInbound = type === 'inbound'
  return rows
    .map((row = {}) => ({
      orderNo: pickCell(row, ['orderNo', 'order_no', '工单编号', '工单号']),
      logisticsCompany: pickCell(row, [
        'logisticsCompany',
        'logistics_company',
        isInbound ? '寄入物流公司' : '回寄物流公司',
        isInbound ? '客户寄入物流公司' : '后台回寄物流公司',
        '物流公司'
      ]),
      logisticsNo: pickCell(row, [
        'logisticsNo',
        'logistics_no',
        'trackingNo',
        'tracking_no',
        isInbound ? '寄入物流单号' : '回寄物流单号',
        isInbound ? '客户寄入单号' : '回寄运单号',
        '物流单号',
        '运单号',
        '快递单号'
      ]),
      eventTime: pickCell(row, [
        'eventTime',
        'event_time',
        isInbound ? '签收时间' : '发货时间',
        isInbound ? '收到时间' : '回寄时间',
        '时间'
      ]),
      remark: pickCell(row, ['remark', '备注'])
    }))
    .filter(item => item.orderNo || item.logisticsCompany || item.logisticsNo)
}

export const parseShippingExcelBuffer = async (buffer, type = 'return') => {
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
  return normalizeShippingRows(rows, type)
}

export const parseShippingExcelFile = (file, type = 'return') => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        resolve(parseShippingExcelBuffer(event.target.result, type))
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
