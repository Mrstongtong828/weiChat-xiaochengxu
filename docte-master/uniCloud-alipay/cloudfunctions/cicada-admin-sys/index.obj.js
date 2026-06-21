const db = uniCloud.database()
const crypto = require('crypto')
const { ROLE_LABELS, ALL_ROLES, PERMISSIONS } = loadWorkflowModule()

function loadWorkflowModule() {
  try {
    return require('cicada-order-workflow')
  } catch (packageError) {
    return require('../common/cicada-order-workflow')
  }
}

const ADMIN_TOKEN_EXPIRE = 8 * 3600 * 1000 // 8小时
const STAFF_ROLES = ALL_ROLES
const ADMIN_LOGIN_RATE_LIMIT = {
  max: 5,
  windowMs: 15 * 60 * 1000
}
const GUIDE_DEFAULTS = [
  {
    type: 'quick',
    category: '快速指南',
    desc: '跳转到图文并茂的快速入门文档，帮助用户快速了解小程序售后流程。',
    file_name: '',
    file_url: '',
    sort: 1
  },
  {
    type: 'repair',
    category: '报修指南',
    desc: '跳转到图文并茂的报修文档，说明报修流程、寄出注意事项和进度查询方式。',
    file_name: '',
    file_url: '',
    sort: 2
  },
  {
    type: 'query',
    category: '查询指南',
    desc: '跳转到图文并茂的查询文档，说明工单、物流和维修进度查询方式。',
    file_name: '',
    file_url: '',
    sort: 3
  },
  {
    type: 'invoice',
    category: '开票指南',
    desc: '跳转到图文并茂的开票文档，说明发票申请、资料填写和开票进度查看方式。',
    file_name: '',
    file_url: '',
    sort: 4
  }
]
const GUIDE_TYPE_ALIASES = {
  quick: ['快速指南', '快速入门'],
  repair: ['报修指南', '报修流程'],
  query: ['查询指南', '查询办法', '维修查询', '物流寄送'],
  invoice: ['开票指南', '发票开具']
}

function genToken() {
  return crypto.randomBytes(32).toString('hex')
}

function genSalt() {
  return crypto.randomBytes(16).toString('hex')
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex')
}

function pickFields(source = {}, fields = []) {
  return fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field]
    }
    return result
  }, {})
}

function fbText(value, max = 1000) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function fbPage(page, pageSize) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10))
  return { page: p, pageSize: size }
}

// 复用 cicada_order_events 记录投诉处理审计（医疗器械合规备查）
async function writeFeedbackEvent(actor, feedback, action, before, after) {
  try {
    await db.collection('cicada_order_events').add({
      order_id: feedback._id,
      order_no: feedback.rel_order_no || `FB-${feedback._id}`,
      source: 'admin',
      action,
      actor_id: actor._id,
      actor_role: actor.role,
      actor_name: actor.name || actor.nickname || actor.username || '',
      before: before || {},
      after: after || {},
      create_time: Date.now()
    })
  } catch (e) {
    // 审计写入失败不阻断主流程
    console.warn('writeFeedbackEvent failed:', e.message)
  }
}

async function loadFeedback(id) {
  const feedbackId = fbText(id, 60)
  if (!feedbackId) throw new Error('缺少反馈ID')
  const res = await db.collection('cicada_feedbacks').doc(feedbackId).get()
  const feedback = res.data && res.data[0]
  if (!feedback) throw new Error('反馈不存在')
  return feedback
}

function buildPasswordFields(password) {
  const password_salt = genSalt()
  return {
    password_hash: hashPassword(password, password_salt),
    password_salt,
    password: ''
  }
}

function matchGuideType(item = {}) {
  const type = String(item.type || '').trim()
  if (GUIDE_TYPE_ALIASES[type]) return type

  const category = String(item.category || '')
  const matched = Object.entries(GUIDE_TYPE_ALIASES)
    .find(([, aliases]) => aliases.some(alias => category.includes(alias)))
  return matched ? matched[0] : ''
}

async function ensureGuideDefaults() {
  const col = db.collection('cicada_guides')
  const res = await col.get()
  const existingTypes = new Set((res.data || []).map(matchGuideType).filter(Boolean))
  const now = Date.now()

  for (const guide of GUIDE_DEFAULTS) {
    if (!existingTypes.has(guide.type)) {
      await col.add({ ...guide, update_time: now })
      existingTypes.add(guide.type)
    }
  }
}

async function verifyAdminToken(token, allowedRoles = ['admin']) {
  if (!token) throw new Error('鉴权失败')
  const res = await db.collection('cicada_users').where({ token }).limit(1).get()
  const user = res.data[0]
  if (!user || user.disabled || (user.role !== 'superadmin' && !allowedRoles.includes(user.role))) {
    throw new Error('无权限')
  }
  if (!user.token_expire || Date.now() > user.token_expire) throw new Error('Token已过期')
  return user
}

function normalizeIdentity(value = '') {
  return String(value || '').trim().toLowerCase()
}

function getClientIp(ctx) {
  const httpInfo = ctx && ctx.getHttpInfo && ctx.getHttpInfo()
  const headers = (httpInfo && httpInfo.headers) || {}
  const forwardedFor = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || ''
  const forwardedIp = String(forwardedFor).split(',')[0].trim()
  return forwardedIp ||
    headers['x-real-ip'] ||
    headers['X-Real-IP'] ||
    (httpInfo && (httpInfo.clientIP || httpInfo.clientIp || httpInfo.remoteAddress)) ||
    'unknown'
}

async function getRateLimitRecord(key) {
  const res = await db.collection('cicada_rate_limits').where({ key }).limit(1).get()
  return res.data && res.data[0]
}

async function assertAdminLoginAllowed(username, ip) {
  const identities = [
    { scope: 'admin-login:username', identity: normalizeIdentity(username) },
    { scope: 'admin-login:ip', identity: normalizeIdentity(ip) }
  ].filter(item => item.identity)
  const now = Date.now()

  for (const item of identities) {
    const record = await getRateLimitRecord(`${item.scope}:${item.identity}`)
    if (record && now <= record.reset_time && record.count >= ADMIN_LOGIN_RATE_LIMIT.max) {
      throw new Error('登录失败次数过多，请 15 分钟后再试')
    }
  }
}

async function recordRateLimitHit(scope, identity) {
  const normalized = normalizeIdentity(identity)
  if (!normalized) return

  const now = Date.now()
  const key = `${scope}:${normalized}`
  const col = db.collection('cicada_rate_limits')
  const record = await getRateLimitRecord(key)

  if (!record || now > record.reset_time) {
    const nextData = {
      key,
      scope,
      identity: normalized,
      count: 1,
      reset_time: now + ADMIN_LOGIN_RATE_LIMIT.windowMs,
      update_time: now
    }
    if (record) {
      await col.doc(record._id).update(nextData)
    } else {
      await col.add({
        ...nextData,
        create_time: now
      })
    }
    return
  }

  await col.doc(record._id).update({
    count: db.command.inc(1),
    update_time: now
  })
}

async function recordAdminLoginFailure(username, ip, userId = '') {
  await Promise.all([
    recordRateLimitHit('admin-login:username', username),
    recordRateLimitHit('admin-login:ip', ip)
  ])

  if (userId) {
    await db.collection('cicada_users').doc(userId).update({
      failed_login_count: db.command.inc(1),
      last_failed_login: Date.now(),
      last_login_ip: ip
    })
  }
}

async function clearRateLimit(scope, identity) {
  const normalized = normalizeIdentity(identity)
  if (!normalized) return
  const record = await getRateLimitRecord(`${scope}:${normalized}`)
  if (record) await db.collection('cicada_rate_limits').doc(record._id).remove()
}

async function clearAdminLoginFailures(username, ip) {
  await Promise.all([
    clearRateLimit('admin-login:username', username),
    clearRateLimit('admin-login:ip', ip)
  ])
}

function verifyPassword(user, password) {
  if (!password) return false
  if (user.password_hash && user.password_salt) {
    const inputHash = hashPassword(password, user.password_salt)
    const inputBuffer = Buffer.from(inputHash)
    const storedBuffer = Buffer.from(user.password_hash)
    return inputBuffer.length === storedBuffer.length && crypto.timingSafeEqual(inputBuffer, storedBuffer)
  }

  // 兼容历史明文密码账号，登录成功后会迁移为哈希存储。
  return user.password === password
}

function getRequestData(ctx, params) {
  if (params && Object.keys(params).length) return params
  if (ctx && ctx.params && Object.keys(ctx.params).length) return ctx.params
  const httpInfo = ctx && ctx.getHttpInfo && ctx.getHttpInfo()
  if (httpInfo && httpInfo.body) {
    try {
      return JSON.parse(httpInfo.body)
    } catch (e) {
      return {}
    }
  }
  return {}
}

async function uploadAdminFile(ctx, params, defaultDir = 'guides/') {
  const data = getRequestData(ctx, params)
  const { token, fileContent, fileName, fileType, dir } = data
  await verifyAdminToken(token, ['admin'])

  if (!fileContent || !fileName) return { code: -1, msg: '缺少文件内容或文件名' }

  const buffer = Buffer.from(fileContent, 'base64')
  const safeFileName = String(fileName).replace(/[\\/:*?"<>|]/g, '_')
  const safeDir = String(dir || defaultDir).replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/\/+$/, '') || 'guides'
  const cloudPath = `${safeDir}/${Date.now()}_${safeFileName}`
  const res = await uniCloud.uploadFile({
    cloudPath,
    fileContent: buffer,
    fileType: fileType || 'application/octet-stream'
  })

  let tempUrl = ''
  try {
    const t = await uniCloud.getTempFileURL({ fileList: [res.fileID] })
    tempUrl = (t.fileList && t.fileList[0] && t.fileList[0].tempFileURL) || ''
  } catch (err) {
    tempUrl = ''
  }

  return { code: 0, data: { fileUrl: res.fileID, tempUrl } }
}

module.exports = {
  _before() {
    // 处理 HTTP 请求参数
    const httpInfo = this.getHttpInfo && this.getHttpInfo()
    if (httpInfo && httpInfo.body) {
      try {
        const body = JSON.parse(httpInfo.body)
        this.params = body
      } catch (e) {
        console.error('解析请求体失败:', e)
      }
    }
  },

  async adminLogin(params) {
    try {
      // 从 HTTP 请求中获取参数
      let username, password
      if (params && params.username) {
        ({ username, password } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ username, password } = body)
        }
      }
      const loginIp = getClientIp(this)
      if (!username || !password) return { code: -1, msg: '用户名或密码错误' }
      await assertAdminLoginAllowed(username, loginIp)
      const res = await db.collection('cicada_users')
        .where({ username })
        .limit(1)
        .get()
      if (!res.data.length) {
        await recordAdminLoginFailure(username, loginIp)
        return { code: -1, msg: '用户名或密码错误' }
      }

      const user = res.data[0]
      if (!STAFF_ROLES.includes(user.role) || user.disabled) {
        await recordAdminLoginFailure(username, loginIp, user._id)
        return { code: -1, msg: '无管理权限' }
      }
      const pwdCheck = verifyPassword(user, password)
      if (!pwdCheck) {
        await recordAdminLoginFailure(username, loginIp, user._id)
        return { code: -1, msg: '用户名或密码错误' }
      }

      const token = genToken()
      const tokenExpire = Date.now() + ADMIN_TOKEN_EXPIRE
      const updateData = {
        token,
        token_expire: tokenExpire,
        last_login: Date.now(),
        last_login_ip: loginIp,
        failed_login_count: 0
      }
      if (!user.password_hash || !user.password_salt) {
        Object.assign(updateData, buildPasswordFields(password))
      }
      // admin_root 紧急救援账号固定为超级管理员（首次登录自愈）
      if (user.username === 'admin_root' && user.role !== 'superadmin') {
        updateData.role = 'superadmin'
        user.role = 'superadmin'
      }
      await db.collection('cicada_users').doc(user._id).update(updateData)
      await clearAdminLoginFailures(username, loginIp)

      return {
        code: 0,
        msg: '登录成功',
        token: token,
        userId: user._id,
        role: user.role,
        isAdmin: user.role === 'admin',
        isEngineer: user.role === 'engineer',
        isFinance: user.role === 'finance',
        isSupport: user.role === 'support',
        user: {
          _id: user._id,
          username: user.username,
          name: user.name || user.nickname || '',
          phone: user.phone || '',
          role: user.role,
          roleDisplay: ROLE_LABELS[user.role] || user.role
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async changeMyPassword(params) {
    try {
      let token, oldPassword, newPassword
      if (params && params.token) {
        ({ token, oldPassword, newPassword } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ token, oldPassword, newPassword } = body)
        }
      }

      if (!oldPassword || !newPassword) return { code: -1, msg: '请填写原密码和新密码' }
      if (String(newPassword).length < 6) return { code: -1, msg: '新密码至少需要 6 位' }
      if (oldPassword === newPassword) return { code: -1, msg: '新密码不能与原密码相同' }

      const user = await verifyAdminToken(token, STAFF_ROLES)
      if (!verifyPassword(user, oldPassword)) return { code: -1, msg: '原密码不正确' }

      await db.collection('cicada_users').doc(user._id).update({
        ...buildPasswordFields(newPassword),
        token: '',
        token_expire: 0,
        update_time: Date.now()
      })

      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async resetUserPassword(params) {
    try {
      let token, userId
      if (params && params.token) {
        ({ token, userId } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ token, userId } = body)
        }
      }

      if (!userId) return { code: -1, msg: '缺少用户ID' }
      await verifyAdminToken(token, ['admin'])

      const col = db.collection('cicada_users')
      const targetRes = await col.doc(userId).get()
      const target = targetRes.data && targetRes.data[0]
      if (!target || !STAFF_ROLES.includes(target.role)) return { code: -1, msg: '用户不存在' }
      if (target.username === 'admin_root') return { code: -1, msg: 'admin_root 为紧急救援账号，禁止重置密码' }

      await col.doc(userId).update({
        ...buildPasswordFields('123456'),
        token: '',
        token_expire: 0,
        update_time: Date.now()
      })

      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async manageStaff(params) {
    try {
      let token, action, staff
      if (params && params.token) {
        ({ token, action, staff } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ token, action, staff } = body)
        }
      }
      const operator = await verifyAdminToken(token, ['admin'])
      const col = db.collection('cicada_users')
      if (action === 'add') {
        if (!staff || !staff.username || !staff.password) return { code: -1, msg: '账号和密码不能为空' }
        if (!STAFF_ROLES.includes(staff.role)) return { code: -1, msg: '角色不正确' }
        if (staff.role === 'superadmin' && operator.role !== 'superadmin') return { code: -1, msg: '只有超级管理员可创建超级管理员账号' }
        const exists = await col.where({ username: staff.username }).limit(1).get()
        if (exists.data.length) return { code: -1, msg: '账号已存在' }
        const data = pickFields(staff, ['username', 'name', 'phone', 'avatar', 'role', 'device_categories', 'service_areas'])
        const res = await col.add({
          ...data,
          openid: '',
          disabled: false,
          ...buildPasswordFields(staff.password),
          create_time: Date.now()
        })
        return { code: 0, data: { id: res.id } }
      } else if (action === 'edit') {
        if (!staff || !staff._id) return { code: -1, msg: '缺少员工ID' }
        const data = pickFields(staff, ['username', 'name', 'phone', 'avatar', 'role', 'disabled', 'device_categories', 'service_areas'])
        if (data.role && !STAFF_ROLES.includes(data.role)) return { code: -1, msg: '角色不正确' }
        if (data.role === 'superadmin' && operator.role !== 'superadmin') return { code: -1, msg: '只有超级管理员可设置超级管理员角色' }
        if (staff.password) Object.assign(data, buildPasswordFields(staff.password))
        if (!Object.keys(data).length) return { code: -1, msg: '没有可更新的员工字段' }
        const res = await col.where({ _id: staff._id, role: db.command.in(STAFF_ROLES) }).update(data)
        if (!res.updated) return { code: -1, msg: '员工不存在' }
        return { code: 0 }
      } else if (action === 'disable') {
        if (!staff || !staff._id) return { code: -1, msg: '缺少员工ID' }
        const disabled = staff.disabled !== undefined ? staff.disabled : true
        const res = await col.where({ _id: staff._id, role: db.command.in(STAFF_ROLES) }).update({ disabled })
        if (!res.updated) return { code: -1, msg: '员工不存在' }
        return { code: 0 }
      } else {
        const list = await col.where({ role: db.command.in(STAFF_ROLES) }).get()
        const data = list.data.map(({ password, password_hash, password_salt, token, token_expire, ...staffInfo }) => staffInfo)
        return { code: 0, data }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getFeedbackStats(params) {
    try {
      const { token } = getRequestData(this, params)
      await verifyAdminToken(token, PERMISSIONS.view_feedback)
      const dbCmd = db.command
      // 待处理 / 处理中 视为未结案待跟进
      const [pendingRes, highRiskRes] = await Promise.all([
        db.collection('cicada_feedbacks').where({ status: dbCmd.in(['待处理', '处理中']) }).count(),
        db.collection('cicada_feedbacks').where({
          urgency: '高危',
          status: dbCmd.in(['待处理', '处理中', '已回复', '已升级'])
        }).count()
      ])
      return { code: 0, data: { unreadCount: pendingRes.total, highRiskCount: highRiskRes.total } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getFeedbackList(params) {
    try {
      const { token, status, type, urgency, keyword, page, pageSize } = getRequestData(this, params)
      await verifyAdminToken(token, PERMISSIONS.view_feedback)
      const dbCmd = db.command
      const { page: pageNum, pageSize: limit } = fbPage(page, pageSize)

      const base = {}
      if (status && status !== '全部') base.status = status
      if (type && type !== '全部') base.type = type
      if (urgency && urgency !== '全部') base.urgency = urgency
      const kw = fbText(keyword, 60)
      let query = base
      if (kw) {
        const reg = new db.RegExp({ regexp: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' })
        // 关键词匹配反馈内容 / 关联工单号 / 联系方式
        const orCond = dbCmd.or([
          { content: reg },
          { rel_order_no: reg },
          { contact_value: reg }
        ])
        query = Object.keys(base).length ? dbCmd.and([base, orCond]) : orCond
      }

      const col = db.collection('cicada_feedbacks')
      const [listRes, countRes] = await Promise.all([
        col.where(query).orderBy('create_time', 'desc')
          .skip((pageNum - 1) * limit).limit(limit).get(),
        col.where(query).count()
      ])

      // 批量解析客户姓名/手机
      const userIds = [...new Set(listRes.data.map(i => i.user_id).filter(Boolean))]
      const userMap = {}
      if (userIds.length) {
        const usersRes = await db.collection('cicada_users')
          .where({ _id: dbCmd.in(userIds) })
          .field({ name: true, nickname: true, phone: true })
          .get()
        usersRes.data.forEach(u => { userMap[u._id] = u })
      }

      const list = listRes.data.map(item => {
        const u = userMap[item.user_id] || {}
        return {
          _id: item._id,
          type: item.type,
          content: item.content,
          images: item.images || [],
          contact_type: item.contact_type || '',
          contact_value: item.contact_value || '',
          rel_order_no: item.rel_order_no || '',
          status: item.status || '待处理',
          urgency: item.urgency || '普通',
          handler_id: item.handler_id || '',
          handler_name: item.handler_name || '',
          reply: item.reply || '',
          process_result: item.process_result || '',
          process_note: item.process_note || '',
          visit_time: item.visit_time || 0,
          visit_by: item.visit_by || '',
          visit_satisfaction: item.visit_satisfaction || '',
          visit_opinion: item.visit_opinion || '',
          upgrade_note: item.upgrade_note || '',
          create_time: item.create_time || 0,
          handled_time: item.handled_time || 0,
          update_time: item.update_time || 0,
          customerName: u.name || u.nickname || '',
          customerPhone: u.phone || ''
        }
      })

      return { code: 0, data: { list, total: countRes.total, page: pageNum, pageSize: limit } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 分配负责人
  async assignFeedback(params) {
    try {
      const { token, id, handler_id } = getRequestData(this, params)
      const operator = await verifyAdminToken(token, PERMISSIONS.handle_feedback)
      const feedback = await loadFeedback(id)

      let handlerName = ''
      const targetId = fbText(handler_id, 60)
      if (targetId) {
        const staffRes = await db.collection('cicada_users').doc(targetId).get()
        const staff = staffRes.data && staffRes.data[0]
        if (!staff || !STAFF_ROLES.includes(staff.role)) return { code: -1, msg: '负责人不存在' }
        handlerName = staff.name || staff.nickname || staff.username || ''
      }

      const update = {
        handler_id: targetId,
        handler_name: handlerName,
        update_time: Date.now()
      }
      if (feedback.status === '待处理') update.status = '处理中'

      await db.collection('cicada_feedbacks').doc(feedback._id).update(update)
      await writeFeedbackEvent(operator, feedback, 'feedback_assign',
        { handler_id: feedback.handler_id || '', handler_name: feedback.handler_name || '' },
        { handler_id: targetId, handler_name: handlerName })
      return { code: 0, msg: '已分配负责人' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 设置紧急等级
  async setFeedbackUrgency(params) {
    try {
      const { token, id, urgency } = getRequestData(this, params)
      const operator = await verifyAdminToken(token, PERMISSIONS.handle_feedback)
      const feedback = await loadFeedback(id)
      const level = fbText(urgency, 10)
      if (!['普通', '重要', '高危'].includes(level)) return { code: -1, msg: '紧急等级不正确' }
      await db.collection('cicada_feedbacks').doc(feedback._id).update({ urgency: level, update_time: Date.now() })
      return { code: 0, msg: '已更新紧急等级' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 绑定 / 改绑 / 解绑投诉关联的工单（rel_order_no）。传空 order_no 视为解绑。
  async linkFeedbackOrder(params) {
    try {
      const { token, id, order_no } = getRequestData(this, params)
      const operator = await verifyAdminToken(token, PERMISSIONS.handle_feedback)
      const feedback = await loadFeedback(id)
      const targetOrderNo = fbText(order_no, 40)

      // 绑定时校验工单确实存在，避免绑定到不存在的工单号
      if (targetOrderNo) {
        const orderRes = await db.collection('cicada_orders').where({ order_no: targetOrderNo }).limit(1).get()
        if (!orderRes.data || !orderRes.data.length) return { code: -1, msg: '关联工单不存在，请核对工单号' }
      }

      await db.collection('cicada_feedbacks').doc(feedback._id).update({
        rel_order_no: targetOrderNo,
        update_time: Date.now()
      })
      await writeFeedbackEvent(operator, feedback, 'feedback_link_order',
        { rel_order_no: feedback.rel_order_no || '' },
        { rel_order_no: targetOrderNo })
      return { code: 0, msg: targetOrderNo ? '已关联工单' : '已解除工单关联' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 处理记录 + 官方回复（回复对客户可见）
  async replyFeedback(params) {
    try {
      const { token, id, reply, process_result, process_note, status } = getRequestData(this, params)
      const operator = await verifyAdminToken(token, PERMISSIONS.handle_feedback)
      const feedback = await loadFeedback(id)

      const replyText = fbText(reply, 1000)
      const update = {
        process_result: fbText(process_result, 200),
        process_note: fbText(process_note, 1000),
        update_time: Date.now()
      }
      if (replyText) {
        update.reply = replyText
        update.status = '已回复'
      } else {
        update.status = fbText(status, 10) || '处理中'
      }
      if (!feedback.handled_time) update.handled_time = Date.now()
      // 自动认领（若未分配负责人则记录当前处理人）
      if (!feedback.handler_id) {
        update.handler_id = operator._id
        update.handler_name = operator.name || operator.nickname || operator.username || ''
      }

      await db.collection('cicada_feedbacks').doc(feedback._id).update(update)
      await writeFeedbackEvent(operator, feedback, 'feedback_reply',
        { status: feedback.status, reply: feedback.reply || '' },
        { status: update.status, reply: update.reply || '' })
      return { code: 0, msg: '处理记录已保存' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 回访登记
  async recordFeedbackVisit(params) {
    try {
      const { token, id, satisfaction, opinion } = getRequestData(this, params)
      const operator = await verifyAdminToken(token, PERMISSIONS.handle_feedback)
      const feedback = await loadFeedback(id)
      const level = fbText(satisfaction, 10)
      if (!['满意', '一般', '不满意'].includes(level)) return { code: -1, msg: '请选择满意度' }

      const update = {
        visit_time: Date.now(),
        visit_by: operator.name || operator.nickname || operator.username || '',
        visit_satisfaction: level,
        visit_opinion: fbText(opinion, 500),
        update_time: Date.now()
      }
      await db.collection('cicada_feedbacks').doc(feedback._id).update(update)
      await writeFeedbackEvent(operator, feedback, 'feedback_visit', {}, {
        visit_satisfaction: level, visit_opinion: update.visit_opinion
      })
      return { code: 0, msg: '回访已登记' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 结案（必须先完成回访）
  async closeFeedback(params) {
    try {
      const { token, id } = getRequestData(this, params)
      const operator = await verifyAdminToken(token, PERMISSIONS.handle_feedback)
      const feedback = await loadFeedback(id)
      if (!feedback.visit_time) return { code: -1, msg: '请先完成回访登记再结案' }
      if (feedback.status === '已结案') return { code: -1, msg: '该反馈已结案' }

      await db.collection('cicada_feedbacks').doc(feedback._id).update({ status: '已结案', update_time: Date.now() })
      await writeFeedbackEvent(operator, feedback, 'feedback_close',
        { status: feedback.status }, { status: '已结案' })
      return { code: 0, msg: '已结案' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 升级投诉
  async upgradeFeedback(params) {
    try {
      const { token, id, note } = getRequestData(this, params)
      const operator = await verifyAdminToken(token, PERMISSIONS.handle_feedback)
      const feedback = await loadFeedback(id)

      await db.collection('cicada_feedbacks').doc(feedback._id).update({
        status: '已升级',
        upgrade_note: fbText(note, 500),
        update_time: Date.now()
      })
      await writeFeedbackEvent(operator, feedback, 'feedback_upgrade',
        { status: feedback.status }, { status: '已升级', upgrade_note: fbText(note, 500) })
      return { code: 0, msg: '已标记升级投诉' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async saveSettings(params) {
    try {
      let token, settings
      if (params && params.token) {
        ({ token, settings } = params)
      } else if (this.params) {
        ({ token, settings } = this.params)
      }
      await verifyAdminToken(token, ['admin'])

      if (!settings || typeof settings !== 'object') {
        return { code: -1, msg: '配置数据格式不正确' }
      }

      const col = db.collection('cicada_settings')
      const now = Date.now()

      for (const [key, value] of Object.entries(settings)) {
        const existing = await col.where({ key }).limit(1).get()
        if (existing.data.length > 0) {
          await col.doc(existing.data[0]._id).update({ value, update_time: now })
        } else {
          await col.add({ key, value, update_time: now })
        }
      }

      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getSettings(params) {
    try {
      let token
      if (params && params.token) {
        ({ token } = params)
      } else if (this.params) {
        ({ token } = this.params)
      }
      // 设置均为展示类配置（政策/打印模板/资质/小程序二维码等，无密钥），全体员工可读；写入仍限 admin
      await verifyAdminToken(token, STAFF_ROLES)

      const res = await db.collection('cicada_settings').get()
      const settings = {}
      res.data.forEach(item => {
        settings[item.key] = item.value
      })

      return { code: 0, data: settings }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getGuides(params) {
    try {
      let token
      if (params && params.token) {
        ({ token } = params)
      } else if (this.params) {
        ({ token } = this.params)
      }
      await verifyAdminToken(token, ['admin', 'engineer'])

      await ensureGuideDefaults()
      const res = await db.collection('cicada_guides').orderBy('sort', 'asc').get()
      return { code: 0, data: res.data }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async updateGuide(params) {
    try {
      const data = (params && params.token) ? params : (this.params || {})
      const { token, guide_id } = data
      await verifyAdminToken(token, ['admin'])

      if (!guide_id) {
        return { code: -1, msg: '参数不完整' }
      }

      const now = Date.now()
      const updateData = { update_time: now }
      // 仅写入传入的字段，支持图文/媒体/分类/受众等扩展
      const assignable = ['file_name', 'file_url', 'file_type', 'desc', 'content', 'category', 'audience']
      assignable.forEach(field => {
        if (data[field] !== undefined) updateData[field] = data[field]
      })
      if (Array.isArray(data.media)) updateData.media = data.media
      if (data.sort !== undefined) updateData.sort = Number(data.sort) || 0

      const res = await db.collection('cicada_guides').doc(guide_id).update(updateData)

      if (!res.updated) {
        return { code: -1, msg: '教程不存在' }
      }

      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 新增自定义教程（区分客户端/工程师端、按分类）
  async createGuide(params) {
    try {
      const data = (params && params.token) ? params : (this.params || {})
      const { token } = data
      await verifyAdminToken(token, ['admin'])

      const category = String(data.category || '').trim()
      if (!category) return { code: -1, msg: '请填写教程栏目/分类' }

      const now = Date.now()
      const doc = {
        type: '',
        category,
        audience: data.audience === 'engineer' ? 'engineer' : 'client',
        desc: data.desc || '',
        content: data.content || '',
        media: Array.isArray(data.media) ? data.media : [],
        file_name: data.file_name || '',
        file_url: data.file_url || '',
        file_type: data.file_type || '',
        sort: Number(data.sort) || 99,
        update_time: now
      }
      const res = await db.collection('cicada_guides').add(doc)
      return { code: 0, data: { _id: res.id || (res.ids && res.ids[0]) } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 删除教程（固定类型 quick/repair/query/invoice 不允许删除）
  async deleteGuide(params) {
    try {
      const data = (params && params.token) ? params : (this.params || {})
      const { token, guide_id } = data
      await verifyAdminToken(token, ['admin'])

      if (!guide_id) return { code: -1, msg: '参数不完整' }

      const existing = await db.collection('cicada_guides').doc(guide_id).get()
      const guide = existing.data && existing.data[0]
      if (!guide) return { code: -1, msg: '教程不存在' }
      if (matchGuideType(guide)) return { code: -1, msg: '固定教程栏目不可删除' }

      await db.collection('cicada_guides').doc(guide_id).remove()
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async uploadGuideFile(params) {
    try {
      return await uploadAdminFile(this, params, 'guides/')
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 通用文件上传：dir 控制云存储目录（guides/ compliance/ tutorials/ print/）
  async uploadFile(params) {
    try {
      return await uploadAdminFile(this, params, 'guides/')
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 把云存储 fileID 列表解析成临时可访问地址（管理端预览已保存的资质图片/logo）
  async getTempFileURL(params) {
    try {
      let token, fileList
      if (params && params.token) {
        ({ token, fileList } = params)
      } else if (this.params) {
        ({ token, fileList } = this.params)
      }
      await verifyAdminToken(token, ['admin', 'engineer'])

      const list = Array.isArray(fileList) ? fileList.filter(Boolean) : []
      if (!list.length) return { code: 0, data: {} }

      const res = await uniCloud.getTempFileURL({ fileList: list })
      const map = {}
      ;(res.fileList || []).forEach(item => {
        if (item && item.fileID) map[item.fileID] = item.tempFileURL || ''
      })
      return { code: 0, data: map }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
