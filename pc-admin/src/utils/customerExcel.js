import ExcelJS from 'exceljs'

const normalizeText = (value) => String(value ?? '').trim()

const TYPE_LABELS = { clinic: '终端诊所', dealer: '经销商', individual: '个人散户' }
const SOURCE_LABELS = { miniapp: '小程序注册', offline: '线下导入', dealer_referral: '经销商推荐' }
const STATUS_LABELS = { active: '正常', cancelled: '已注销' }

// 导入模板列头（与 batchImportCustomers 字段对应）
const IMPORT_HEADERS = ['客户名称', '联系人', '手机号', '客户类型', '地址', '信用代码', '对接业务员', '标签', '备注']
const HEADER_FIELD_MAP = {
  客户名称: 'name', 联系人: 'contact', 手机号: 'phone', 客户类型: 'customer_type',
  地址: 'address', 信用代码: 'credit_code', 对接业务员: 'biz_user', 标签: 'tags', 备注: 'remark'
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
  if (typeof value === 'object') {
    if (value.text) return normalizeText(value.text)
    if (value.result != null) return normalizeText(value.result)
    if (value.richText) return normalizeText(value.richText.map(r => r.text).join(''))
    return normalizeText(value.toString())
  }
  return normalizeText(value)
}

// 下载导入模板
export const downloadCustomerTemplate = async () => {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('客户导入模板')
  ws.addRow(IMPORT_HEADERS)
  ws.addRow(['示例口腔诊所', '张医生', '13800138000', '终端诊所', '某省某市某区某街道', '', '', '在保客户', '示例数据，可删除'])
  ws.columns = IMPORT_HEADERS.map(h => ({ width: Math.max(h.length * 2 + 6, 14) }))
  await downloadWorkbook(workbook, '客户导入模板.xlsx')
}

// 导出客户档案
export const exportCustomerWorkbook = async (rows = [], filename = '客户档案导出.xlsx') => {
  const columns = [
    { header: '客户名称', key: 'name', width: 22 },
    { header: '联系人', key: 'contact', width: 12 },
    { header: '手机号', key: 'phone', width: 16 },
    { header: '客户类型', key: 'customer_type', width: 12 },
    { header: '客户来源', key: 'source', width: 14 },
    { header: '地址', key: 'address', width: 30 },
    { header: '归属经销商', key: 'dealer_name', width: 18 },
    { header: '信用代码', key: 'credit_code', width: 22 },
    { header: '对接业务员', key: 'biz_user', width: 12 },
    { header: '标签', key: 'tags', width: 20 },
    { header: '状态', key: 'status', width: 10 },
    { header: '备注', key: 'remark', width: 24 },
    { header: '创建时间', key: 'create_time', width: 20 }
  ]
  const data = rows.map(r => ({
    ...r,
    customer_type: TYPE_LABELS[r.customer_type] || r.customer_type || '',
    source: SOURCE_LABELS[r.source] || r.source || '',
    status: STATUS_LABELS[r.status] || r.status || '',
    create_time: r.create_time ? new Date(r.create_time).toLocaleString('zh-CN') : ''
  }))
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('客户档案')
  ws.columns = columns
  ws.addRows(data)
  await downloadWorkbook(workbook, filename)
}

// 解析导入文件 -> 行对象数组
export const parseCustomerExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(event.target.result)
        const ws = workbook.worksheets[0]
        if (!ws) { resolve([]); return }
        const headers = []
        ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers[col] = cellToText(cell.value) })
        const rows = []
        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return
          const obj = {}
          row.eachCell({ includeEmpty: true }, (cell, col) => {
            const field = HEADER_FIELD_MAP[headers[col]]
            if (field) obj[field] = cellToText(cell.value)
          })
          if (normalizeText(obj.name) || normalizeText(obj.phone)) rows.push(obj)
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
