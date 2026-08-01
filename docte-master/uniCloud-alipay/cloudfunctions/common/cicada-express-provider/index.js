const crypto = require('crypto')

const QUERY_URL = 'https://poll.kuaidi100.com/poll/query.do'
const SUBSCRIBE_URL = 'https://poll.kuaidi100.com/poll'
const CACHE_TTL = 30 * 60 * 1000

const COMPANY_ALIASES = [
  { code: 'shunfeng', name: '顺丰速运', aliases: ['顺丰', '顺丰快递', '顺丰速运', 'sf', 's.f'] },
  { code: 'shentong', name: '申通快递', aliases: ['申通', '申通快递', 'sto'] },
  { code: 'zhongtong', name: '中通快递', aliases: ['中通', '中通快递', 'zto'] },
  { code: 'debangwuliu', name: '德邦快递', aliases: ['德邦', '德邦快递', '德邦物流', 'deppon', 'dpk'] },
  { code: 'yuantong', name: '圆通速递', aliases: ['圆通', '圆通快递', '圆通速递', 'yto'] },
  { code: 'yunda', name: '韵达快递', aliases: ['韵达', '韵达快递', 'yunda', 'yd'] },
  { code: 'youzhengguonei', name: '中国邮政', aliases: ['中国邮政', '邮政快递', '邮政包裹'] },
  { code: 'ems', name: 'EMS', aliases: ['ems', '邮政ems'] },
  { code: 'jd', name: '京东物流', aliases: ['京东', '京东快递', '京东物流', 'jd'] },
  { code: 'jtexpress', name: '极兔速递', aliases: ['极兔', '极兔快递', '极兔速递', 'j&t', 'jt'] },
  { code: 'xinfengwuliu', name: '信丰物流', aliases: ['信丰', '信丰快递', '信丰物流'] }
]

function text(value) {
  return String(value === undefined || value === null ? '' : value).trim()
}

function env(...names) {
  for (const name of names) {
    const value = text(process.env[name])
    if (value) return value
  }
  return ''
}

function md5(value) {
  return crypto.createHash('md5').update(String(value), 'utf8').digest('hex').toUpperCase()
}

function getConfig() {
  const provider = env('EXPRESS_PROVIDER') || 'kuaidi100'
  const key = env('KUAIDI100_KEY')
  const customer = env('KUAIDI100_CUSTOMER')
  const callbackUrl = env('KUAIDI100_CALLBACK_URL')
  const callbackSalt = env('KUAIDI100_CALLBACK_SALT')
  return {
    provider,
    key,
    customer,
    callbackUrl,
    callbackSalt,
    queryUrl: env('KUAIDI100_QUERY_URL') || QUERY_URL,
    subscribeUrl: env('KUAIDI100_SUBSCRIBE_URL') || SUBSCRIBE_URL,
    queryConfigured: provider === 'kuaidi100' && Boolean(key && customer),
    subscribeConfigured: provider === 'kuaidi100' && Boolean(key && callbackUrl && callbackSalt)
  }
}

function normalizeCompanyKey(value) {
  return text(value).toLowerCase().replace(/[\s._-]+/g, '')
}

function resolveCompany(value) {
  const input = normalizeCompanyKey(value)
  if (!input) return null
  return COMPANY_ALIASES.find(item => {
    if (normalizeCompanyKey(item.code) === input) return true
    return item.aliases.some(alias => normalizeCompanyKey(alias) === input)
  }) || null
}

function requireCompany(value) {
  const company = resolveCompany(value)
  if (!company) throw new Error(`快递100暂不支持或无法识别物流公司：${text(value) || '未填写'}`)
  return company
}

function normalizePhone(value) {
  return text(value).replace(/[^0-9-]/g, '')
}

function normalizeTracks(data = []) {
  if (!Array.isArray(data)) return []
  return data.map(item => ({
    title: text(item.status) || '物流更新',
    desc: text(item.context),
    time: text(item.ftime || item.time),
    location: text(item.location || item.areaName),
    statusCode: text(item.statusCode)
  })).filter(item => item.desc || item.time).sort((a, b) => String(a.time).localeCompare(String(b.time)))
}

function stateLabel(state) {
  const labels = {
    '0': '运输中', '1': '已揽收', '2': '物流异常', '3': '已签收', '4': '已退签',
    '5': '派送中', '6': '退回中', '7': '转投中', '8': '清关中', '14': '已拒签'
  }
  return labels[text(state)] || '物流更新'
}

function stateTone(state) {
  const value = text(state)
  if (value === '3') return 'ok'
  if (['2', '4', '6', '14'].includes(value)) return 'danger'
  return 'warn'
}

function toCache(result, trackingNo, company, source = 'query') {
  const tracks = normalizeTracks(result && result.data)
  const last = tracks[tracks.length - 1] || {}
  return {
    provider: 'kuaidi100',
    companyCode: company.code,
    companyName: company.name,
    trackingNo: text(trackingNo),
    state: text(result && result.state),
    status: stateLabel(result && result.state),
    tone: stateTone(result && result.state),
    message: text(result && result.message),
    tracks,
    lastTrackAt: text(last.time),
    fetchedAt: Date.now(),
    source
  }
}

async function postForm(url, data) {
  const response = await uniCloud.httpclient.request(url, {
    method: 'POST',
    data,
    dataType: 'json',
    contentType: 'application/x-www-form-urlencoded',
    timeout: 10000
  })
  return response && response.data ? response.data : {}
}

async function query({ company, trackingNo, phone = '', from = '', to = '' }) {
  const config = getConfig()
  if (!config.queryConfigured) return { configured: false, success: false, tracks: [] }
  const resolved = requireCompany(company)
  const paramObject = {
    com: resolved.code,
    num: text(trackingNo),
    phone: normalizePhone(phone),
    from: text(from),
    to: text(to),
    resultv2: '4',
    show: '0',
    order: 'desc'
  }
  Object.keys(paramObject).forEach(key => { if (!paramObject[key]) delete paramObject[key] })
  const param = JSON.stringify(paramObject)
  const result = await postForm(config.queryUrl, {
    customer: config.customer,
    sign: md5(param + config.key + config.customer),
    param
  })
  if (text(result.status) !== '200') {
    return { configured: true, success: false, message: text(result.message) || '快递100查询失败', raw: result }
  }
  return { configured: true, success: true, cache: toCache(result, trackingNo, resolved, 'query'), raw: result }
}

function getResultCompany(result = {}) {
  const raw = result.raw || {}
  return resolveCompany(raw.com || raw.company || raw.companyCode || raw.comCode)
}

function isDefinitiveWaybillFailure(result = {}) {
  const raw = result.raw || {}
  const status = text(raw.status || raw.returnCode || raw.code)
  const message = text(result.message || raw.message || raw.reason)
  if (['201', '400'].includes(status)) return true
  return /(运单|单号).*(错误|无效|不存在|不匹配)|无此运单|查无|找不到.*(运单|单号)|暂无(物流|轨迹|查询结果)|物流公司.*(错误|不符|不存在)/i.test(message)
}

// 保存物流信息前的实时验单。只有服务商明确否定时才阻断；配置、鉴权、超时等
// 可用性故障返回 warning，避免第三方故障卡住仓库发货。
async function verifyWaybill({ company, trackingNo, phone = '' }) {
  const expectedCompany = resolveCompany(company)
  if (!expectedCompany) {
    return {
      configured: getConfig().queryConfigured,
      ok: false,
      verified: false,
      message: `快递100暂不支持或无法识别物流公司：${text(company) || '未填写'}`
    }
  }

  let result
  try {
    result = await query({ company: expectedCompany.code, trackingNo, phone })
  } catch (error) {
    return {
      configured: getConfig().queryConfigured,
      ok: true,
      verified: false,
      company: expectedCompany,
      warning: `快递100实时验单暂不可用：${text(error && error.message) || '请求失败'}`
    }
  }

  if (!result.configured) {
    return {
      configured: false,
      ok: true,
      verified: false,
      company: expectedCompany,
      warning: '快递100实时查询未配置，本次仅完成本地格式校验'
    }
  }

  const resultCompany = getResultCompany(result)
  if (resultCompany && resultCompany.code !== expectedCompany.code) {
    return {
      configured: true,
      ok: false,
      verified: false,
      company: expectedCompany,
      detectedCompany: resultCompany,
      message: `运单实际承运公司为${resultCompany.name}，与录入的${expectedCompany.name}不匹配`
    }
  }

  if (result.success) {
    const tracks = result.cache && Array.isArray(result.cache.tracks) ? result.cache.tracks : []
    if (!tracks.length) {
      return {
        configured: true,
        ok: false,
        verified: false,
        company: expectedCompany,
        message: '快递100未查询到该运单的物流轨迹，请核对单号和快递公司'
      }
    }
    return {
      configured: true,
      ok: true,
      verified: true,
      company: expectedCompany,
      cache: result.cache,
      message: ''
    }
  }

  if (isDefinitiveWaybillFailure(result)) {
    return {
      configured: true,
      ok: false,
      verified: false,
      company: expectedCompany,
      message: result.message || '快递100未查询到该运单，请核对单号和快递公司'
    }
  }

  return {
    configured: true,
    ok: true,
    verified: false,
    company: expectedCompany,
    warning: `快递100实时验单未完成：${result.message || '服务暂不可用'}`
  }
}

async function subscribe({ company, trackingNo, phone = '' }) {
  const config = getConfig()
  if (!config.subscribeConfigured) return { configured: false, success: false }
  const resolved = requireCompany(company)
  const parameters = {
    callbackurl: config.callbackUrl,
    salt: config.callbackSalt,
    resultv2: '4'
  }
  const normalizedPhone = normalizePhone(phone)
  if (normalizedPhone) parameters.phone = normalizedPhone
  const param = JSON.stringify({
    company: resolved.code,
    number: text(trackingNo),
    key: config.key,
    parameters
  })
  const result = await postForm(config.subscribeUrl, { schema: 'json', param })
  const code = text(result.returnCode)
  return {
    configured: true,
    success: Boolean(result.result) || code === '200' || code === '501',
    duplicate: code === '501',
    code,
    message: text(result.message),
    company: resolved
  }
}

function parseCallback(params = {}) {
  const config = getConfig()
  if (!config.callbackSalt) throw new Error('KUAIDI100_CALLBACK_SALT 未配置')
  const rawParam = text(params.param)
  const sign = text(params.sign).toUpperCase()
  if (!rawParam || !sign || md5(rawParam + config.callbackSalt) !== sign) throw new Error('快递100回调验签失败')
  const payload = JSON.parse(rawParam)
  const result = payload.lastResult || {}
  const resolved = resolveCompany(result.com || payload.comNew || payload.comOld)
  if (!resolved) throw new Error('快递100回调包含未知物流公司')
  const trackingNo = text(result.nu || result.num)
  if (!trackingNo) throw new Error('快递100回调缺少运单号')
  return {
    trackingNo,
    company: resolved,
    monitorStatus: text(payload.status),
    message: text(payload.message),
    cache: {
      ...toCache(result, trackingNo, resolved, 'push'),
      monitorStatus: text(payload.status),
      message: text(payload.message || result.message)
    }
  }
}

function isFresh(cache, trackingNo) {
  if (!cache || cache.trackingNo !== text(trackingNo)) return false
  if (cache.source === 'push') return true
  return Boolean(cache.fetchedAt && Date.now() - Number(cache.fetchedAt) < CACHE_TTL)
}

module.exports = {
  CACHE_TTL,
  COMPANY_ALIASES,
  getConfig,
  isFresh,
  normalizeTracks,
  parseCallback,
  query,
  resolveCompany,
  stateLabel,
  stateTone,
  subscribe,
  verifyWaybill
}
