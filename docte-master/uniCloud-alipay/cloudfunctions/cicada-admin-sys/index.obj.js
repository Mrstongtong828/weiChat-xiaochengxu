const db = uniCloud.database()
const crypto = require('crypto')
const { ROLE_LABELS, ALL_ROLES, PERMISSIONS } = loadWorkflowModule()
const { createAdminAuthError, toAdminErrorResponse, normalizeAdminAuthResult, isAdminTokenExpired } = loadAdminAuthModule()

function loadWorkflowModule() {
  try {
    return require('cicada-order-workflow')
  } catch (packageError) {
    return require('../common/cicada-order-workflow')
  }
}

function loadAdminAuthModule() {
  try {
    return require('cicada-admin-auth')
  } catch (packageError) {
    return require('../common/cicada-admin-auth')
  }
}

const ADMIN_TOKEN_EXPIRE = 8 * 3600 * 1000 // 8小时
const STAFF_ROLES = ALL_ROLES
const ADMIN_LOGIN_RATE_LIMIT = {
  max: 5,
  windowMs: 15 * 60 * 1000
}
const ADMIN_PASSWORD_MIN_LENGTH = 10
const ADMIN_ACCOUNT_LOCK_THRESHOLD = 8
const ADMIN_ACCOUNT_LOCK_MS = 15 * 60 * 1000
const PASSWORD_RESET_EXPIRE_MS = 10 * 60 * 1000
const PASSWORD_RESET_RATE_LIMIT = 3
const PASSWORD_RESET_MAX_ATTEMPTS = 5
const PASSWORD_RESET_RESPONSE = '如果该邮箱已绑定后台账号，验证码将在几分钟内发送，请注意查收。'
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
  }
]
const GUIDE_TYPE_ALIASES = {
  quick: ['快速指南', '快速入门'],
  repair: ['报修指南', '报修流程']
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

function assertPasswordPolicy(password, label = '密码') {
  const value = String(password || '')
  if (value.length < ADMIN_PASSWORD_MIN_LENGTH) {
    throw new Error(`${label}至少需要 ${ADMIN_PASSWORD_MIN_LENGTH} 位`)
  }
  if (value.length > 128) throw new Error(`${label}不能超过 128 位`)
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw new Error(`${label}必须同时包含字母和数字`)
  }
  return value
}

function genTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let result = ''
  while (result.length < 16) result += alphabet[crypto.randomInt(alphabet.length)]
  return result
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

// 员工/设置等敏感操作审计（医疗器械合规备查），写 cicada_admin_logs。
// detail 只记变更字段名/角色/键列表，绝不写密码等密钥明文。审计失败不阻断主流程。
async function writeAdminLog(actor, action, target = {}, detail = {}) {
  try {
    await db.collection('cicada_admin_logs').add({
      operator_id: (actor && actor._id) || '',
      operator_name: (actor && (actor.name || actor.nickname || actor.username)) || '',
      operator_role: (actor && actor.role) || '',
      action,
      target_id: (target && target.id) || '',
      target_name: (target && target.name) || '',
      detail: detail || {},
      create_time: Date.now()
    })
  } catch (e) {
    console.warn('writeAdminLog failed:', e.message)
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

async function verifyAdminToken(token, allowedRoles = ['admin'], options = {}) {
  if (!token) throw createAdminAuthError('鉴权失败')
  // `token` remains the compatibility field for existing deployments.  New logins
  // are also retained in admin_sessions so a second browser does not invalidate
  // an operator who is already working in the back office.
  let res = await db.collection('cicada_users').where({ token }).limit(1).get()
  if (!res.data || !res.data.length) {
    res = await db.collection('cicada_users').where({ 'admin_sessions.token': token }).limit(1).get()
  }
  const user = res.data && res.data[0]
  if (!user || user.disabled) throw createAdminAuthError('鉴权失败：非管理人员禁止访问该接口')
  const session = (Array.isArray(user.admin_sessions) ? user.admin_sessions : [])
    .find(item => item && item.token === token)
  const expireAt = session ? session.expire_at : user.token_expire
  if (isAdminTokenExpired(expireAt)) throw createAdminAuthError('鉴权失败：Token已过期')
  if (user.must_change_password && !options.allowPasswordChange) throw new Error('当前使用临时密码，请先修改密码')
  if (user.role !== 'superadmin' && !allowedRoles.includes(user.role)) throw new Error('无权限')
  return user
}

function normalizeIdentity(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeEmail(value = '') {
  const email = normalizeIdentity(value)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('请输入有效的邮箱地址')
  return email
}

function digestResetValue(value) {
  const secret = getEnvValue('PASSWORD_RESET_SECRET')
  if (!secret || secret.length < 32) throw new Error('密码找回服务尚未完成安全配置')
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex')
}

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'hex')
  const rightBuffer = Buffer.from(String(right || ''), 'hex')
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function createResetCode() {
  return String(crypto.randomInt(100000, 1000000))
}

function getMailConfig() {
  const host = getEnvValue('SMTP_HOST')
  const user = getEnvValue('SMTP_USER')
  const pass = getEnvValue('SMTP_PASS')
  const from = getEnvValue('SMTP_FROM') || user
  if (!host || !user || !pass || !from) throw new Error('密码找回邮件服务尚未配置')
  return {
    transport: {
      host,
      port: Number(getEnvValue('SMTP_PORT') || 465),
      secure: getEnvValue('SMTP_SECURE').toLowerCase() !== 'false',
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 3000,
      auth: { user, pass }
    },
    from
  }
}

async function sendPasswordResetEmail(email, code) {
  const nodemailer = require('nodemailer')
  const config = getMailConfig()
  await nodemailer.createTransport(config.transport).sendMail({
    from: config.from,
    to: email,
    subject: '思科达维修服务后台密码验证码',
    text: `您的密码重置验证码是 ${code}，10 分钟内有效。若非本人操作，请忽略本邮件。`,
    html: `<p>您的密码重置验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>验证码 10 分钟内有效。若非本人操作，请忽略本邮件。</p>`
  })
}

async function waitForEnumerationSafeResponse(startTime) {
  const minimumMs = 3500 + crypto.randomInt(0, 301)
  const remaining = minimumMs - (Date.now() - startTime)
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
}

async function cleanupExpiredPasswordResets() {
  try {
    await db.collection('cicada_password_resets')
      .where({ expires_at: db.command.lt(Date.now() - 24 * 3600 * 1000) })
      .remove()
  } catch (error) {
    console.warn('清理过期密码重置记录失败:', error.message)
  }
}

async function assertPasswordResetAllowed(emailHash, ip) {
  const identities = [
    { scope: 'admin-password-reset:email', identity: emailHash },
    { scope: 'admin-password-reset:ip', identity: normalizeIdentity(ip) }
  ].filter(item => item.identity && item.identity !== 'unknown')
  for (const item of identities) {
    const record = await getRateLimitRecord(`${item.scope}:${item.identity}`)
    if (record && Date.now() <= record.reset_time && record.count >= PASSWORD_RESET_RATE_LIMIT) {
      throw new Error('请求过于频繁，请 15 分钟后再试')
    }
  }
  await Promise.all(identities.map(item => recordRateLimitHit(item.scope, item.identity)))
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
    const current = await db.collection('cicada_users').doc(userId).get()
    const existing = current.data && current.data[0]
    const nextFailedCount = (Number(existing && existing.failed_login_count) || 0) + 1
    await db.collection('cicada_users').doc(userId).update({
      failed_login_count: db.command.inc(1),
      last_failed_login: Date.now(),
      last_login_ip: ip,
      ...(nextFailedCount >= ADMIN_ACCOUNT_LOCK_THRESHOLD
        ? { lock_until: Date.now() + ADMIN_ACCOUNT_LOCK_MS }
        : {})
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
  return false
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

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return String(value).trim()
  }
  return ''
}

function normalizeOssHost(value = '') {
  return String(value || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function normalizeOssEndpoint(value = '') {
  const endpoint = normalizeOssHost(value)
  if (!endpoint) return ''
  if (endpoint.indexOf('.') === -1 && endpoint.indexOf('oss-') === 0) return `${endpoint}.aliyuncs.com`
  return endpoint
}

function normalizeOssPrefix(value = 'product-video/') {
  const prefix = String(value || 'product-video/')
    .replace(/[^a-zA-Z0-9_\-/]/g, '')
    .replace(/^\/+/, '')
  return prefix.endsWith('/') ? prefix : `${prefix}/`
}

async function issueOssUploadPolicy(keyPrefix = 'product-video/') {
  const accessKeyId = getEnvValue('ALIYUN_OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_ID')
  const accessKeySecret = getEnvValue('ALIYUN_OSS_ACCESS_KEY_SECRET', 'OSS_ACCESS_KEY_SECRET')
  const bucket = getEnvValue('ALIYUN_OSS_BUCKET', 'OSS_BUCKET')
  const endpoint = normalizeOssEndpoint(getEnvValue('ALIYUN_OSS_ENDPOINT', 'OSS_ENDPOINT'))
  const cdnDomain = normalizeOssHost(getEnvValue('ALIYUN_OSS_CDN_DOMAIN', 'OSS_CDN_DOMAIN'))

  if (!accessKeyId || !accessKeySecret || !bucket || !endpoint) {
    throw new Error('Aliyun OSS is not configured. Set ALIYUN_OSS_ACCESS_KEY_ID / ALIYUN_OSS_ACCESS_KEY_SECRET / ALIYUN_OSS_BUCKET / ALIYUN_OSS_ENDPOINT in cloud function environment variables.')
  }

  const safePrefix = normalizeOssPrefix(keyPrefix)
  const maxSize = Number(getEnvValue('ALIYUN_OSS_MAX_SIZE', 'OSS_MAX_SIZE')) || 1024 * 1024 * 1024
  const expireSeconds = Math.min(3600, Math.max(60, Number(getEnvValue('ALIYUN_OSS_EXPIRE_SECONDS', 'OSS_EXPIRE_SECONDS')) || 1800))
  const expiration = new Date(Date.now() + expireSeconds * 1000).toISOString()
  const policyText = JSON.stringify({
    expiration,
    conditions: [
      ['starts-with', '$key', safePrefix],
      ['starts-with', '$Content-Type', ''],
      ['eq', '$success_action_status', '200'],
      ['content-length-range', 0, maxSize]
    ]
  })
  const policy = Buffer.from(policyText).toString('base64')
  const signature = crypto.createHmac('sha1', accessKeySecret).update(policy).digest('base64')
  const uploadUrl = `https://${bucket}.${endpoint}`
  const baseUrl = cdnDomain ? `https://${cdnDomain}` : uploadUrl

  return {
    accessKeyId,
    bucket,
    endpoint,
    keyPrefix: safePrefix,
    uploadUrl,
    baseUrl,
    policy,
    signature,
    maxSize,
    expireTime: Date.now() + expireSeconds * 1000,
    successStatus: '200'
  }
}

function validatePolicyDocumentUpload(buffer, safeDir, fileName) {
  if (!safeDir.startsWith('policy-documents/')) return

  const extension = String(fileName || '').split('.').pop().toLowerCase()
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2])
  const isPdf = buffer.length >= 5 && buffer.subarray(0, 5).toString() === '%PDF-'
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'

  if (safeDir.endsWith('/source')) {
    if (buffer.length > 15 * 1024 * 1024) throw new Error('Word 文档不能超过 15MB')
    if (extension !== 'docx' || !isZip) throw new Error('政策原件仅支持有效的 DOCX 文件')
    return
  }
  if (safeDir.endsWith('/pdf')) {
    if (buffer.length > 25 * 1024 * 1024) throw new Error('政策 PDF 不能超过 25MB')
    if (extension !== 'pdf' || !isPdf) throw new Error('政策原稿必须是有效的 PDF 文件')
    return
  }
  if (safeDir.endsWith('/pages')) {
    if (buffer.length > 6 * 1024 * 1024) throw new Error('政策页面图片不能超过 6MB')
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(extension) || !(isPng || isJpeg || isWebp)) {
      throw new Error('政策页面仅支持有效的 PNG、JPEG 或 WebP 图片')
    }
    return
  }
  throw new Error('政策文档上传目录不正确')
}

function validateGenericAdminUpload(buffer, fileName, fileType = '') {
  if (!buffer.length) throw new Error('上传文件不能为空')

  const extension = String(fileName || '').split('.').pop().toLowerCase()
  const mime = String(fileType || '').split(';')[0].trim().toLowerCase()
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2])
  const isDocx = isZip && buffer.includes(Buffer.from('[Content_Types].xml')) && buffer.includes(Buffer.from('word/'))
  const isDoc = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  const isPdf = buffer.length >= 5 && buffer.subarray(0, 5).toString() === '%PDF-'
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  const formats = {
    jpg: { valid: isJpeg, maxSize: 6 * 1024 * 1024, mimes: ['image/jpeg'] },
    jpeg: { valid: isJpeg, maxSize: 6 * 1024 * 1024, mimes: ['image/jpeg'] },
    png: { valid: isPng, maxSize: 6 * 1024 * 1024, mimes: ['image/png'] },
    webp: { valid: isWebp, maxSize: 6 * 1024 * 1024, mimes: ['image/webp'] },
    pdf: { valid: isPdf, maxSize: 20 * 1024 * 1024, mimes: ['application/pdf'] },
    doc: { valid: isDoc, maxSize: 20 * 1024 * 1024, mimes: ['application/msword'] },
    docx: {
      valid: isDocx,
      maxSize: 20 * 1024 * 1024,
      mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip']
    }
  }
  const format = formats[extension]
  if (!format || !format.valid) throw new Error('仅支持有效的 JPG、PNG、WebP、PDF 或 Word 文件')
  if (buffer.length > format.maxSize) throw new Error(`文件不能超过 ${format.maxSize / 1024 / 1024}MB`)
  if (mime && !format.mimes.includes(mime)) throw new Error('文件类型与文件内容不一致')
}

function validatePolicyDocumentSetting(key, value) {
  if (!['warranty_policy_document', 'fee_policy_document'].includes(key) || value === '') return
  if (typeof value !== 'string' || value.length > 500000) throw new Error('政策文档配置过大')

  let document
  try {
    document = JSON.parse(value)
  } catch (error) {
    throw new Error('政策文档配置格式不正确')
  }
  if (!document || document.status !== 'published' || Number(document.schemaVersion) !== 1) {
    throw new Error('政策文档发布状态不正确')
  }
  const pages = document.original && Array.isArray(document.original.pages) ? document.original.pages : []
  if (pages.length > 20) throw new Error('政策文档页数不能超过 20 页')
  const mobileHtml = String(document.mobileHtml || '')
  if (!mobileHtml && !pages.length && !(document.original && document.original.pdfUrl)) {
    throw new Error('政策文档没有可展示内容')
  }
  if (/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|svg|canvas)\b|\son\w+\s*=|javascript:/i.test(mobileHtml)) {
    throw new Error('政策文档包含不安全内容')
  }
  const fileUrls = [
    document.source && document.source.fileUrl,
    document.original && document.original.pdfUrl,
    ...pages
  ].filter(Boolean)
  if (fileUrls.some(url => !/^(cloud:\/\/|https?:\/\/)/i.test(String(url)))) {
    throw new Error('政策文档文件地址不正确')
  }
}

async function uploadAdminFile(ctx, params, defaultDir = 'guides/', allowedRoles = ['admin']) {
  const data = getRequestData(ctx, params)
  const { token, fileContent, fileName, fileType, dir } = data
  await verifyAdminToken(token, allowedRoles)

  if (!fileContent || !fileName) return { code: -1, msg: '缺少文件内容或文件名' }
  const maxEncodedLength = Math.ceil(25 * 1024 * 1024 * 4 / 3) + 4
  if (typeof fileContent !== 'string' || fileContent.length > maxEncodedLength) {
    throw new Error('上传文件不能超过 25MB')
  }

  const buffer = Buffer.from(fileContent, 'base64')
  const safeFileName = String(fileName).replace(/[\\/:*?"<>|]/g, '_')
  const safeDir = String(dir || defaultDir).replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/\/+$/, '') || 'guides'
  if (!safeFileName || safeFileName.length > 180) throw new Error('文件名不正确')
  if (safeDir.startsWith('policy-documents/')) {
    validatePolicyDocumentUpload(buffer, safeDir, safeFileName)
  } else {
    validateGenericAdminUpload(buffer, safeFileName, fileType)
  }
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

async function uploadAdminAvatar(ctx, params) {
  const data = getRequestData(ctx, params)
  const { token, fileContent, fileName, fileType } = data
  const user = await verifyAdminToken(token, STAFF_ROLES)
  if (!fileContent || !fileName) return { code: -1, msg: '请选择头像图片' }

  const type = String(fileType || '').toLowerCase()
  const allowedTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const extension = String(fileName).split('.').pop().toLowerCase()
  if (!allowedTypes[type] || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return { code: -1, msg: '头像仅支持 JPG、PNG 或 WebP 图片' }
  }

  const buffer = Buffer.from(fileContent, 'base64')
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) return { code: -1, msg: '头像图片不能超过 2MB' }
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  if ((type === 'image/jpeg' && !isJpeg) || (type === 'image/png' && !isPng) || (type === 'image/webp' && !isWebp)) {
    return { code: -1, msg: '头像文件内容与图片格式不一致' }
  }

  const cloudPath = `admin-avatars/${user._id}/${Date.now()}.${allowedTypes[type]}`
  const res = await uniCloud.uploadFile({ cloudPath, fileContent: buffer, fileType: type })
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

  _after(error, result) {
    if (error) return toAdminErrorResponse(error)
    return normalizeAdminAuthResult(result)
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
      if (Number(user.lock_until) > Date.now()) {
        return { code: -1, msg: '账号已临时锁定，请 15 分钟后再试' }
      }
      const pwdCheck = verifyPassword(user, password)
      if (!pwdCheck) {
        await recordAdminLoginFailure(username, loginIp, user._id)
        return { code: -1, msg: '用户名或密码错误' }
      }

      const token = genToken()
      const tokenExpire = Date.now() + ADMIN_TOKEN_EXPIRE
      const activeSessions = (Array.isArray(user.admin_sessions) ? user.admin_sessions : [])
        .filter(item => item && item.token && !isAdminTokenExpired(item.expire_at))
        .slice(-4)
      const updateData = {
        token,
        token_expire: tokenExpire,
        admin_sessions: [...activeSessions, { token, expire_at: tokenExpire, create_time: Date.now() }],
        last_login: Date.now(),
        last_login_ip: loginIp,
        failed_login_count: 0
      }
      // 保留既有紧急救援账号规则：首次登录时自愈为超级管理员。
      if (user.username === 'admin_root' && user.role !== 'superadmin') {
        updateData.role = 'superadmin'
        user.role = 'superadmin'
      }
      updateData.lock_until = 0
      await db.collection('cicada_users').doc(user._id).update(updateData)
      await clearAdminLoginFailures(username, loginIp)

      return {
        code: 0,
        msg: '登录成功',
        token: token,
        userId: user._id,
        role: user.role,
        mustChangePassword: Boolean(user.must_change_password),
        // Legacy clients use isAdmin for administrator-level actions; superadmin has the same access.
        isAdmin: ['admin', 'superadmin'].includes(user.role),
        isEngineer: user.role === 'engineer',
        isFinance: user.role === 'finance',
        isSupport: user.role === 'support',
        user: {
          _id: user._id,
          username: user.username,
          name: user.name || user.nickname || '',
          phone: user.phone || '',
          avatar: user.avatar || '',
          role: user.role,
          roleDisplay: ROLE_LABELS[user.role] || user.role,
          mustChangePassword: Boolean(user.must_change_password)
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
      assertPasswordPolicy(newPassword, '新密码')
      if (oldPassword === newPassword) return { code: -1, msg: '新密码不能与原密码相同' }

      const user = await verifyAdminToken(token, STAFF_ROLES, { allowPasswordChange: true })
      if (!verifyPassword(user, oldPassword)) return { code: -1, msg: '原密码不正确' }

      await db.collection('cicada_users').doc(user._id).update({
        ...buildPasswordFields(newPassword),
        must_change_password: false,
        token: '',
        token_expire: 0,
        admin_sessions: [],
        update_time: Date.now()
      })

      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async requestPasswordReset(params) {
    try {
      const requestStartedAt = Date.now()
      const { email } = getRequestData(this, params)
      const normalizedEmail = normalizeEmail(email)
      const emailHash = digestResetValue(normalizedEmail)
      const requestIp = getClientIp(this)
      await assertPasswordResetAllowed(emailHash, requestIp)
      getMailConfig()
      await cleanupExpiredPasswordResets()
      const userRes = await db.collection('cicada_users')
        .where({ email: normalizedEmail, role: db.command.in(STAFF_ROLES), disabled: db.command.neq(true) })
        .limit(1)
        .get()
      const user = userRes.data && userRes.data[0]
      if (!user || user.username === 'admin_root') {
        await waitForEnumerationSafeResponse(requestStartedAt)
        return { code: 0, msg: PASSWORD_RESET_RESPONSE }
      }

      const code = createResetCode()
      const now = Date.now()
      const challenge = await db.collection('cicada_password_resets').add({
        email_hash: emailHash,
        code_hash: digestResetValue(`${emailHash}:${code}`),
        user_id: user._id,
        request_ip: requestIp,
        attempts: 0,
        used: false,
        expires_at: now + PASSWORD_RESET_EXPIRE_MS,
        create_time: now,
        update_time: now
      })
      try {
        await sendPasswordResetEmail(normalizedEmail, code)
      } catch (mailError) {
        await db.collection('cicada_password_resets').doc(challenge.id).update({ used: true, update_time: Date.now() })
        console.error('密码重置邮件发送失败:', mailError.message)
      }
      await waitForEnumerationSafeResponse(requestStartedAt)
      return { code: 0, msg: PASSWORD_RESET_RESPONSE }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async resetPasswordByEmail(params) {
    try {
      const { email, code, newPassword } = getRequestData(this, params)
      const normalizedEmail = normalizeEmail(email)
      const normalizedCode = String(code || '').trim()
      if (!/^\d{6}$/.test(normalizedCode)) return { code: -1, msg: '验证码无效或已过期' }
      assertPasswordPolicy(newPassword, '新密码')
      const emailHash = digestResetValue(normalizedEmail)
      const resetRes = await db.collection('cicada_password_resets')
        .where({ email_hash: emailHash, used: false })
        .orderBy('create_time', 'desc')
        .limit(1)
        .get()
      const reset = resetRes.data && resetRes.data[0]
      if (!reset || Number(reset.expires_at) < Date.now() || Number(reset.attempts) >= PASSWORD_RESET_MAX_ATTEMPTS) {
        return { code: -1, msg: '验证码无效或已过期' }
      }
      const attempt = await db.collection('cicada_password_resets')
        .where({
          _id: reset._id,
          used: false,
          expires_at: db.command.gte(Date.now()),
          attempts: db.command.lt(PASSWORD_RESET_MAX_ATTEMPTS)
        })
        .update({ attempts: db.command.inc(1), update_time: Date.now() })
      if (!attempt.updated) return { code: -1, msg: '验证码无效或已过期' }
      const validCode = safeEqualHex(reset.code_hash, digestResetValue(`${emailHash}:${normalizedCode}`))
      if (!validCode) return { code: -1, msg: '验证码无效或已过期' }
      const userRes = await db.collection('cicada_users').doc(reset.user_id).get()
      const user = userRes.data && userRes.data[0]
      if (!user || user.disabled || !STAFF_ROLES.includes(user.role) || normalizeIdentity(user.email) !== normalizedEmail) {
        return { code: -1, msg: '验证码无效或已过期' }
      }
      if (verifyPassword(user, newPassword)) return { code: -1, msg: '新密码不能与原密码相同' }
      const consumed = await db.collection('cicada_password_resets')
        .where({
          _id: reset._id,
          used: false,
          expires_at: db.command.gte(Date.now())
        })
        .update({ used: true, update_time: Date.now() })
      if (!consumed.updated) return { code: -1, msg: '验证码无效或已过期' }
      await db.collection('cicada_users').doc(user._id).update({
        ...buildPasswordFields(newPassword),
        must_change_password: false,
        token: '',
        token_expire: 0,
        failed_login_count: 0,
        lock_until: 0,
        update_time: Date.now()
      })
      await db.collection('cicada_password_resets').where({ email_hash: emailHash, used: false }).update({ used: true, update_time: Date.now() })
      await writeAdminLog(user, 'password_reset_by_email', { id: user._id, name: user.username || user.name || '' }, { method: 'email' })
      return { code: 0, msg: '密码已重置，请使用新密码登录' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async updateMyProfile(params) {
    try {
      let token, name, phone, avatar
      if (params && params.token) {
        ({ token, name, phone, avatar } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ token, name, phone, avatar } = body)
        }
      }

      const user = await verifyAdminToken(token, STAFF_ROLES)
      const normalizedName = String(name || '').trim()
      const normalizedPhone = String(phone || '').trim()
      if (!normalizedName) return { code: -1, msg: '请输入真实姓名' }
      if (normalizedName.length > 50) return { code: -1, msg: '真实姓名不能超过 50 个字符' }
      const isMobilePhone = /^1[3-9]\d{9}$/.test(normalizedPhone)
      const isLandlinePhone = /^(?:0\d{2,3}[- ]?)?\d{7,8}(?:[- ]?\d{1,6})?$/.test(normalizedPhone)
      if (normalizedPhone && !isMobilePhone && !isLandlinePhone) {
        return { code: -1, msg: '请输入有效的手机号或座机号' }
      }

      const normalizedAvatar = avatar === undefined ? String(user.avatar || '') : String(avatar || '').trim()
      const avatarPathPrefix = `/admin-avatars/${user._id}/`
      if (normalizedAvatar && (!normalizedAvatar.startsWith('cloud://') || !normalizedAvatar.includes(avatarPathPrefix))) {
        return { code: -1, msg: '头像文件地址无效，请重新上传' }
      }

      await db.collection('cicada_users').doc(user._id).update({
        name: normalizedName,
        phone: normalizedPhone,
        avatar: normalizedAvatar,
        update_time: Date.now()
      })
      if (user.avatar && user.avatar !== normalizedAvatar && String(user.avatar).startsWith('cloud://') && String(user.avatar).includes(avatarPathPrefix)) {
        try { await uniCloud.deleteFile({ fileList: [user.avatar] }) } catch (err) { console.warn('清理旧头像失败:', err.message) }
      }
      await writeAdminLog(user, 'profile_update', { id: user._id, name: user.username || normalizedName }, { fields: ['name', 'phone', 'avatar'] })
      return { code: 0, data: { name: normalizedName, phone: normalizedPhone, avatar: normalizedAvatar } }
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
      const operator = await verifyAdminToken(token, ['admin'])

      const col = db.collection('cicada_users')
      const targetRes = await col.doc(userId).get()
      const target = targetRes.data && targetRes.data[0]
      if (!target || !STAFF_ROLES.includes(target.role)) return { code: -1, msg: '用户不存在' }
      if (target.username === 'admin_root') return { code: -1, msg: 'admin_root 为紧急救援账号，禁止重置密码' }

      const temporaryPassword = genTemporaryPassword()
      await col.doc(userId).update({
        ...buildPasswordFields(temporaryPassword),
        must_change_password: true,
        token: '',
        token_expire: 0,
        admin_sessions: [],
        update_time: Date.now()
      })

      await writeAdminLog(operator, 'reset_password', { id: userId, name: target.username || target.name || '' }, { role: target.role, temporaryPasswordIssued: true })
      return { code: 0, data: { temporaryPassword } }
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
        assertPasswordPolicy(staff.password, '登录密码')
        if (!STAFF_ROLES.includes(staff.role)) return { code: -1, msg: '角色不正确' }
        if (staff.role === 'superadmin' && operator.role !== 'superadmin') return { code: -1, msg: '只有超级管理员可创建超级管理员账号' }
        const normalizedEmail = normalizeEmail(staff.email)
        const exists = await col.where({ username: staff.username }).limit(1).get()
        if (exists.data.length) return { code: -1, msg: '账号已存在' }
        const emailExists = await col.where({ email: normalizedEmail, role: db.command.in(STAFF_ROLES) }).limit(1).get()
        if (emailExists.data.length) return { code: -1, msg: '邮箱已绑定其他后台账号' }
        const data = pickFields(staff, ['username', 'name', 'phone', 'avatar', 'role', 'device_categories', 'service_areas'])
        data.email = normalizedEmail
        const res = await col.add({
          ...data,
          openid: '',
          disabled: false,
          ...buildPasswordFields(staff.password),
          create_time: Date.now()
        })
        await writeAdminLog(operator, 'staff_add', { id: res.id, name: staff.username }, { role: staff.role })
        return { code: 0, data: { id: res.id } }
      } else if (action === 'edit') {
        if (!staff || !staff._id) return { code: -1, msg: '缺少员工ID' }
        const data = pickFields(staff, ['username', 'name', 'phone', 'avatar', 'role', 'disabled', 'device_categories', 'service_areas'])
        if (Object.prototype.hasOwnProperty.call(staff, 'email')) {
          data.email = normalizeEmail(staff.email)
          const emailExists = await col.where({ email: data.email, role: db.command.in(STAFF_ROLES), _id: db.command.neq(staff._id) }).limit(1).get()
          if (emailExists.data.length) return { code: -1, msg: '邮箱已绑定其他后台账号' }
        }
        if (data.role && !STAFF_ROLES.includes(data.role)) return { code: -1, msg: '角色不正确' }
        if (data.role === 'superadmin' && operator.role !== 'superadmin') return { code: -1, msg: '只有超级管理员可设置超级管理员角色' }
        if (staff.password) {
          assertPasswordPolicy(staff.password, '登录密码')
          Object.assign(data, buildPasswordFields(staff.password), { must_change_password: true, token: '', token_expire: 0, admin_sessions: [] })
        }
        if (!Object.keys(data).length) return { code: -1, msg: '没有可更新的员工字段' }
        const res = await col.where({ _id: staff._id, role: db.command.in(STAFF_ROLES) }).update(data)
        if (!res.updated) return { code: -1, msg: '员工不存在' }
        // 只记变更字段名，绝不写密码明文/哈希
        const changedFields = Object.keys(data).filter(k => !/^password/i.test(k))
        await writeAdminLog(operator, 'staff_edit', { id: staff._id, name: data.username || staff.username || '' }, { fields: changedFields, passwordChanged: Boolean(staff.password), role: data.role || '' })
        return { code: 0 }
      } else if (action === 'disable') {
        if (!staff || !staff._id) return { code: -1, msg: '缺少员工ID' }
        const disabled = staff.disabled !== undefined ? staff.disabled : true
        const res = await col.where({ _id: staff._id, role: db.command.in(STAFF_ROLES) }).update({ disabled })
        if (!res.updated) return { code: -1, msg: '员工不存在' }
        await writeAdminLog(operator, 'staff_disable', { id: staff._id, name: (staff && staff.username) || '' }, { disabled })
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
      // 仅统计新入库时显式标记的未读反馈，历史数据不在部署后突然全部标红。
      const [pendingRes, highRiskRes] = await Promise.all([
        db.collection('cicada_feedbacks').where({ is_read: false }).count(),
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
          is_read: item.is_read !== false,
          read_time: item.read_time || 0,
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

  // 管理员打开反馈详情后标记为已读。
  async markFeedbackRead(params) {
    try {
      const { token, id } = getRequestData(this, params)
      await verifyAdminToken(token, PERMISSIONS.view_feedback)
      const feedback = await loadFeedback(id)
      if (feedback.is_read === true) return { code: 0, msg: '反馈已读' }

      await db.collection('cicada_feedbacks').doc(feedback._id).update({
        is_read: true,
        read_time: new Date()
      })
      return { code: 0, msg: '已标记为已读' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 批量删除反馈，单次最多 100 条。
  async deleteFeedbacks(params) {
    try {
      const { token, ids } = getRequestData(this, params)
      const operator = await verifyAdminToken(token, PERMISSIONS.handle_feedback)
      const feedbackIds = [...new Set((Array.isArray(ids) ? ids : []).map(id => fbText(id, 60)).filter(Boolean))]
      if (!feedbackIds.length) return { code: -1, msg: '请选择要删除的反馈' }
      if (feedbackIds.length > 100) return { code: -1, msg: '单次最多删除100条反馈' }

      const col = db.collection('cicada_feedbacks')
      const feedbackRes = await col.where({ _id: db.command.in(feedbackIds) }).get()
      const feedbacks = feedbackRes.data || []
      if (!feedbacks.length) return { code: -1, msg: '所选反馈不存在或已被删除' }

      let deletedCount = 0
      for (let offset = 0; offset < feedbacks.length; offset += 10) {
        const batch = feedbacks.slice(offset, offset + 10)
        const batchResults = await Promise.all(batch.map(async feedback => {
          const removeRes = await col.doc(feedback._id).remove()
          const deleted = Number(removeRes.deleted || 0)
          if (!deleted) return 0
          await writeFeedbackEvent(
            operator,
            feedback,
            'feedback_delete',
            { type: feedback.type || '', status: feedback.status || '', content: fbText(feedback.content, 200) },
            { deleted: true }
          )
          return deleted
        }))
        deletedCount += batchResults.reduce((sum, deleted) => sum + deleted, 0)
      }
      if (!deletedCount) return { code: -1, msg: '所选反馈已被删除，请刷新列表' }
      return { code: 0, data: { deleted: deletedCount }, msg: `已删除${deletedCount}条反馈` }
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
      const operator = await verifyAdminToken(token, ['admin'])

      if (!settings || typeof settings !== 'object') {
        return { code: -1, msg: '配置数据格式不正确' }
      }

      const col = db.collection('cicada_settings')
      const now = Date.now()

      for (const [key, value] of Object.entries(settings)) {
        validatePolicyDocumentSetting(key, value)
        const existing = await col.where({ key }).limit(1).get()
        if (existing.data.length > 0) {
          await col.doc(existing.data[0]._id).update({ value, update_time: now })
        } else {
          await col.add({ key, value, update_time: now })
        }
      }

      await writeAdminLog(operator, 'save_settings', {}, { keys: Object.keys(settings) })
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

  async getSurveyList(params) {
    try {
      let token, page = 1, pageSize = 20, keyword = '', status = ''
      if (params && params.token) {
        ({ token, page = 1, pageSize = 20, keyword = '', status = '' } = params)
      } else if (this.params) {
        ({ token, page = 1, pageSize = 20, keyword = '', status = '' } = this.params)
      }
      await verifyAdminToken(token, ['admin', 'support'])
      const pagination = fbPage(page, pageSize)
      const where = {}
      const kw = fbText(keyword, 80)
      const statusText = fbText(status, 30)
      if (statusText) where.status = statusText
      if (kw) {
        where.$or = [
          { order_no: new RegExp(kw, 'i') },
          { contact: new RegExp(kw, 'i') },
          { comment: new RegExp(kw, 'i') }
        ]
      }

      const col = db.collection('cicada_surveys')
      const [listRes, countRes] = await Promise.all([
        col.where(where)
          .orderBy('create_time', 'desc')
          .skip((pagination.page - 1) * pagination.pageSize)
          .limit(pagination.pageSize)
          .get(),
        col.where(where).count()
      ])

      return {
        code: 0,
        data: {
          list: listRes.data || [],
          total: countRes.total || 0,
          page: pagination.page,
          pageSize: pagination.pageSize
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async updateSurveyStatus(params) {
    try {
      let token, id, status
      if (params && params.token) {
        ({ token, id, status } = params)
      } else if (this.params) {
        ({ token, id, status } = this.params)
      }
      await verifyAdminToken(token, ['admin', 'support'])
      const surveyId = fbText(id, 60)
      const nextStatus = fbText(status, 30)
      if (!surveyId) return { code: -1, msg: '缺少调研记录ID' }
      if (!['new', 'contacted', 'closed'].includes(nextStatus)) return { code: -1, msg: '调研状态不正确' }
      await db.collection('cicada_surveys').doc(surveyId).update({
        status: nextStatus,
        update_time: Date.now()
      })
      return { code: 0 }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 管理员批量删除调研记录，单次最多 100 条，并保留审计记录。
  async deleteSurveys(params) {
    try {
      let token, ids
      if (params && params.token) ({ token, ids } = params)
      else if (this.params) ({ token, ids } = this.params)
      const operator = await verifyAdminToken(token, ['admin'])
      const surveyIds = [...new Set((Array.isArray(ids) ? ids : []).map(id => fbText(id, 60)).filter(Boolean))]
      if (!surveyIds.length) return { code: -1, msg: '请选择要删除的调研记录' }
      if (surveyIds.length > 100) return { code: -1, msg: '单次最多删除100条调研记录' }
      const col = db.collection('cicada_surveys')
      const found = await col.where({ _id: db.command.in(surveyIds) }).get()
      const surveys = found.data || []
      if (!surveys.length) return { code: -1, msg: '所选调研记录不存在或已被删除' }
      let deleted = 0
      for (const survey of surveys) {
        const result = await col.doc(survey._id).remove()
        if (!Number(result.deleted || 0)) continue
        deleted += 1
        await writeAdminLog(operator, 'survey_delete', { id: survey._id, name: survey.order_no || survey.contact || '' }, {
          satisfaction: survey.satisfaction || '', rating: survey.rating || '', status: survey.status || ''
        })
      }
      if (!deleted) return { code: -1, msg: '所选调研记录已被删除，请刷新列表' }
      return { code: 0, data: { deleted }, msg: `已删除${deleted}条调研记录` }
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
      await verifyAdminToken(token, ['admin'])

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
      const assignable = ['file_name', 'file_url', 'file_type', 'title', 'description', 'summary', 'desc', 'content', 'category', 'audience']
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
        title: data.title || data.description || data.desc || '',
        description: data.description || data.title || data.desc || '',
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

  // 删除教程（固定类型 quick/repair 不允许删除）
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

  // 通用文件上传：dir 控制云存储目录（guides/ compliance/ invoice/ print/）
  // 全体员工可上传（如财务上传发票PDF）；敏感性由「引用该文件的方法」各自鉴权（如 update_invoice）
  async uploadFile(params) {
    try {
      return await uploadAdminFile(this, params, 'guides/', ['admin', 'finance', 'engineer', 'support'])
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async uploadMyAvatar(params) {
    try {
      return await uploadAdminAvatar(this, params)
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // Issue Aliyun OSS browser upload policy for large admin files.
  async getOssUploadPolicy(params) {
    try {
      const data = getRequestData(this, params)
      const { token, keyPrefix } = data
      await verifyAdminToken(token, ['admin', 'finance', 'engineer', 'support'])
      const policy = await issueOssUploadPolicy(keyPrefix || 'product-video/')
      return { code: 0, data: policy }
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
      await verifyAdminToken(token, STAFF_ROLES)

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

Object.defineProperty(module.exports, '__test__', {
  value: Object.freeze({ validateGenericAdminUpload, verifyPassword })
})
