const db = uniCloud.database()
const crypto = require('crypto')

const TOKEN_EXPIRE = 7 * 24 * 3600 * 1000 // 7天

const RATE_LIMITS = {
  // 登录主限流按 IP，避免用 code 分桶被刷穿 jscode2session
  login: { windowMs: 60 * 1000, max: 20 },
  feedback: { windowMs: 60 * 1000, max: 10 },
  feedback_day: { windowMs: 24 * 60 * 60 * 1000, max: 30 }
}

function genToken() {
  return crypto.randomBytes(32).toString('hex')
}

function isAuthErrorMessage(message = '') {
  return /鉴权失败|Token已过期|未登录|账号已禁用|账号已注销|内部员工账号/i.test(String(message || ''))
}

function fail(error, fallbackMessage = '请求失败') {
  const message = (error && error.message) || fallbackMessage
  if (isAuthErrorMessage(message)) {
    return { code: 401, msg: message, message }
  }
  return { code: -1, msg: message, message }
}

function isAllowedFeedbackImage(url = '') {
  const value = normalizeText(url)
  if (!value) return false
  if (/^cloud:\/\//i.test(value)) return true

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return false
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
    const allowedSuffixes = [
      'tcb.qcloud.la',
      'file.myqcloud.com',
      'cloudbaseapp.cn',
      'cloudbasefunction.cn',
      'aliyuncs.com',
      'bspapp.com'
    ]
    return allowedSuffixes.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))
  } catch (error) {
    return false
  }
}

function stableDocumentId(prefix, value) {
  const digest = crypto.createHash('sha256').update(String(value || '')).digest('hex')
  return `${prefix}_${digest.slice(0, 28)}`
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

function buildWechatErrorMessage(data = {}, fallback = '微信接口调用失败') {
  const errcode = Number(data.errcode || 0)
  const errmsg = data.errmsg || ''
  const suffix = errcode ? `（${errcode}${errmsg ? `：${errmsg}` : ''}）` : ''

  if ([40013, 40125].includes(errcode)) return `微信小程序 AppID 或 Secret 配置不正确${suffix}`
  if ([40029, 40163].includes(errcode)) return `微信登录凭证已失效，请重新点击登录${suffix}`
  if (errcode === 45011) return `微信接口调用过于频繁，请稍后重试${suffix}`
  if (errcode) return `${fallback}${suffix}`
  return errmsg || fallback
}

async function getWechatOpenid(appId, secret, code) {
  if (!code) throw new Error('缺少微信登录凭证，请重新点击登录')
  const wxRes = await uniCloud.httpclient.request(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`,
    { dataType: 'json' }
  )
  const data = wxRes.data || {}
  if (!data.openid) {
    throw new Error(buildWechatErrorMessage(data, '获取微信 openid 失败'))
  }
  return data.openid
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

// SN 规范化键：大写、去除所有空格与横杠，用于容错检索匹配。
// 口径必须与 cicada-client-order / cicada-admin-customer 中的同名函数保持一致。
function normalizeSn(value) {
  return normalizeText(value).toUpperCase().replace(/[\s-]+/g, '')
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
    .filter(isAllowedFeedbackImage)
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
      await col.doc(stableDocumentId('wxc', userId || openid)).set({
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

  const key = `${scope}:${identity}`
  const col = db.collection('cicada_rate_limits')

  // `key` has a unique index. Conditional updates make the limit hold under concurrent requests.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = Date.now()
    const found = await col.where({ key }).limit(1).get()
    const record = found.data && found.data[0]

    if (!record) {
      try {
        await col.add({
          key,
          scope,
          identity,
          count: 1,
          reset_time: new Date(now + config.windowMs),
          create_time: new Date(now),
          update_time: new Date(now)
        })
        return
      } catch (error) {
        if (attempt === 2) throw error
        continue
      }
    }

    if (now > new Date(record.reset_time || 0).getTime()) {
      const reset = await col.where({
        _id: record._id,
        reset_time: db.command.lt(new Date(now))
      }).update({
        count: 1,
        reset_time: new Date(now + config.windowMs),
        update_time: new Date(now)
      })
      if (reset.updated) return
      continue
    }

    const increment = await col.where({
      _id: record._id,
      reset_time: db.command.gte(new Date(now)),
      count: db.command.lt(config.max)
    }).update({
      count: db.command.inc(1),
      update_time: new Date(now)
    })
    if (increment.updated) return
    throw new Error('操作过于频繁，请稍后再试')
  }

  throw new Error('操作过于频繁，请稍后再试')
}

module.exports = {
  _before() {},

  // OpenID 是唯一登录身份；报修联系电话不参与账号认领。
  async login({ code }) {
    try {
      const { appId, secret } = getWechatAppConfig()
      if (!appId || !secret) {
        return { code: -1, message: '请先配置微信小程序 WX_APPID 和 WX_SECRET' }
      }
      await checkRateLimit('login', getClientIdentity(this))

      const openid = await getWechatOpenid(appId, secret, code)

      const col = db.collection('cicada_users')
      const now = Date.now()
      const token = genToken()
      const tokenExpire = now + TOKEN_EXPIRE

      const found = await col.where({ openid }).limit(1).get()
      let userId, role
      let savedPhone = ''
      if (found.data.length === 0) {
        userId = stableDocumentId('wxu', openid)
        await col.doc(userId).set({
          openid,
          phone: '',
          role: 'user',
          token,
          token_expire: tokenExpire,
          phone_authorized: false,
          create_time: now,
          last_login: now
        })
        role = 'user'
      } else {
        const user = found.data[0]
        if (user.disabled || user.status === 'cancelled') {
          return { code: 401, msg: '账号已禁用或已注销', message: '账号已禁用或已注销' }
        }
        // 员工账号不得通过小程序 openid 登录拿到 staff token
        const staffRoles = ['superadmin', 'admin', 'engineer', 'finance', 'support']
        if (staffRoles.includes(String(user.role || ''))) {
          return { code: 401, msg: '该账号为内部员工账号，请使用后台登录', message: '该账号为内部员工账号，请使用后台登录' }
        }
        userId = user._id
        role = 'user'
        savedPhone = user.phone || ''
        const update = { last_login: now, token, token_expire: tokenExpire, role: 'user' }
        await col.doc(userId).update(update)
      }

      await ensureCustomerProfile(userId, openid, savedPhone)

      return {
        code: 0,
        message: '登录成功',
        data: {
          token,
          userId,
          role: 'user',
          phoneAuthorized: Boolean(savedPhone),
          userInfo: buildUserInfo({ phone: savedPhone, role: 'user' }, userId)
        }
      }
    } catch (e) {
      return fail(e)
    }
  },


  async logout({ token }) {
    try {
      const user = await verifyUserToken(token)
      await db.collection('cicada_users').doc(user._id).update({
        token: '',
        token_expire: 0,
        update_time: Date.now()
      })
      return { code: 0, msg: '已退出登录' }
    } catch (e) {
      return fail(e)
    }
  },

  async getUserInfo({ token }) {
    try {
      const user = await verifyUserToken(token)
      return { code: 0, data: buildUserInfo(user, user._id) }
    } catch (e) {
      return fail(e)
    }
  },

  // 用户自助修改资料：昵称 / 头像（微信已禁止自动获取昵称头像，只能由用户主动填写/选择）
  // avatar 传入的是客户端上传云存储后得到的 cloud:// fileID，原样存储，读取时前端转临时链接
  async updateProfile({ token, nickname, avatar }) {
    try {
      const user = await verifyUserToken(token)
      const update = {}
      // 只更新本次实际传入的字段：未传（undefined）跳过，传空串视为清空
      if (nickname !== undefined) {
        const value = normalizeText(nickname)
        if (value.length > 30) return { code: -1, msg: '昵称过长（最多 30 个字符）' }
        update.nickname = value
      }
      if (avatar !== undefined) {
        update.avatar = normalizeText(avatar)
      }
      if (!Object.keys(update).length) return { code: -1, msg: '没有可更新的资料' }

      update.update_time = Date.now()
      await db.collection('cicada_users').doc(user._id).update(update)

      // 同步到客户档案（cicada_customers），失败不阻断资料更新主流程
      try {
        await ensureCustomerProfile(user._id, user.openid, user.phone, {
          nickname: update.nickname !== undefined ? update.nickname : user.nickname,
          avatar: update.avatar !== undefined ? update.avatar : user.avatar
        })
      } catch (syncErr) {
        console.warn('[updateProfile] 同步客户档案失败:', syncErr && syncErr.message)
      }

      const merged = { ...user, ...update }
      return { code: 0, data: buildUserInfo(merged, user._id) }
    } catch (e) {
      return fail(e)
    }
  },

  // 用户自助注销账号（合规：软删除 + 脱敏 + 解绑微信，不物理删除以保留工单/审计可追溯）
  async cancelAccount({ token, confirm }) {
    try {
      const user = await verifyUserToken(token)
      // 二次确认，避免误触
      if (confirm !== true && confirm !== 'true' && confirm !== 1) {
        return { code: -1, msg: '请确认后再注销账号' }
      }
      const now = Date.now()
      // 注销用户：禁用 + 清除登录态 + 脱敏手机号/openid（清空 phone 以便同号可重新注册）
      await db.collection('cicada_users').doc(user._id).update({
        disabled: true,
        status: 'cancelled',
        phone: '',
        openid: '',
        token: '',
        token_expire: 0,
        cancelled_at: now,
        update_time: now
      })
      // 同步解绑/脱敏关联的客户档案，防御式：失败不阻断注销主流程
      try {
        const matchOr = []
        if (user._id) matchOr.push({ user_id: user._id })
        if (user.openid) matchOr.push({ openid: user.openid })
        if (matchOr.length) {
          const found = await db.collection('cicada_customers').where(db.command.or(matchOr)).limit(1).get()
          const customer = found.data && found.data[0]
          if (customer && customer.status !== 'cancelled') {
            await db.collection('cicada_customers').doc(customer._id).update({
              status: 'cancelled',
              phone: '',
              openid: '',
              user_id: '',
              cancelled_at: now,
              update_time: now
            })
          }
        }
      } catch (e) {
        // 客户档案解绑失败不影响账号注销
      }
      return { code: 0, msg: '账号已注销' }
    } catch (e) {
      return fail(e)
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
      return fail(e)
    }
  },

  async manageDevice({ token, action, device }) {
    try {
      const user = await verifyUserToken(token)
      const userId = user._id
      const col = db.collection('cicada_user_devices')
      if (action === 'add') {
        const data = pickFields(device, ['product_name', 'sn', 'buy_date'])
        const sn = normalizeText(data.sn)
        if (!sn) return { code: -1, msg: '请填写设备序列号(SN)' }
        data.sn = sn
        const snKey = normalizeSn(sn)
        data.sn_normalized = snKey
        // SN 全局查重：同一物理设备不应被多个账号重复绑定，避免设备台账脏数据。
        // 按规范化键判重（兼容横杠/大小写），存量未回填时回退精确 SN。
        let dup = await col.where({ sn_normalized: snKey }).limit(1).get()
        if (!dup.data || !dup.data.length) dup = await col.where({ sn }).limit(1).get()
        const dupDevice = dup.data && dup.data[0]
        if (dupDevice) {
          return dupDevice.user_id === userId
            ? { code: -1, msg: '该设备已登记，请勿重复添加' }
            : { code: -1, msg: '该设备序列号已被其他账号绑定，如有疑问请联系客服' }
        }
        const res = await col.add({ ...data, user_id: userId, create_time: Date.now() })
        return { code: 0, data: { id: res.id } }
      } else if (action === 'edit') {
        if (!device || !device._id) return { code: -1, msg: '缺少设备ID' }
        const data = pickFields(device, ['product_name', 'sn', 'buy_date'])
        if (!Object.keys(data).length) return { code: -1, msg: '没有可更新的设备字段' }
        // 若修改 SN，需保证非空且不与其他设备（含他人）重复
        if (Object.prototype.hasOwnProperty.call(data, 'sn')) {
          const sn = normalizeText(data.sn)
          if (!sn) return { code: -1, msg: '设备序列号(SN)不能为空' }
          data.sn = sn
          const snKey = normalizeSn(sn)
          data.sn_normalized = snKey
          let dup = await col.where({ sn_normalized: snKey, _id: db.command.neq(device._id) }).limit(1).get()
          if (!dup.data || !dup.data.length) dup = await col.where({ sn, _id: db.command.neq(device._id) }).limit(1).get()
          const dupDevice = dup.data && dup.data[0]
          if (dupDevice) {
            return dupDevice.user_id === userId
              ? { code: -1, msg: '您已登记过该设备序列号' }
              : { code: -1, msg: '该设备序列号已被其他账号绑定，如有疑问请联系客服' }
          }
        }
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
      return fail(e)
    }
  },

  async submitFeedback({ token, type, content, images = [], contact_type = '', contact_value = '', rel_order_no = '' }) {
    try {
      const user = await verifyUserToken(token)
      await checkRateLimit('feedback', user._id)
      await checkRateLimit('feedback_day', user._id, RATE_LIMITS.feedback_day)
      const feedbackType = normalizeText(type)
      const feedbackContent = normalizeText(content)
      const feedbackImages = normalizeFeedbackImages(images)
      if (!['投诉', '建议'].includes(feedbackType)) return { code: -1, msg: '反馈类型不正确' }
      if (!feedbackContent) return { code: -1, msg: '反馈内容不能为空' }
      if (feedbackContent.length > 500) return { code: -1, msg: '反馈内容不能超过500字' }
      const linkedOrderNo = normalizeText(rel_order_no).slice(0, 50)
      if (linkedOrderNo) {
        const orderRes = await db.collection('cicada_orders')
          .where(db.command.or([
            { order_no: linkedOrderNo, user_id: user._id },
            { _id: linkedOrderNo, user_id: user._id }
          ]))
          .limit(1)
          .get()
        if (!orderRes.data || !orderRes.data.length) {
          return { code: -1, msg: '关联工单不存在或无权限' }
        }
      }
      const res = await db.collection('cicada_feedbacks').add({
        user_id: user._id,
        type: feedbackType,
        content: feedbackContent,
        images: feedbackImages,
        contact_type: normalizeText(contact_type).slice(0, 30),
        contact_value: normalizeText(contact_value).slice(0, 80),
        rel_order_no: linkedOrderNo,
        status: '待处理',
        // Alipay uniCloud 的 timestamp 字段必须传 Date，不能传毫秒数。
        create_time: new Date()
      })
      return { code: 0, data: { id: res.id, ticketNo: res.id, images: feedbackImages } }
    } catch (e) {
      return fail(e)
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
      return fail(e)
    }
  }
}

Object.defineProperty(module.exports, '__test__', {
  value: Object.freeze({ isAllowedFeedbackImage })
})
