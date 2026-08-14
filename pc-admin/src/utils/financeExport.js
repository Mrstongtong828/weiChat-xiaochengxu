import ExcelJS from 'exceljs'

const PAY_LABELS = { pending: '待付款', uploaded: '待核销', paid: '已付款', refunded: '已退款' }

const fmtTime = (ts) => {
  if (!ts) return ''
  const d = new Date(Number(ts))
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 导出应收账龄（催款清单）：按账龄分组输出未收清工单，财务可直接用于催收与对账
export const exportReceivableAging = async (aging = []) => {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('应收账龄')
  ws.addRow([
    '账龄分组', '工单号', '客户', '联系电话',
    '应收金额(元)', '付款截止时间', '逾期天数', '付款状态'
  ])
  aging.forEach(item => {
    ws.addRow([
      item.bucketLabel || '',
      item.order_no || '',
      item.customer || '',
      item.phone || '',
      Number(item.amount || 0).toFixed(2),
      fmtTime(item.payment_deadline),
      Number(item.overdue_days || 0),
      PAY_LABELS[item.payment_status] || item.payment_status || ''
    ])
  })
  ws.columns = [
    { width: 16 }, { width: 18 }, { width: 20 }, { width: 14 },
    { width: 13 }, { width: 18 }, { width: 10 }, { width: 10 }
  ]
  // 合计行
  const total = aging.reduce((sum, item) => sum + (Number(item.amount || 0) || 0), 0)
  ws.addRow([])
  ws.addRow(['合计', '', '', '', Number(total).toFixed(2), `共 ${aging.length} 笔`])

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  a.href = url
  a.download = `应收账龄_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
