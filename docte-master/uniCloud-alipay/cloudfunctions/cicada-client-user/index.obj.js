const db = uniCloud.database()
const crypto = require('crypto')

const TOKEN_EXPIRE = 7 * 24 * 3600 * 1000 // 7天

const RATE_LIMITS = {
  login: { windowMs: 60 * 1000, max: 30 },
  feedback: { windowMs: 60 * 1000, max: 10 }
}

function genToken() {
  return crypto.randomBytes(32).toString('hex')
}

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return String(value).trim()
  }
  return ''
}

function getWechatAppConfig() {
  return {
    appId: getEnvValue('WX_APPID', 'WECHAT_APPID'),
    secret: getEnvValue('WX_SECRET', 'WECHAT_SECRET')
  }
}

async function getAccessToken() {
  const { appId, secret } = getWechatAppConfig()
  if (!appId || !secret) {
    throw new Error('请先配置微信小程序 WX_APPID 和 WX_SECRET')
  }

  const res = await uniCloud.httpclient.request(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`,
    { dataType: 'json' }
  )
  return res.data.access_token
}

async function verifyUserToken(token) {
  if (!token) throw new Error('鉴权失败')
  const res = await db.collection('cicada_users').where({ token }).limit(1).get()
  const user = res.data[0]
  if (!user || user.disabled) throw new Error('鉴权失败')
  if (!user.token_expire || Date.now() > user.token_expire) throw new Error('Token已过期')
  return user
}

function pickFields(source = {}, fields = []) {
  return fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field]
    }
    return result
  }, {})
}

function normalizeBool(value) {
  return value === true
}

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim()
}

function normalizeFeedbackImages(images) {
  if (!Array.isArray(images)) return []
  return images
    .map(item => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return ''
      return item.fileID || item.fileId || item.cloudUrl || item.url || item.fileUrl || item.path || ''
    })
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, 3)
}

function buildUserInfo(user = {}, id = '') {
  const userId = id || user._id || user.id || ''
  const phone = user.phone || ''
  return {
    id: userId,
    userId,
    phone,
    nickname: user.nickname || (phone ? `用户${String(phone).slice(-4)}` : '微信用户'),
    avatar: user.avatar || '',
    unit: user.unit || user.companyName || user.company_name || '',
    role: user.role || 'user'
  }
}

function normalizePage(page, pageSize) {
  const current = Math.max(Number(page) || 1, 1)
  const size = Math.min(Math.max(Number(pageSize) || 10, 1), 50)
  return { page: current, pageSize: size }
}

async function saveWechatUserByPhone(phone, extra = {}) {
  const col = db.collection('cicada_users')
  const now = Date.now()
  const token = genToken()
  const tokenExpire = now + TOKEN_EXPIRE
  const found = await col.where({ phone }).limit(1).get()

  if (!found.data.length) {
    const userInfo = {
      phone,
      role: 'user',
      token,
      token_expire: tokenExpire,
      create_time: now,
      last_login: now,
      ...extra
    }
    const ins = await col.add(userInfo)
    return { token, userInfo: buildUserInfo(userInfo, ins.id) }
  }

  const user = found.data[0]
  const update = {
    token,
    token_expire: tokenExpire,
    last_login: now,
    ...extra
  }
  await col.doc(user._id).update(update)
  return { token, userInfo: buildUserInfo({ ...user, ...update }, user._id) }
}

// 小程序登录时自动建立/补全客户档案（cicada_customers）。
// 防御式：任何异常都不得影响登录主流程。
async function ensureCustomerProfile(userId, openid, phone, profile = {}) {
  try {
    if (!userId && !openid) return
    const nickname = normalizeText(profile.nickname)
    const avatar = normalizeText(profile.avatar)
    const col = db.collection('cicada_customers')
    const matchOr = []
    if (userId) matchOr.push({ user_id: userId })
    if (openid) matchOr.push({ openid })
    const found = await col.where(db.command.or(matchOr)).limit(1).get()
    const now = Date.now()
    if (!found.data.length) {
      await col.add({
        name: nickname || normalizeText(phone) || '微信客户',
        contact: '',
        phone: normalizeText(phone),
        customer_type: 'clinic',
        source: 'miniapp',
        address: '',
        tags: [],
        user_id: userId || '',
        openid: openid || '',
        nickname,
        avatar,
        status: 'active',
        create_time: now,
        update_time: now
      })
    } else {
      const c = found.data[0]
      const update = {}
      if (userId && c.user_id !== userId) update.user_id = userId
      if (openid && c.openid !== openid) update.openid = openid
      if (phone && !c.phone && c.status !== 'cancelled') update.phone = normalizeText(phone)
      if (nickname && c.nickname !== nickname) update.nickname = nickname
      if (avatar && c.avatar !== avatar) update.avatar = avatar
      if (Object.keys(update).length) {
        update.update_time = now
        await col.doc(c._id).update(update)
      }
    }
  } catch (e) {
    console.error('自动建立客户档案失败:', e && e.message)
  }
}

function getClientIdentity(ctx, fallback = 'anonymous') {
  const clientInfo = ctx && ctx.getClientInfo ? ctx.getClientInfo() : {}
  return clientInfo.clientIP || clientInfo.ip || clientInfo.userAgent || fallback
}

async function checkRateLimit(scope, identity, options) {
  const config = options || RATE_LIMITS[scope]
  if (!identity || !config) return

  const now = Date.now()
  const key = `${scope}:${identity}`
  const col = db.collection('cicada_rate_limits')
  const found = await col.where({ key }).limit(1).get()
  const record = found.data[0]

  if (!record || now > record.reset_time) {
    if (record) {
      await col.doc(record._id).update({
        count: 1,
        reset_time: now + config.windowMs,
        update_time: now
      })
    } else {
      await col.add({
        key,
        scope,
        identity,
        count: 1,
        reset_time: now + config.windowMs,
        create_time: now,
        update_time: now
      })
    }
    return
  }

  if (record.count >= config.max) {
    throw new Error('操作过于频繁，请稍后再试')
  }

  await col.doc(record._id).update({
    count: db.command.inc(1),
    update_time: now
  })
}

module.exports = {
  _before() {},

  async login({ code, phoneCode }) {
    try {
      const { appId, secret } = getWechatAppConfig()
      if (!appId || !secret) {
        return { code: -1, message: '请先配置微信小程序 WX_APPID 和 WX_SECRET' }
      }
      await checkRateLimit('login', `${getClientIdentity(this)}:${code || 'empty'}`)

      // 1. 换取 openid
      const wxRes = await uniCloud.httpclient.request(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`,
        { dataType: 'json' }
      )
      const { openid, errmsg } = wxRes.data
      if (!openid) return { code: -1, msg: errmsg || '获取openid失败' }

      // 2. 换取手机号
      let phone = ''
      if (phoneCode) {
        const phoneRes = await uniCloud.httpclient.request(
          'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
          {
            method: 'POST',
            data: JSON.stringify({ code: phoneCode }),
            headers: { 'Content-Type': 'application/json' },
            dataType: 'json',
            params: { access_token: await getAccessToken() }
          }
        )
        const phoneInfo = phoneRes.data && phoneRes.data.phone_info
        phone = (phoneInfo && phoneInfo.phoneNumber) || ''
      }

      const col = db.collection('cicada_users')
      const now = Date.now()
      const token = genToken()
      const tokenExpire = now + TOKEN_EXPIRE

      // 3. 查询或创建用户
      const found = await col.where({ openid }).limit(1).get()
      let userId, role
      if (found.data.length === 0) {
        const ins = await col.add({
          openid,
          phone,
          role: 'user',
          token,
          token_expire: tokenExpire,
          create_time: now,
          last_login: now
        })
        userId = ins.id
        role = 'user'
      } else {
        const user = found.data[0]
        userId = user._id
        role = user.role
        const update = { last_login: now, token, token_expire: tokenExpire }
        if (phone) update.phone = phone
        await col.doc(userId).update(update)
      }

      await ensureCustomerProfile(userId, openid, phone)

      return {
        code: 0,
        message: '登录成功',
        data: {
          token,
          userId,
          role,
          userInfo: buildUserInfo({ phone, role }, userId)
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 说明：原 loginWithWechat（仅换 openid + 伪造 138 手机号）已废弃移除。
  // 小程序端统一走 login({ code, phoneCode })：code 换 openid、phoneCode 换真实手机号。

  async devLogin() {
    try {
      const data = await saveWechatUserByPhone('13800138000', {
        openid: 'dev_test_openid',
        nickname: '开发测试用户',
        role: 'user',
        disabled: false
      })

      return {
        code: 0,
        message: '开发测试登录成功',
        data
      }
    } catch (e) {
      return { code: -1, message: e.message || '开发测试登录失败' }
    }
  },

  async getUserInfo({ token }) {
    try {
      const user = await verifyUserToken(token)
      return { code: 0, data: buildUserInfo(user, user._id) }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async manageAddress({ token, action, address }) {
    try {
      const user = await verifyUserToken(token)
      const userId = user._id
      const col = db.collection('cicada_addresses')

      if (action === 'add') {
        const data = pickFields(address, ['name', 'phone', 'region', 'detail', 'unit', 'contact_phones'])
        data.is_default = normalizeBool(address && address.is_default)
        if (data.is_default) {
          await col.where({ user_id: userId }).update({ is_default: false })
        }
        const res = await col.add({ ...data, user_id: userId, create_time: Date.now() })
        return { code: 0, data: { id: res.id } }
      } else if (action === 'edit') {
        if (!address || !address._id) return { code: -1, msg: '缺少地址ID' }
        const data = pickFields(address, ['name', 'phone', 'region', 'detail', 'unit', 'contact_phones', 'is_default'])
        if (!Object.keys(data).length) return { code: -1, msg: '没有可更新的地址字段' }
        if (normalizeBool(data.is_default)) {
          await col.where({ user_id: userId, _id: db.command.neq(address._id) }).update({ is_default: false })
          data.is_default = true
        }
        const res = await col.where({ _id: address._id, user_id: userId }).update(data)
        if (!res.updated) return { code: -1, msg: '地址不存在或无权限' }
        return { code: 0 }
      } else if (action === 'delete') {
        if (!address || !address._id) return { code: -1, msg: '缺少地址ID' }
        const res = await col.where({ _id: address._id, user_id: userId }).remove()
        if (!res.deleted) return { code: -1, msg: '地址不存在或无权限' }
        return { code: 0 }
      } else {
        const list = await col.where({ user_id: userId }).get()
        return { code: 0, data: list.data }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async manageDevice({ token, action, device }) {
    try {
      const user = await verifyUserToken(token)
      const userId = user._id
      const col = db.collection('cicada_user_devices')
      if (action === 'add') {
        const data = pickFields(device, ['product_name', 'sn', 'buy_date', 'warranty_status'])
        const res = await col.add({ ...data, user_id: userId, create_time: Date.now() })
        return { code: 0, data: { id: res.id } }
      } else if (action === 'edit') {
        if (!device || !device._id) return { code: -1, msg: '缺少设备ID' }
        const data = pickFields(device, ['product_name', 'sn', 'buy_date', 'warranty_status'])
        if (!Object.keys(data).length) return { code: -1, msg: '没有可更新的设备字段' }
        const res = await col.where({ _id: device._id, user_id: userId }).update(data)
        if (!res.updated) return { code: -1, msg: '设备不存在或无权限' }
        return { code: 0 }
      } else if (action === 'delete') {
        if (!device || !device._id) return { code: -1, msg: '缺少设备ID' }
        const res = await col.where({ _id: device._id, user_id: userId }).remove()
        if (!res.deleted) return { code: -1, msg: '设备不存在或无权限' }
        return { code: 0 }
      } else {
        const list = await col.where({ user_id: userId }).get()
        return { code: 0, data: list.data }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async submitFeedback({ token, type, content, images = [], contact_type = '', contact_value = '', rel_order_no = '' }) {
    try {
      const user = await verifyUserToken(token)
      await checkRateLimit('feedback', user._id)
      const feedbackType = normalizeText(type)
      const feedbackContent = normalizeText(content)
      const feedbackImages = normalizeFeedbackImages(images)
      if (!['投诉', '建议'].includes(feedbackType)) return { code: -1, msg: '反馈类型不正确' }
      if (!feedbackContent) return { code: -1, msg: '反馈内容不能为空' }
      if (feedbackContent.length > 500) return { code: -1, msg: '反馈内容不能超过500字' }
      const res = await db.collection('cicada_feedbacks').add({
        user_id: user._id,
        type: feedbackType,
        content: feedbackContent,
        images: feedbackImages,
        contact_type: normalizeText(contact_type).slice(0, 30),
        contact_value: normalizeText(contact_value).slice(0, 80),
        rel_order_no: normalizeText(rel_order_no).slice(0, 50),
        status: '待处理',
        create_time: Date.now()
      })
      return { code: 0, data: { id: res.id, ticketNo: res.id, images: feedbackImages } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getComplaintList({ token, page = 1, pageSize = 10 } = {}) {
    try {
      const user = await verifyUserToken(token)
      const pagination = normalizePage(page, pageSize)
      const where = { user_id: user._id }

      const [listRes, countRes] = await Promise.all([
        db.collection('cicada_feedbacks')
          .where(where)
          .orderBy('create_time', 'desc')
          .skip((pagination.page - 1) * pagination.pageSize)
          .limit(pagination.pageSize)
          .get(),
        db.collection('cicada_feedbacks').where(where).count()
      ])

      // 后台中文状态 → 小程序展示状态键（与「我的反馈单」标签一致）
      const STATUS_KEY_MAP = {
        '待处理': 'submitted',
        '处理中': 'processing',
        '已升级': 'processing',
        '已回复': 'replied',
        '已结案': 'closed',
        '已处理': 'closed'
      }

      return {
        code: 0,
        data: {
          list: listRes.data.map(item => ({
            id: item._id,
            ticketNo: item._id,
            type: item.type,
            content: item.content,
            images: item.images || [],
            contactType: item.contact_type || '',
            contact: item.contact_value || '',
            orderId: item.rel_order_no || '',
            status: STATUS_KEY_MAP[item.status] || 'submitted',
            statusLabel: item.status || '待处理',
            reply: item.reply || '',
            createTime: item.create_time
          })),
          total: countRes.total,
          page: pagination.page,
          pageSize: pagination.pageSize
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
