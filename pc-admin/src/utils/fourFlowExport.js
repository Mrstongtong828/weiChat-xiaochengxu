import ExcelJS from 'exceljs'

const STATUS_LABELS = {
  pending: '已提交', sent: '运输中', received: '已签收', inspecting: '检测中',
  fixing: '处理中', shipped: '已回寄', completed: '已完成', cancelled: '已取消'
}
const PAY_LABELS = { pending: '待付款', uploaded: '待核销', paid: '已付款', refunded: '已退款' }

const fmtTime = (ts) => {
  if (!ts) return ''
  const d = new Date(Number(ts))
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const payMethod = (r) => (r.payment_method === 'wechat_pay' ? '微信支付' : (r.payment_method || ''))

// 导出四流台账（订单 / 物流 / 支付 / 发票 合一）
export const exportFourFlowLedger = async (list = []) => {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('四流台账')
  ws.addRow([
    '工单号', '工单状态', '客户', '联系电话',
    '实付金额', '配件费', '工时费', '付款状态', '付款方式', '付款时间', '微信支付单号',
    '寄出物流公司', '寄出运单号', '回寄物流公司', '回寄运单号',
    '开票状态', '发票抬头', '税号', '发票号码', '开票日期', '专票邮寄公司', '专票邮寄单号',
    '创建时间', '更新时间'
  ])
  list.forEach(r => {
    ws.addRow([
      r.order_no, STATUS_LABELS[r.status] || r.status, r.customer, r.phone,
      Number(r.total_price || 0).toFixed(2), Number(r.parts_fee || 0).toFixed(2), Number(r.labor_fee || 0).toFixed(2),
      PAY_LABELS[r.payment_status] || r.payment_status, payMethod(r), fmtTime(r.payment_paid_time), r.wechat_transaction_id,
      r.out_company, r.out_no, r.back_company, r.back_no,
      r.invoice_status, r.invoice_title, r.tax_no, r.invoice_no, r.invoice_date, r.mail_company, r.mail_no,
      fmtTime(r.create_time), fmtTime(r.update_time)
    ])
  })
  ws.columns = [
    { width: 16 }, { width: 10 }, { width: 16 }, { width: 14 },
    { width: 11 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 11 }, { width: 18 }, { width: 24 },
    { width: 14 }, { width: 22 }, { width: 14 }, { width: 22 },
    { width: 10 }, { width: 22 }, { width: 20 }, { width: 24 }, { width: 12 }, { width: 14 }, { width: 20 },
    { width: 18 }, { width: 18 }
  ]
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  a.href = url
  a.download = `四流台账_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
