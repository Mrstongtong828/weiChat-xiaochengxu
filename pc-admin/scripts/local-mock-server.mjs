import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.MOCK_PORT || 8787)
const TOKEN = 'local-admin-token'

const now = Date.now()

const staff = [
  {
    _id: 'admin001',
    username: 'admin',
    name: 'System Admin',
    phone: '13800138000',
    role: 'admin',
    disabled: false,
    create_time: now - 86400000
  },
  {
    _id: 'engineer001',
    username: 'engineer01',
    name: 'Engineer One',
    phone: '13800138001',
    role: 'engineer',
    disabled: false,
    create_time: now - 43200000
  }
]

const categories = [
  { _id: 'cat001', category_name: 'Dental handpiece', status: 'active', sort: 1 },
  { _id: 'cat002', category_name: 'Imaging device', status: 'active', sort: 2 }
]

const faults = [
  {
    _id: 'fault001',
    category_id: 'cat001',
    fault_name: 'No rotation',
    related_questions: ['Motor does not start', 'Abnormal noise'],
    check_steps: ['Check power supply', 'Check bearing'],
    fix_solutions: ['Replace bearing', 'Clean internal dust'],
    create_time: now - 7200000
  },
  {
    _id: 'fault002',
    category_id: 'cat002',
    fault_name: 'Image blur',
    related_questions: ['Focus error', 'Calibration needed'],
    check_steps: ['Run calibration', 'Check lens'],
    fix_solutions: ['Adjust calibration', 'Replace lens module'],
    create_time: now - 3600000
  }
]

const orders = [
  {
    _id: 'order001',
    order_no: 'WX20260609001',
    status: 'pending',
    user_id: 'user001',
    create_time: now - 3600000,
    update_time: now - 1800000,
    ship_out_info: {
      name: 'Zhang San',
      phone: '13900139000',
      unit: 'Demo Dental Clinic',
      region: 'Shanghai',
      detail: 'No. 88 Test Road',
      logistics_company: 'SF Express',
      logistics_no: 'SF1000000001'
    },
    ship_back_info: {
      name: 'Zhang San',
      phone: '13900139000',
      unit: 'Demo Dental Clinic',
      region: 'Shanghai',
      detail: 'No. 88 Test Road'
    },
    itemsList: [
      {
        _id: 'item001',
        product_name: 'Dental handpiece',
        product_model: 'HP-200',
        sn: 'SN-A001',
        buy_date: '2026-05-20',
        fault_desc: 'No rotation after power on',
        quantity: 1,
        media_urls: []
      }
    ],
    invoice_info: {
      need_invoice: true,
      title: 'Demo Dental Clinic',
      tax_no: '91310000TEST0001',
      status: 'pending',
      remark: ''
    },
    quote_status: 'pending',
    parts_fee: 0,
    labor_fee: 0,
    total_price: 0,
    payment_status: 'pending',
    payment_proofs: [],
    timeline: [
      { title: 'Order submitted', desc: 'Local mock data', time: now - 3600000 }
    ]
  },
  {
    _id: 'order002',
    order_no: 'WX20260609002',
    status: 'fixing',
    user_id: 'user002',
    create_time: now - 86400000,
    update_time: now - 1200000,
    ship_out_info: {
      name: 'Li Si',
      phone: '13900139001',
      unit: 'Sample Clinic',
      region: 'Hangzhou',
      detail: 'No. 12 Cloud Street',
      logistics_company: 'YTO',
      logistics_no: 'YT1000000002'
    },
    ship_back_info: {
      name: 'Li Si',
      phone: '13900139001',
      unit: 'Sample Clinic',
      region: 'Hangzhou',
      detail: 'No. 12 Cloud Street',
      logistics_company: '',
      logistics_no: ''
    },
    itemsList: [
      {
        _id: 'item002',
        product_name: 'Imaging device',
        product_model: 'IMG-9',
        sn: 'SN-B002',
        buy_date: '2026-03-18',
        fault_desc: 'Image is blurred',
        quantity: 1,
        media_urls: []
      }
    ],
    invoice_info: {
      need_invoice: false,
      title: '',
      tax_no: '',
      status: 'none',
      remark: ''
    },
    quote_status: 'issued',
    quote_items: [
      { name: 'Lens module', desc: 'Replace damaged part', partsFee: 260, laborFee: 80 }
    ],
    parts_fee: 260,
    labor_fee: 80,
    total_price: 340,
    payment_status: 'uploaded',
    payment_proofs: [{ url: '', name: 'transfer-proof.png', time: now - 600000 }],
    timeline: [
      { title: 'Received', desc: 'Device arrived at service center', time: now - 80000000 },
      { title: 'Repairing', desc: 'Engineer is checking the issue', time: now - 1200000 }
    ]
  }
]

const feedbacks = [
  {
    _id: 'fb001',
    type: 'suggestion',
    contact_value: '13900139000',
    content: 'Local feedback sample',
    status: 'pending',
    create_time: now - 5400000
  }
]

let settings = {
  warranty_policy: 'Local mock warranty policy.',
  fee_description: 'Local mock fee description.',
  company_name: '佛山市思科达医疗器械有限公司',
  contact_phone: '0757-85775667',
  contact_address: '广东省佛山市南海区狮山镇罗村广东新光源核心基地B5座五楼',
  work_time: '周一至周五 08:00 - 21:00',
  bank_transfer_company_name: '佛山市登煌医疗器械有限公司',
  bank_transfer_tax_no: '91440605688623440U',
  bank_transfer_address_phone: '佛山市南海区狮山镇罗村广东新光源产业基地核心区内B区5座二层  0757-85775667',
  bank_transfer_bank_name: '中国农业银行佛山惠景支行',
  bank_transfer_account_no: '4442 3201 0400 04288',
  bank_transfer_line_no: '103588042208',
  print_config: JSON.stringify({
    title: 'Repair Return Sheet',
    paperSize: 'A4',
    copies: 1,
    showSignature: true,
    footer: 'Local mock print footer.'
  })
}

const guides = [
  { _id: 'guide001', type: 'quick', category: 'Quick guide', desc: 'Quick start guide', file_name: '', file_url: '', file_type: '', sort: 1, update_time: now },
  { _id: 'guide002', type: 'repair', category: 'Repair guide', desc: 'Repair workflow guide', file_name: '', file_url: '', file_type: '', sort: 2, update_time: now },
  { _id: 'guide003', type: 'query', category: 'Query guide', desc: 'Progress query guide', file_name: '', file_url: '', file_type: '', sort: 3, update_time: now },
  { _id: 'guide004', type: 'invoice', category: 'Invoice guide', desc: 'Invoice application guide', file_name: '', file_url: '', file_type: '', sort: 4, update_time: now }
]

const ok = (data = undefined, extra = {}) => (
  data === undefined ? { code: 0, ...extra } : { code: 0, data, ...extra }
)

const fail = (msg = 'Local mock error', code = -1) => ({ code, msg })

const sendJson = (res, payload, statusCode = 200) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  })
  res.end(JSON.stringify(payload))
}

const readBody = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const requireToken = (body) => {
  if (!body.token && !String(body.Authorization || '').includes(TOKEN)) {
    return fail('Local login expired', 401)
  }
  return null
}

const filterOrders = (body) => {
  const keyword = String(body.keyword || '').trim().toLowerCase()
  const status = body.status
  let list = orders

  if (status) list = list.filter(order => order.status === status)
  if (keyword) {
    list = list.filter(order => JSON.stringify(order).toLowerCase().includes(keyword))
  }
  if (body.deviceModel) {
    list = list.filter(order => (order.itemsList || []).some(item => item.product_model === body.deviceModel))
  }

  return list
}

const orderMetrics = () => {
  const pendingStatuses = new Set(['pending', 'sent', 'received'])
  const repairingStatuses = new Set(['inspecting', 'fixing', 'processing'])
  return {
    pendingCount: orders.filter(order => pendingStatuses.has(order.status)).length,
    todayCount: orders.filter(order => now - order.create_time < 86400000).length,
    totalCount: orders.length,
    newOrders: orders.length,
    pendingOrders: orders.filter(order => pendingStatuses.has(order.status)).length,
    repairingOrders: orders.filter(order => repairingStatuses.has(order.status)).length,
    completedOrders: orders.filter(order => order.status === 'completed').length,
    avgHandleHours: 8.5,
    quotePendingOrders: orders.filter(order => order.quote_status === 'pending').length,
    invoicePendingOrders: orders.filter(order => order.invoice_info?.need_invoice && order.invoice_info?.status !== 'issued').length,
    totalOrders: orders.length,
    totalFeedbacks: feedbacks.length,
    pendingFeedbacks: feedbacks.filter(item => item.status === 'pending').length
  }
}

const handleAdminSys = (method, body) => {
  if (method === 'adminLogin') {
    if (body.username === 'admin' && body.password === 'admin123') {
      return ok(undefined, {
        msg: 'Local login success',
        token: TOKEN,
        userId: 'admin001',
        role: 'admin',
        isAdmin: true,
        isEngineer: false,
        user: {
          _id: 'admin001',
          username: 'admin',
          name: 'System Admin',
          role: 'admin'
        }
      })
    }
    return fail('Wrong local username or password')
  }

  const authError = requireToken(body)
  if (authError) return authError

  if (method === 'changeMyPassword') return ok()
  if (method === 'getFeedbackStats') {
    return ok({ unreadCount: feedbacks.filter(item => item.status === 'pending').length })
  }
  if (method === 'getFeedbackList') return ok(feedbacks)
  if (method === 'getSettings') return ok(settings)
  if (method === 'saveSettings') {
    settings = { ...settings, ...(body.settings || {}) }
    return ok(settings)
  }
  if (method === 'getGuides') return ok(guides)
  if (method === 'uploadGuideFile') {
    return ok({
      fileName: body.fileName,
      fileUrl: `http://localhost:${PORT}/mock-files/${encodeURIComponent(body.fileName || 'guide-file')}`,
      fileType: body.fileType || ''
    })
  }
  if (method === 'updateGuide') {
    const guide = guides.find(item => item._id === body.guide_id)
    if (guide) {
      Object.assign(guide, {
        file_name: body.file_name ?? guide.file_name,
        file_url: body.file_url ?? guide.file_url,
        file_type: body.file_type ?? guide.file_type,
        desc: body.desc ?? guide.desc,
        update_time: Date.now()
      })
    }
    return ok(guide || {})
  }
  if (method === 'resetUserPassword') return ok()
  if (method === 'manageStaff') {
    if (body.action === 'list') return ok(staff)
    if (body.action === 'add') {
      const next = {
        _id: randomUUID(),
        username: body.staff?.username || `staff${staff.length + 1}`,
        name: body.staff?.name || '',
        phone: body.staff?.phone || '',
        role: body.staff?.role || 'engineer',
        disabled: false,
        create_time: Date.now()
      }
      staff.push(next)
      return ok(next)
    }
    if (body.action === 'edit') {
      const item = staff.find(user => user._id === body.staff?._id)
      if (item) Object.assign(item, body.staff)
      return ok(item || {})
    }
    if (body.action === 'disable') {
      const item = staff.find(user => user._id === body.staff?._id)
      if (item) item.disabled = body.staff?.disabled !== false
      return ok(item || {})
    }
  }

  return fail(`Unknown local admin-sys method: ${method}`)
}

const handleAdminOrder = (method, body) => {
  const authError = requireToken(body)
  if (authError) return authError

  if (method === 'getStatistics') return ok(orderMetrics())
  if (method === 'getTodoSummary') {
    const metrics = orderMetrics()
    return ok({
      groups: [
        { key: 'pending', title: 'Pending orders', desc: 'Orders waiting for first handling', count: metrics.pendingOrders },
        { key: 'quote', title: 'Quote pending', desc: 'Orders waiting for quote', count: metrics.quotePendingOrders },
        { key: 'invoice', title: 'Invoice pending', desc: 'Orders waiting for invoice handling', count: metrics.invoicePendingOrders }
      ]
    })
  }
  if (method === 'getDashboardSummary') {
    return ok({
      metrics: orderMetrics(),
      trend: [
        { label: '2026-06-07', newOrders: 1, completedOrders: 0, pendingOrders: 1 },
        { label: '2026-06-08', newOrders: 0, completedOrders: 1, pendingOrders: 1 },
        { label: '2026-06-09', newOrders: 1, completedOrders: 0, pendingOrders: 2 }
      ]
    })
  }
  if (method === 'getAdminOrderList') {
    const list = filterOrders(body)
    const page = Number(body.page || 1)
    const pageSize = Number(body.pageSize || list.length || 20)
    const start = (page - 1) * pageSize
    return ok({
      list: list.slice(start, start + pageSize),
      total: list.length,
      deviceModels: [...new Set(orders.flatMap(order => (order.itemsList || []).map(item => item.product_model).filter(Boolean)))]
    })
  }

  const orderId = body.order_id || body.orderId
  const order = orders.find(item => item._id === orderId)
  if (method === 'updateOrderStatus' && order) {
    order.status = body.status || order.status
    order.update_time = Date.now()
    return ok(order)
  }
  if (method === 'updateRemarks' && order) {
    order.admin_remark = body.adminRemark || ''
    order.print_remark = body.printRemark || ''
    order.update_time = Date.now()
    return ok(order)
  }
  if (method === 'updateInvoiceStatus' && order) {
    order.invoice_info = {
      ...(order.invoice_info || {}),
      ...(body.invoice || {}),
      status: body.status || order.invoice_info?.status
    }
    order.update_time = Date.now()
    return ok(order)
  }
  if (method === 'updateOrderQuote' && order) {
    const quote = body.quote || {}
    order.quote_items = quote.items || order.quote_items || []
    order.quote_status = quote.status || 'issued'
    order.quote_remark = quote.remark || ''
    order.parts_fee = order.quote_items.reduce((sum, item) => sum + Number(item.partsFee || item.parts_fee || 0), 0)
    order.labor_fee = order.quote_items.reduce((sum, item) => sum + Number(item.laborFee || item.labor_fee || 0), 0)
    order.total_price = order.parts_fee + order.labor_fee
    order.update_time = Date.now()
    return ok(order)
  }
  if (method === 'updatePaymentStatus' && order) {
    order.payment_status = body.status || 'paid'
    order.update_time = Date.now()
    return ok(order)
  }
  if (method === 'addTimeline' && order) {
    order.timeline = order.timeline || []
    order.timeline.push({ title: body.title, desc: body.desc, time: Date.now() })
    order.update_time = Date.now()
    return ok(order)
  }
  if (method === 'batchUpdateShipping' || method === 'batchImportReturnLogistics' || method === 'batchImportLogistics') {
    return ok({ success: true, total: Array.isArray(body.rows) ? body.rows.length : 0, failed: [] })
  }

  return fail(`Unknown local admin-order method: ${method}`)
}

const handleAdminKb = (method, body) => {
  const authError = requireToken(body)
  if (authError) return authError

  if (method === 'manageCategories') {
    if (body.action === 'list') return ok(categories)
    if (body.action === 'add') {
      const next = { _id: randomUUID(), ...(body.data || {}), sort: categories.length + 1 }
      categories.push(next)
      return ok(next)
    }
    if (body.action === 'update') {
      const item = categories.find(category => category._id === body.id)
      if (item) Object.assign(item, body.data || {})
      return ok(item || {})
    }
    if (body.action === 'delete') {
      const index = categories.findIndex(category => category._id === body.id)
      if (index >= 0) categories.splice(index, 1)
      return ok()
    }
  }

  if (method === 'manageFaultKb') {
    if (body.action === 'list') return ok(faults)
    if (body.action === 'add') {
      const next = { _id: randomUUID(), ...(body.data || {}), create_time: Date.now() }
      faults.push(next)
      return ok(next)
    }
    if (body.action === 'update') {
      const item = faults.find(fault => fault._id === body.id)
      if (item) Object.assign(item, body.data || {})
      return ok(item || {})
    }
    if (body.action === 'delete') {
      const index = faults.findIndex(fault => fault._id === body.id)
      if (index >= 0) faults.splice(index, 1)
      return ok()
    }
  }

  return fail(`Unknown local admin-kb method: ${method}`)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, ok())
    return
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const [, service, method] = url.pathname.split('/')

  if (url.pathname.startsWith('/mock-files/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end('Local mock file')
    return
  }

  const body = await readBody(req)
  let payload

  if (service === 'cicada-admin-sys') payload = handleAdminSys(method, body)
  else if (service === 'cicada-admin-order') payload = handleAdminOrder(method, body)
  else if (service === 'cicada-admin-kb') payload = handleAdminKb(method, body)
  else payload = fail(`Unknown local service: ${service}`)

  sendJson(res, payload)
})

server.listen(PORT, () => {
  console.log(`Local mock backend running at http://localhost:${PORT}`)
  console.log('Login with admin / admin123')
})
