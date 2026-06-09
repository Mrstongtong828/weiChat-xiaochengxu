const db = uniCloud.database()
const crypto = require('crypto')

const WX_APPID = process.env.WX_APPID
const WX_SECRET = process.env.WX_SECRET
const TOKEN_EXPIRE = 7 * 24 * 3600 * 1000 // 7天

const RATE_LIMITS = {
  login: { windowMs: 60 * 1000, max: 30 },
  feedback: { windowMs: 60 * 1000, max: 10 }
}

function genToken() {
  return crypto.randomBytes(32).toString('hex')
}

async function getAccessToken() {
  if (!WX_APPID || !WX_SECRET) {
    throw new Error('请先配置微信小程序 WX_APPID 和 WX_SECRET')
  }

  const res = await uniCloud.httpclient.request(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APPID}&secret=${WX_SECRET}`,
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
      if (!WX_APPID || !WX_SECRET) {
        return { code: -1, message: '请先配置微信小程序 WX_APPID 和 WX_SECRET' }
      }
      await checkRateLimit('login', `${getClientIdentity(this)}:${code || 'empty'}`)

      // 1. 换取 openid
      const wxRes = await uniCloud.httpclient.request(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${code}&grant_type=authorization_code`,
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
        phone = phoneRes.data?.phone_info?.phoneNumber || ''
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

  async loginWithWechat({ code }) {
    try {
      if (!code) return { code: -1, message: '缺少 code' }
      await checkRateLimit('login', `${getClientIdentity(this)}:${code}`)

      if (!WX_APPID || !WX_SECRET) {
        return { code: -1, message: '服务端未配置微信环境变量，请在 uniCloud 控制台设置 WX_APPID 和 WX_SECRET' }
      }

      const wxRes = await uniCloud.httpclient.request(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${code}&grant_type=authorization_code`,
        { dataType: 'json' }
      )
      const { openid, errmsg } = wxRes.data
      if (!openid) return { code: -1, message: errmsg || '获取 openid 失败' }

      const col = db.collection('cicada_users')
      const now = Date.now()
      const token = genToken()
      const tokenExpire = now + TOKEN_EXPIRE

      const found = await col.where({ openid }).limit(1).get()
      let userId, phone, role

      if (!found.data.length) {
        phone = `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`
        role = 'user'
        const ins = await col.add({ openid, phone, role, token, token_expire: tokenExpire, create_time: now, last_login: now })
        userId = ins.id
      } else {
        const user = found.data[0]
        userId = user._id
        phone = user.phone
        role = user.role
        await col.doc(userId).update({ token, token_expire: tokenExpire, last_login: now })
      }

      return {
        code: 0,
        message: '登录成功',
        data: { token, userInfo: buildUserInfo({ phone, role }, userId) }
      }
    } catch (e) {
      return { code: -1, message: e.message || '登录失败' }
    }
  },

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
        const data = pickFields(address, ['name', 'phone', 'region', 'detail', 'unit'])
        data.is_default = normalizeBool(address && address.is_default)
        if (data.is_default) {
          await col.where({ user_id: userId }).update({ is_default: false })
        }
        const res = await col.add({ ...data, user_id: userId, create_time: Date.now() })
        return { code: 0, data: { id: res.id } }
      } else if (action === 'edit') {
        if (!address || !address._id) return { code: -1, msg: '缺少地址ID' }
        const data = pickFields(address, ['name', 'phone', 'region', 'detail', 'unit', 'is_default'])
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
      if (!['投诉', '建议'].includes(type)) return { code: -1, msg: '反馈类型不正确' }
      if (!content || typeof content !== 'string') return { code: -1, msg: '反馈内容不能为空' }
      await db.collection('cicada_feedbacks').add({
        user_id: user._id,
        type,
        content,
        images: Array.isArray(images) ? images : [],
        contact_type,
        contact_value,
        rel_order_no,
        status: '待处理',
        create_time: Date.now()
      })
      return { code: 0 }
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
            status: item.status,
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
