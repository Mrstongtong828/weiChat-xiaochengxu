const db = uniCloud.database()
const crypto = require('crypto')

const ADMIN_TOKEN_EXPIRE = 8 * 3600 * 1000 // 8小时
const STAFF_ROLES = ['admin', 'engineer']
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
  if (!user || user.disabled || !allowedRoles.includes(user.role)) {
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
        user: {
          _id: user._id,
          username: user.username,
          name: user.name || user.nickname || '',
          phone: user.phone || '',
          role: user.role,
          roleDisplay: user.role === 'admin' ? '管理员' : '工程师'
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
      await verifyAdminToken(token, ['admin'])
      const col = db.collection('cicada_users')
      if (action === 'add') {
        if (!staff || !staff.username || !staff.password) return { code: -1, msg: '账号和密码不能为空' }
        if (!STAFF_ROLES.includes(staff.role)) return { code: -1, msg: '角色不正确' }
        const exists = await col.where({ username: staff.username }).limit(1).get()
        if (exists.data.length) return { code: -1, msg: '账号已存在' }
        const data = pickFields(staff, ['username', 'name', 'phone', 'avatar', 'role'])
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
        const data = pickFields(staff, ['username', 'name', 'phone', 'avatar', 'role', 'disabled'])
        if (data.role && !STAFF_ROLES.includes(data.role)) return { code: -1, msg: '角色不正确' }
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
        const list = await col.where({ role: db.command.in(['admin', 'engineer']) }).get()
        const data = list.data.map(({ password, password_hash, password_salt, token, token_expire, ...staffInfo }) => staffInfo)
        return { code: 0, data }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getFeedbackStats(params) {
    try {
      let token
      if (params && params.token) {
        ({ token } = params)
      } else if (this.params) {
        ({ token } = this.params)
      }
      await verifyAdminToken(token, ['admin', 'engineer'])
      const res = await db.collection('cicada_feedbacks').where({ status: '待处理' }).count()
      return { code: 0, data: { unreadCount: res.total } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getFeedbackList(params) {
    try {
      let token, status
      if (params && params.token) {
        ({ token, status } = params)
      } else if (this.params) {
        ({ token, status } = this.params)
      }
      await verifyAdminToken(token, ['admin', 'engineer'])

      const where = {}
      if (status && status !== '全部') {
        where.status = status
      }

      const res = await db.collection('cicada_feedbacks')
        .where(where)
        .orderBy('create_time', 'desc')
        .get()

      return { code: 0, data: res.data }
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
      await verifyAdminToken(token, ['admin', 'engineer'])

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
      let token, guide_id, file_name, file_url, file_type, desc
      if (params && params.token) {
        ({ token, guide_id, file_name, file_url, file_type, desc } = params)
      } else if (this.params) {
        ({ token, guide_id, file_name, file_url, file_type, desc } = this.params)
      }
      await verifyAdminToken(token, ['admin'])

      if (!guide_id || !file_name) {
        return { code: -1, msg: '参数不完整' }
      }

      const now = Date.now()
      const updateData = {
        file_name,
        update_time: now
      }

      if (file_url) {
        updateData.file_url = file_url
      }
      if (file_type) {
        updateData.file_type = file_type
      }
      if (desc !== undefined) {
        updateData.desc = desc
      }

      const res = await db.collection('cicada_guides').doc(guide_id).update(updateData)

      if (!res.updated) {
        return { code: -1, msg: '教程不存在' }
      }

      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async uploadGuideFile(params) {
    try {
      const httpInfo = this.getHttpInfo && this.getHttpInfo()
      let token, fileContent, fileName, fileType
      if (httpInfo && httpInfo.body) {
        const body = JSON.parse(httpInfo.body)
        ;({ token, fileContent, fileName, fileType } = body)
      } else {
        ;({ token, fileContent, fileName, fileType } = params || {})
      }
      await verifyAdminToken(token, ['admin'])

      if (!fileContent || !fileName) return { code: -1, msg: '缺少文件内容或文件名' }

      const buffer = Buffer.from(fileContent, 'base64')
      const safeFileName = String(fileName).replace(/[\\/:*?"<>|]/g, '_')
      const cloudPath = `guides/${Date.now()}_${safeFileName}`
      const res = await uniCloud.uploadFile({
        cloudPath,
        fileContent: buffer,
        fileType: fileType || 'application/octet-stream'
      })

      return { code: 0, data: { fileUrl: res.fileID } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
