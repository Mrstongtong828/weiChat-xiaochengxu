import ExcelJS from 'exceljs'

const normalizeText = (value) => String(value ?? '').trim()

const IMPORT_HEADERS = ['配件编码', '配件名称', '型号', '适配机型', '采购成本', '销售单价', '当前库存', '预警阈值', '是否启用', '备注']
const HEADER_FIELD_MAP = {
  配件编码: 'part_code',
  配件名称: 'part_name',
  型号: 'model',
  适配机型: 'compatible_models',
  采购成本: 'purchase_cost',
  销售单价: 'sale_price',
  当前库存: 'stock',
  预警阈值: 'warning_threshold',
  是否启用: 'enabled',
  备注: 'remark'
}

const downloadWorkbook = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const cellToText = (value) => {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if (value.text) return normalizeText(value.text)
    if (value.result != null) return normalizeText(value.result)
    if (value.richText) return normalizeText(value.richText.map(item => item.text).join(''))
    return normalizeText(value.toString())
  }
  return normalizeText(value)
}

const formatDate = () => {
  const date = new Date()
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

export const downloadPartImportTemplate = async () => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('配件导入模板')
  worksheet.addRow(IMPORT_HEADERS)
  worksheet.addRow(['DENT-HP-BEARING-3.175', '高速手机陶瓷轴承', '3.175mm', '高速气涡轮手机、45度手机', 18, 45, 40, 10, '启用', '示例数据，可删除'])
  worksheet.addRow(['DENT-SCALER-HANDPIECE', '洁牙机手柄', 'SC-H1', '超声洁牙机、EMS兼容洁牙机', 85, 180, 8, 2, '启用', '示例数据，可删除'])
  worksheet.columns = [
    { width: 26 },
    { width: 20 },
    { width: 16 },
    { width: 34 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 34 }
  ]
  await downloadWorkbook(workbook, '配件库存导入模板.xlsx')
}

export const exportPartsWorkbook = async (rows = [], { canViewCost = true, filename = '' } = {}) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('配件库存')
  const columns = [
    { header: '配件编码', key: 'part_code', width: 26 },
    { header: '配件名称', key: 'part_name', width: 20 },
    { header: '型号', key: 'model', width: 16 },
    { header: '适配机型', key: 'compatible_models', width: 34 },
    ...(canViewCost ? [{ header: '采购成本', key: 'purchase_cost', width: 12 }] : []),
    { header: '销售单价', key: 'sale_price', width: 12 },
    { header: '当前库存', key: 'stock', width: 12 },
    { header: '预警阈值', key: 'warning_threshold', width: 12 },
    { header: '库存状态', key: 'stock_status', width: 12 },
    { header: '是否启用', key: 'enabled', width: 12 },
    { header: '备注', key: 'remark', width: 34 }
  ]
  worksheet.columns = columns
  worksheet.addRows(rows.map(row => {
    const stock = Number(row.stock || 0) || 0
    const warning = Number(row.warning_threshold ?? row.warningThreshold ?? 0) || 0
    return {
      part_code: row.part_code || row.partCode || '',
      part_name: row.part_name || row.partName || '',
      model: row.model || '',
      compatible_models: (row.compatible_models || row.compatibleModels || []).join('、'),
      purchase_cost: Number(row.purchase_cost ?? row.purchaseCost ?? 0) || 0,
      sale_price: Number(row.sale_price ?? row.salePrice ?? 0) || 0,
      stock,
      warning_threshold: warning,
      stock_status: stock <= 0 ? '无库存' : warning > 0 && stock <= warning ? '低库存' : '正常',
      enabled: row.enabled === false ? '禁用' : '启用',
      remark: row.remark || ''
    }
  }))
  await downloadWorkbook(workbook, filename || `配件库存_${formatDate()}.xlsx`)
}

export const parsePartExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(event.target.result)
        const worksheet = workbook.worksheets[0]
        if (!worksheet) { resolve([]); return }
        const headers = []
        worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers[col] = cellToText(cell.value) })
        const rows = []
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return
          const item = { row: rowNumber }
          row.eachCell({ includeEmpty: true }, (cell, col) => {
            const field = HEADER_FIELD_MAP[headers[col]]
            if (field) item[field] = cellToText(cell.value)
          })
          if (normalizeText(item.part_code) || normalizeText(item.part_name)) rows.push(item)
        })
        resolve(rows)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
