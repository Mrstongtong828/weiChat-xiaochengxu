const db = uniCloud.database()
const dbCmd = db.command

// ============== 角色权限 ==============
const STAFF_ROLES = ['admin', 'engineer', 'finance', 'support']
const ROLE_LABELS = { admin: '管理员', engineer: '工程师', finance: '财务', support: '客服' }
const PERMISSIONS = {
  view: STAFF_ROLES,                 // 查看客户列表/详情
  create: ['admin', 'support'],      // 新增客户
  edit: ['admin', 'support'],        // 编辑客户
  cancel: ['admin'],                 // 注销客户（合规）
  view_phone: ['admin'],             // 查看完整手机号
  device: ['admin', 'engineer', 'support'], // 设备绑定/解绑
  export: ['admin']                  // 导出
}

const CUSTOMER_TYPES = ['clinic', 'dealer', 'individual']
const CUSTOMER_SOURCES = ['miniapp', 'offline', 'dealer_referral']
const MAX_PAGE_SIZE = 100

// ============== 通用辅助 ==============
function pickParam(ctx, params) {
  if (params && Object.keys(params).length) return params
  const httpInfo = ctx.getHttpInfo && ctx.getHttpInfo()
  if (httpInfo && httpInfo.body) {
    try { return JSON.parse(httpInfo.body) } catch (e) { return {} }
  }
  return {}
}

function getClientIp(ctx) {
  const httpInfo = ctx && ctx.getHttpInfo && ctx.getHttpInfo()
  const headers = (httpInfo && httpInfo.headers) || {}
  const forwarded = String(headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '').split(',')[0].trim()
  return forwarded || headers['x-real-ip'] || headers['X-Real-IP'] ||
    (httpInfo && (httpInfo.clientIP || httpInfo.clientIp || httpInfo.remoteAddress)) || 'unknown'
}

async function verifyAdminToken(token) {
  if (!token) throw new Error('鉴权失败')
  const res = await db.collection('cicada_users').where({ token }).limit(1).get()
  const user = res.data[0]
  if (!user || user.disabled || !STAFF_ROLES.includes(user.role)) throw new Error('无权限')
  if (!user.token_expire || Date.now() > user.token_expire) throw new Error('Token已过期')
  return user
}

function requirePermission(user, action) {
  const allowed = PERMISSIONS[action] || []
  if (!allowed.includes(user.role)) throw new Error('无权限执行该操作')
  return true
}

function normalizeText(v) { return String(v == null ? '' : v).trim() }

function maskPhone(phone) {
  const p = normalizeText(phone)
  if (!p) return ''
  if (/^\d{11}$/.test(p)) return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  if (p.length >= 7) return p.slice(0, 3) + '****' + p.slice(-2)
  return '****'
}

function isValidPhone(phone) {
  return /^1\d{10}$/.test(normalizeText(phone))
}

function normalizePage(page, pageSize) {
  let p = parseInt(page, 10); let s = parseInt(pageSize, 10)
  if (!Number.isFinite(p) || p < 1) p = 1
  if (!Number.isFinite(s) || s < 1) s = 20
  if (s > MAX_PAGE_SIZE) s = MAX_PAGE_SIZE
  return { page: p, pageSize: s }
}

function toTimestamp(dateStr) {
  const s = normalizeText(dateStr)
  if (!s) return 0
  const t = new Date(s.length <= 10 ? `${s}T23:59:59` : s).getTime()
  return Number.isFinite(t) ? t : 0
}

// 计算设备实际质保到期（取基础质保与所有延保中的最晚值）与状态
function computeWarranty(device) {
  let expire = normalizeText(device.warranty_expire)
  let expireTs = toTimestamp(expire)
  const exts = Array.isArray(device.ext_warranty) ? device.ext_warranty : []
  for (const ext of exts) {
    const ts = toTimestamp(ext && ext.new_expire)
    if (ts > expireTs) { expireTs = ts; expire = normalizeText(ext.new_expire) }
  }
  let status = 'unknown'
  if (expireTs > 0) status = Date.now() <= expireTs ? 'in_warranty' : 'expired'
  if (exts.length > 0 && status === 'in_warranty') status = 'extended'
  return { effective_expire: expire, warranty_state: status }
}

async function writeLog(ctx, operator, action, target, detail) {
  try {
    await db.collection('cicada_customer_logs').add({
      operator_id: operator._id || '',
      operator_name: operator.name || operator.username || '',
      operator_role: operator.role || '',
      action,
      target_id: (target && target._id) || '',
      target_name: (target && target.name) || '',
      detail: normalizeText(detail),
      ip: getClientIp(ctx),
      create_time: Date.now()
    })
  } catch (e) {
    console.error('写操作日志失败:', e && e.message)
  }
}

const EDITABLE_FIELDS = ['name', 'contact', 'phone', 'customer_type', 'source', 'address', 'dealer_id', 'biz_user', 'credit_code', 'product_scope', 'remark', 'tags']

function pickEditable(src) {
  const out = {}
  for (const f of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, f)) out[f] = src[f]
  }
  return out
}

function sanitizeCustomerForList(c) {
  return {
    _id: c._id,
    name: c.name || '',
    contact: c.contact || '',
    phone_mask: maskPhone(c.phone),
    has_phone: !!normalizeText(c.phone),
    customer_type: c.customer_type || 'clinic',
    source: c.source || '',
    address: c.address || '',
    dealer_id: c.dealer_id || '',
    biz_user: c.biz_user || '',
    tags: Array.isArray(c.tags) ? c.tags : [],
    remark: c.remark || '',
    nickname: c.nickname || '',
    avatar: c.avatar || '',
    has_account: !!normalizeText(c.user_id || c.openid),
    status: c.status || 'active',
    create_time: c.create_time || 0
  }
}

module.exports = {
  _before() {
    const httpInfo = this.getHttpInfo && this.getHttpInfo()
    if (httpInfo && httpInfo.body) {
      try { this.params = JSON.parse(httpInfo.body) } catch (e) { /* ignore */ }
    }
  },

  // ============== 客户列表 ==============
  async listCustomers(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'view')

      const { page, pageSize } = normalizePage(p.page, p.pageSize)
      const keyword = normalizeText(p.keyword).toLowerCase()
      const customerType = normalizeText(p.customer_type)
      const statusFilter = normalizeText(p.status) || 'active' // active/cancelled/all
      const dealerId = normalizeText(p.dealer_id)
      const tagFilter = normalizeText(p.tag)

      const where = {}
      if (statusFilter !== 'all') where.status = statusFilter === 'cancelled' ? 'cancelled' : dbCmd.neq('cancelled')
      if (customerType && CUSTOMER_TYPES.includes(customerType)) where.customer_type = customerType
      if (dealerId) where.dealer_id = dealerId
      if (tagFilter) where.tags = tagFilter // 数组字段：包含该标签即命中

      const col = db.collection('cicada_customers')
      let list = []
      let total = 0

      if (keyword) {
        // 关键字（客户名/联系人/手机号）需内存过滤，扫描后分页
        const scan = await col.where(where).orderBy('create_time', 'desc').limit(1000).get()
        const filtered = scan.data.filter(c => {
          const hay = [c.name, c.contact, c.phone].map(normalizeText).join(' ').toLowerCase()
          return hay.includes(keyword)
        })
        total = filtered.length
        list = filtered.slice((page - 1) * pageSize, page * pageSize)
      } else {
        const countRes = await col.where(where).count()
        total = countRes.total
        const res = await col.where(where).orderBy('create_time', 'desc')
          .skip((page - 1) * pageSize).limit(pageSize).get()
        list = res.data
      }

      // 逐行补充统计（工单数 / 设备数 / 最后报修时间）
      const enriched = await Promise.all(list.map(async (c) => {
        const base = sanitizeCustomerForList(c)
        let orderCount = 0, lastOrderTime = 0, deviceCount = 0
        try {
          const deviceOr = [{ customer_id: c._id }]
          if (c.user_id) deviceOr.push({ user_id: c.user_id })
          const devRes = await db.collection('cicada_user_devices').where(dbCmd.or(deviceOr)).count()
          deviceCount = devRes.total
        } catch (e) { /* ignore */ }
        if (c.user_id) {
          try {
            const ordersCol = db.collection('cicada_orders')
            const oc = await ordersCol.where({ user_id: c.user_id }).count()
            orderCount = oc.total
            if (orderCount > 0) {
              const last = await ordersCol.where({ user_id: c.user_id }).orderBy('create_time', 'desc').limit(1).get()
              lastOrderTime = (last.data[0] && last.data[0].create_time) || 0
            }
          } catch (e) { /* ignore */ }
        }
        return { ...base, order_count: orderCount, device_count: deviceCount, last_order_time: lastOrderTime }
      }))

      return { code: 0, data: { list: enriched, total, page, pageSize } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 客户详情（基础信息 + 统计） ==============
  async getCustomerDetail(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'view')
      const id = normalizeText(p.customer_id || p._id)
      if (!id) return { code: -1, msg: '缺少客户ID' }

      const res = await db.collection('cicada_customers').doc(id).get()
      const c = res.data && res.data[0]
      if (!c) return { code: -1, msg: '客户不存在' }

      const detail = sanitizeCustomerForList(c)
      detail.credit_code = c.credit_code || ''
      detail.product_scope = c.product_scope || ''
      detail.cancelled_at = c.cancelled_at || 0
      detail.update_time = c.update_time || 0

      return { code: 0, data: detail }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 查看完整手机号（合规：管理员 + 记日志） ==============
  async getCustomerPhone(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'view_phone')
      const id = normalizeText(p.customer_id)
      if (!id) return { code: -1, msg: '缺少客户ID' }

      const res = await db.collection('cicada_customers').doc(id).get()
      const c = res.data && res.data[0]
      if (!c) return { code: -1, msg: '客户不存在' }

      await writeLog(this, admin, 'view_phone', c, `查看客户[${c.name}]完整手机号`)
      return { code: 0, data: { phone: c.phone || '' } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 新增客户 ==============
  async createCustomer(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'create')

      const data = pickEditable(p.customer || p)
      data.name = normalizeText(data.name)
      data.phone = normalizeText(data.phone)
      if (!data.name) return { code: -1, msg: '客户名称不能为空' }
      if (data.customer_type && !CUSTOMER_TYPES.includes(data.customer_type)) return { code: -1, msg: '客户类型不正确' }
      if (data.source && !CUSTOMER_SOURCES.includes(data.source)) return { code: -1, msg: '客户来源不正确' }
      if (data.phone && !isValidPhone(data.phone)) return { code: -1, msg: '手机号格式不正确' }

      // 手机号重复校验（仅未注销客户）
      if (data.phone) {
        const dup = await db.collection('cicada_customers')
          .where({ phone: data.phone, status: dbCmd.neq('cancelled') }).limit(1).get()
        if (dup.data.length) return { code: -1, msg: '该手机号已存在客户档案，请勿重复建档' }
      }

      const now = Date.now()
      const doc = {
        ...data,
        customer_type: data.customer_type || 'clinic',
        source: data.source || 'offline',
        tags: Array.isArray(data.tags) ? data.tags : [],
        user_id: '',
        openid: '',
        status: 'active',
        create_time: now,
        update_time: now
      }
      const res = await db.collection('cicada_customers').add(doc)
      await writeLog(this, admin, 'create', { _id: res.id, name: doc.name }, `新增客户[${doc.name}]`)
      return { code: 0, data: { id: res.id } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 编辑客户 ==============
  async updateCustomer(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'edit')
      const id = normalizeText(p.customer_id || (p.customer && p.customer._id) || p._id)
      if (!id) return { code: -1, msg: '缺少客户ID' }

      const cur = await db.collection('cicada_customers').doc(id).get()
      const exist = cur.data && cur.data[0]
      if (!exist) return { code: -1, msg: '客户不存在' }
      if (exist.status === 'cancelled') return { code: -1, msg: '已注销客户为只读，不可编辑' }

      const data = pickEditable(p.customer || p)
      if (Object.prototype.hasOwnProperty.call(data, 'name')) {
        data.name = normalizeText(data.name)
        if (!data.name) return { code: -1, msg: '客户名称不能为空' }
      }
      if (data.customer_type && !CUSTOMER_TYPES.includes(data.customer_type)) return { code: -1, msg: '客户类型不正确' }
      if (data.source && !CUSTOMER_SOURCES.includes(data.source)) return { code: -1, msg: '客户来源不正确' }
      if (Object.prototype.hasOwnProperty.call(data, 'phone')) {
        data.phone = normalizeText(data.phone)
        if (data.phone && !isValidPhone(data.phone)) return { code: -1, msg: '手机号格式不正确' }
        if (data.phone && data.phone !== exist.phone) {
          const dup = await db.collection('cicada_customers')
            .where({ phone: data.phone, status: dbCmd.neq('cancelled'), _id: dbCmd.neq(id) }).limit(1).get()
          if (dup.data.length) return { code: -1, msg: '该手机号已被其他客户档案使用' }
        }
      }
      if (!Object.keys(data).length) return { code: -1, msg: '没有可更新的字段' }

      data.update_time = Date.now()
      await db.collection('cicada_customers').doc(id).update(data)
      await writeLog(this, admin, 'edit', { _id: id, name: data.name || exist.name }, `编辑客户[${data.name || exist.name}]：${Object.keys(data).filter(k => k !== 'update_time').join('、')}`)
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 注销客户（合规：脱敏 + 解绑，不物理删除） ==============
  async cancelCustomer(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'cancel')
      const id = normalizeText(p.customer_id || p._id)
      if (!id) return { code: -1, msg: '缺少客户ID' }

      const cur = await db.collection('cicada_customers').doc(id).get()
      const exist = cur.data && cur.data[0]
      if (!exist) return { code: -1, msg: '客户不存在' }
      if (exist.status === 'cancelled') return { code: -1, msg: '该客户已注销' }

      const now = Date.now()
      await db.collection('cicada_customers').doc(id).update({
        status: 'cancelled',
        phone: '',
        address: '',
        openid: '',
        user_id: '',
        cancelled_at: now,
        update_time: now
      })
      await writeLog(this, admin, 'cancel', { _id: id, name: exist.name }, `注销客户[${exist.name}]，已脱敏手机号/地址并解绑微信`)
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 客户名下设备列表 ==============
  async listCustomerDevices(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'view')
      const id = normalizeText(p.customer_id)
      if (!id) return { code: -1, msg: '缺少客户ID' }

      const cur = await db.collection('cicada_customers').doc(id).get()
      const c = cur.data && cur.data[0]
      if (!c) return { code: -1, msg: '客户不存在' }

      const or = [{ customer_id: id }]
      if (c.user_id) or.push({ user_id: c.user_id })
      const res = await db.collection('cicada_user_devices').where(dbCmd.or(or)).orderBy('create_time', 'desc').get()
      const list = res.data.map(d => ({
        _id: d._id,
        product_category: d.product_category || '',
        product_name: d.product_name || '',
        model: d.model || '',
        sn: d.sn || '',
        purchase_channel: d.purchase_channel || '',
        dealer_name: d.dealer_name || '',
        buy_date: d.buy_date || '',
        warranty_months: Number(d.warranty_months || 0) || 0,
        warranty_expire: d.warranty_expire || '',
        maintenance_cycle: d.maintenance_cycle || '',
        ext_warranty: Array.isArray(d.ext_warranty) ? d.ext_warranty : [],
        ...computeWarranty(d),
        create_time: d.create_time || 0
      }))
      return { code: 0, data: list }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 新增/编辑设备（含延保） ==============
  async saveCustomerDevice(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'device')
      const customerId = normalizeText(p.customer_id)
      if (!customerId) return { code: -1, msg: '缺少客户ID' }
      const cur = await db.collection('cicada_customers').doc(customerId).get()
      const c = cur.data && cur.data[0]
      if (!c) return { code: -1, msg: '客户不存在' }
      if (c.status === 'cancelled') return { code: -1, msg: '已注销客户不可绑定设备' }

      const dv = p.device || {}
      const productName = normalizeText(dv.product_name)
      if (!productName) return { code: -1, msg: '设备名称不能为空' }
      const sn = normalizeText(dv.sn)

      // SN 唯一校验（同一 SN 不可绑定到多处）
      if (sn) {
        const dupWhere = { sn }
        if (dv._id) dupWhere._id = dbCmd.neq(dv._id)
        const dup = await db.collection('cicada_user_devices').where(dupWhere).limit(1).get()
        if (dup.data.length) return { code: -1, msg: `SN[${sn}]已被其他设备占用` }
      }

      const data = {
        product_category: normalizeText(dv.product_category),
        product_name: productName,
        model: normalizeText(dv.model),
        sn,
        purchase_channel: normalizeText(dv.purchase_channel),
        dealer_name: normalizeText(dv.dealer_name),
        buy_date: normalizeText(dv.buy_date),
        warranty_months: Number(dv.warranty_months || 0) || 0,
        warranty_expire: normalizeText(dv.warranty_expire),
        maintenance_cycle: normalizeText(dv.maintenance_cycle),
        ext_warranty: Array.isArray(dv.ext_warranty) ? dv.ext_warranty : [],
        update_time: Date.now()
      }

      const col = db.collection('cicada_user_devices')
      if (dv._id) {
        const r = await col.doc(dv._id).update(data)
        if (!r.updated) return { code: -1, msg: '设备不存在' }
        await writeLog(this, admin, 'device_save', { _id: customerId, name: c.name }, `更新设备[${productName}/${sn || '无SN'}]`)
        return { code: 0 }
      } else {
        data.customer_id = customerId
        data.user_id = c.user_id || ''
        data.create_time = Date.now()
        const r = await col.add(data)
        await writeLog(this, admin, 'device_save', { _id: customerId, name: c.name }, `绑定设备[${productName}/${sn || '无SN'}]`)
        return { code: 0, data: { id: r.id } }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 解绑/删除设备 ==============
  async deleteCustomerDevice(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'device')
      const deviceId = normalizeText(p.device_id)
      const customerId = normalizeText(p.customer_id)
      if (!deviceId) return { code: -1, msg: '缺少设备ID' }
      const r = await db.collection('cicada_user_devices').doc(deviceId).remove()
      if (!r.deleted) return { code: -1, msg: '设备不存在' }
      await writeLog(this, admin, 'device_delete', { _id: customerId }, `解绑设备 ${deviceId}`)
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 客户历史工单 ==============
  async listCustomerOrders(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'view')
      const id = normalizeText(p.customer_id)
      if (!id) return { code: -1, msg: '缺少客户ID' }
      const cur = await db.collection('cicada_customers').doc(id).get()
      const c = cur.data && cur.data[0]
      if (!c) return { code: -1, msg: '客户不存在' }
      // 按 (customer_id 或 user_id) 关联，换绑/历史单都不丢
      const orFilters = [{ customer_id: id }]
      if (c.user_id) orFilters.push({ user_id: c.user_id })

      const res = await db.collection('cicada_orders')
        .where(dbCmd.or(orFilters)).orderBy('create_time', 'desc').limit(200).get()
      let totalAmount = 0
      const list = res.data.map(o => {
        const price = Number(o.total_price) || 0
        totalAmount += price
        return {
          _id: o._id,
          order_no: o.order_no || '',
          status: o.status || '',
          total_price: price,
          create_time: o.create_time || 0
        }
      })
      return { code: 0, data: { list, total: list.length, total_amount: Number(totalAmount.toFixed(2)) } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 客户操作日志 ==============
  async getCustomerLogs(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'view')
      const where = {}
      const id = normalizeText(p.customer_id)
      if (id) where.target_id = id
      const res = await db.collection('cicada_customer_logs')
        .where(where).orderBy('create_time', 'desc').limit(200).get()
      return { code: 0, data: res.data }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 经销商下拉（用于归属选择） ==============
  async listDealers(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'view')
      const res = await db.collection('cicada_customers')
        .where({ customer_type: 'dealer', status: dbCmd.neq('cancelled') })
        .field({ name: true }).orderBy('create_time', 'desc').limit(500).get()
      return { code: 0, data: res.data.map(d => ({ _id: d._id, name: d.name })) }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 标签库：列表 ==============
  async listTags(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'view')
      const res = await db.collection('cicada_customer_tags').orderBy('sort', 'asc').orderBy('create_time', 'asc').limit(500).get()
      return { code: 0, data: res.data }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 标签库：新增/编辑 ==============
  async saveTag(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'edit')
      const tag = p.tag || {}
      const name = normalizeText(tag.name)
      if (!name) return { code: -1, msg: '标签名称不能为空' }
      const col = db.collection('cicada_customer_tags')
      const now = Date.now()
      const data = {
        name,
        color: normalizeText(tag.color) || '',
        category: normalizeText(tag.category) || 'ops',
        sort: Number.isFinite(parseInt(tag.sort, 10)) ? parseInt(tag.sort, 10) : 0,
        update_time: now
      }
      if (tag._id) {
        const dup = await col.where({ name, _id: dbCmd.neq(tag._id) }).limit(1).get()
        if (dup.data.length) return { code: -1, msg: '标签名称已存在' }
        const r = await col.doc(tag._id).update(data)
        if (!r.updated) return { code: -1, msg: '标签不存在' }
        return { code: 0 }
      }
      const dup = await col.where({ name }).limit(1).get()
      if (dup.data.length) return { code: -1, msg: '标签名称已存在' }
      const r = await col.add({ ...data, create_time: now })
      return { code: 0, data: { id: r.id } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 标签库：删除（同时从所有客户移除该标签） ==============
  async deleteTag(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'edit')
      const id = normalizeText(p.tag_id)
      if (!id) return { code: -1, msg: '缺少标签ID' }
      const col = db.collection('cicada_customer_tags')
      const cur = await col.doc(id).get()
      const tag = cur.data && cur.data[0]
      if (!tag) return { code: -1, msg: '标签不存在' }
      await col.doc(id).remove()
      // 从引用该标签的客户档案中移除
      const customerCol = db.collection('cicada_customers')
      const affected = await customerCol.where({ tags: tag.name }).limit(1000).get()
      for (const c of affected.data) {
        const tags = (Array.isArray(c.tags) ? c.tags : []).filter(t => t !== tag.name)
        await customerCol.doc(c._id).update({ tags, update_time: Date.now() })
      }
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 批量打标 / 移除标签 ==============
  async batchTag(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'edit')
      const ids = Array.isArray(p.customer_ids) ? p.customer_ids.filter(Boolean) : []
      const tags = Array.isArray(p.tags) ? p.tags.map(normalizeText).filter(Boolean) : [normalizeText(p.tag)].filter(Boolean)
      const op = p.op === 'remove' ? 'remove' : 'add'
      if (!ids.length) return { code: -1, msg: '请选择客户' }
      if (!tags.length) return { code: -1, msg: '请选择标签' }

      const col = db.collection('cicada_customers')
      const res = await col.where({ _id: dbCmd.in(ids) }).get()
      const now = Date.now()
      let updated = 0
      for (const c of res.data) {
        if (c.status === 'cancelled') continue
        const cur = new Set(Array.isArray(c.tags) ? c.tags : [])
        if (op === 'add') tags.forEach(t => cur.add(t))
        else tags.forEach(t => cur.delete(t))
        await col.doc(c._id).update({ tags: Array.from(cur), update_time: now })
        updated++
      }
      await writeLog(this, admin, 'edit', { name: '批量标签' }, `${op === 'add' ? '批量打标' : '批量移除标签'}[${tags.join('、')}]，影响 ${updated} 个客户`)
      return { code: 0, data: { updated } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 导出客户档案（管理员，记日志） ==============
  async exportCustomers(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'export')

      const keyword = normalizeText(p.keyword).toLowerCase()
      const customerType = normalizeText(p.customer_type)
      const statusFilter = normalizeText(p.status) || 'active'
      const tagFilter = normalizeText(p.tag)

      const where = {}
      if (statusFilter !== 'all') where.status = statusFilter === 'cancelled' ? 'cancelled' : dbCmd.neq('cancelled')
      if (customerType && CUSTOMER_TYPES.includes(customerType)) where.customer_type = customerType
      if (tagFilter) where.tags = tagFilter

      const res = await db.collection('cicada_customers').where(where).orderBy('create_time', 'desc').limit(5000).get()
      let rows = res.data
      if (keyword) {
        rows = rows.filter(c => [c.name, c.contact, c.phone].map(normalizeText).join(' ').toLowerCase().includes(keyword))
      }

      // 解析归属经销商名称
      const dealerIds = [...new Set(rows.map(r => r.dealer_id).filter(Boolean))]
      const dealerMap = {}
      if (dealerIds.length) {
        const dRes = await db.collection('cicada_customers').where({ _id: dbCmd.in(dealerIds) }).field({ name: true }).get()
        dRes.data.forEach(d => { dealerMap[d._id] = d.name })
      }

      const data = rows.map(c => ({
        name: c.name || '',
        contact: c.contact || '',
        phone: c.phone || '',
        customer_type: c.customer_type || '',
        source: c.source || '',
        address: c.address || '',
        dealer_name: c.dealer_id ? (dealerMap[c.dealer_id] || '') : '',
        credit_code: c.credit_code || '',
        biz_user: c.biz_user || '',
        tags: Array.isArray(c.tags) ? c.tags.join('，') : '',
        status: c.status || 'active',
        remark: c.remark || '',
        create_time: c.create_time || 0
      }))

      await writeLog(this, admin, 'export', { name: '批量导出' }, `导出客户档案 ${data.length} 条`)
      return { code: 0, data }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 批量导入客户 ==============
  async batchImportCustomers(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'create')
      const rows = Array.isArray(p.rows) ? p.rows : []
      if (!rows.length) return { code: -1, msg: '没有可导入的数据' }
      if (rows.length > 1000) return { code: -1, msg: '单次最多导入 1000 条' }

      const TYPE_ALIAS = { '终端诊所': 'clinic', '诊所': 'clinic', '经销商': 'dealer', '个人散户': 'individual', '散户': 'individual', '个人': 'individual', clinic: 'clinic', dealer: 'dealer', individual: 'individual' }
      const col = db.collection('cicada_customers')
      const now = Date.now()
      const failed = []
      const seenPhones = new Set()
      let success = 0

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] || {}
        const rowNo = i + 1
        const name = normalizeText(r.name)
        const phone = normalizeText(r.phone)
        if (!name) { failed.push({ row: rowNo, name, reason: '客户名称为空' }); continue }
        if (phone && !isValidPhone(phone)) { failed.push({ row: rowNo, name, reason: '手机号格式不正确' }); continue }
        if (phone) {
          if (seenPhones.has(phone)) { failed.push({ row: rowNo, name, reason: '文件内手机号重复' }); continue }
          const dup = await col.where({ phone, status: dbCmd.neq('cancelled') }).limit(1).get()
          if (dup.data.length) { failed.push({ row: rowNo, name, reason: '手机号已存在档案' }); continue }
          seenPhones.add(phone)
        }
        const tags = normalizeText(r.tags) ? normalizeText(r.tags).split(/[，,、\s]+/).filter(Boolean) : []
        await col.add({
          name,
          contact: normalizeText(r.contact),
          phone,
          customer_type: TYPE_ALIAS[normalizeText(r.customer_type)] || 'clinic',
          source: 'offline',
          address: normalizeText(r.address),
          credit_code: normalizeText(r.credit_code),
          biz_user: normalizeText(r.biz_user),
          remark: normalizeText(r.remark),
          tags,
          user_id: '',
          openid: '',
          status: 'active',
          create_time: now,
          update_time: now
        })
        success++
      }
      await writeLog(this, admin, 'create', { name: '批量导入' }, `批量导入客户：成功 ${success} 条，失败 ${failed.length} 条`)
      return { code: 0, data: { success, failed, total: rows.length } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // ============== 从 cicada_users(role=user) 回填客户档案（一次性/可重复执行） ==============
  async syncCustomersFromUsers(params) {
    try {
      const p = pickParam(this, params)
      const admin = await verifyAdminToken(p.token)
      requirePermission(admin, 'create')

      const users = await db.collection('cicada_users').where({ role: 'user' }).limit(1000).get()
      const customerCol = db.collection('cicada_customers')
      let created = 0
      for (const u of users.data) {
        const matchOr = []
        if (u._id) matchOr.push({ user_id: u._id })
        if (u.openid) matchOr.push({ openid: u.openid })
        if (!matchOr.length) continue
        const exist = await customerCol.where(dbCmd.or(matchOr)).limit(1).get()
        if (exist.data.length) continue
        const now = Date.now()
        await customerCol.add({
          name: normalizeText(u.name || u.nickname || u.phone || '微信客户'),
          contact: normalizeText(u.name || u.nickname),
          phone: normalizeText(u.phone),
          customer_type: 'clinic',
          source: 'miniapp',
          address: '',
          tags: [],
          user_id: u._id || '',
          openid: u.openid || '',
          status: 'active',
          create_time: u.create_time || now,
          update_time: now
        })
        created++
      }
      await writeLog(this, admin, 'sync', { name: '批量同步' }, `从小程序用户回填客户档案 ${created} 条`)
      return { code: 0, data: { created, scanned: users.data.length } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
