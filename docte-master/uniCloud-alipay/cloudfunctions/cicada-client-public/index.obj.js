const db = uniCloud.database()
const { SUBSCRIPTION_CONFIG_SCENES, getSubscriptionTemplateKey } = loadSubscriptionMessageModule()

function loadSubscriptionMessageModule() {
  try {
    return require('cicada-subscription-message')
  } catch (packageError) {
    return require('../common/cicada-subscription-message')
  }
}

const CACHE_TTL = 5 * 60 * 1000
const cacheStore = Object.create(null)

// 小程序公开可读的 settings key 白名单；禁止全表扫描，避免对公账户/打印模板等泄漏
const PUBLIC_SETTING_KEYS = new Set([
  'warranty_policy',
  'warranty_policy_sections',
  'warranty_policy_document',
  'fee_description',
  'fee_policy',
  'fee_policy_document',
  'home_guide_popup_enabled',
  'home_guide_popup_content',
  'contact_phone',
  'contact_email',
  'contact_address',
  'work_time',
  'company_name',
  'bank_transfer_company_name',
  'bank_transfer_tax_no',
  'bank_transfer_address_phone',
  'bank_transfer_bank_name',
  'bank_transfer_account_no',
  'bank_transfer_line_no',
  'customer_service_title',
  'customer_service_desc',
  'customer_service_wechat',
  'customer_service_qrcode',
  'wechat_name',
  'wechat_desc',
  'wechat_qrcode',
  'wechat_username',
  'privacy_policy',
  'account_cancellation_policy',
  'qualifications',
  'survey_config'
])

const SURVEY_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 5 }

function getCache(key) {
  const cache = cacheStore[key]
  if (!cache || Date.now() > cache.expireAt) return null
  return cache.data
}

function setCache(key, data, ttl = CACHE_TTL) {
  cacheStore[key] = {
    data,
    expireAt: Date.now() + ttl
  }
}

function getClientIdentity(ctx, fallback = 'anonymous') {
  const clientInfo = ctx && ctx.getClientInfo ? ctx.getClientInfo() : {}
  return clientInfo.clientIP || clientInfo.ip || clientInfo.userAgent || fallback
}

async function checkRateLimit(scope, identity, config) {
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
          reset_time: now + config.windowMs,
          create_time: now,
          update_time: now
        })
        return
      } catch (error) {
        if (attempt === 2) throw error
        continue
      }
    }

    if (now > Number(record.reset_time || 0)) {
      const reset = await col.where({
        _id: record._id,
        reset_time: db.command.lt(now)
      }).update({
        count: 1,
        reset_time: now + config.windowMs,
        update_time: now
      })
      if (reset.updated) return
      continue
    }

    const increment = await col.where({
      _id: record._id,
      reset_time: db.command.gte(now),
      count: db.command.lt(config.max)
    }).update({
      count: db.command.inc(1),
      update_time: now
    })
    if (increment.updated) return
    throw new Error('操作过于频繁，请稍后再试')
  }

  throw new Error('操作过于频繁，请稍后再试')
}

function isClientAudienceGuide(item = {}) {
  const audience = String(item.audience || 'client').trim().toLowerCase()
  return !audience || audience === 'client' || audience === 'public' || audience === 'all'
}

const GUIDE_CATEGORY_ALIASES = {
  quick: ['快速指南', '快速入门'],
  repair: ['报修指南', '报修流程'],
  query: ['查询指南', '查询办法', '维修查询', '物流寄送'],
  invoice: ['开票指南', '发票开具'],
  fault: ['自查指南', '故障自查']
}

const HOME_INTRO_VIDEO_CATEGORIES = ['首页介绍视频', '维修保养视频', '维护保养视频', '维修保养', '维护保养']

const DEFAULT_SURVEY_CONFIG = {
  enabled: true,
  title: '售后服务调研表',
  subtitle: '提交一次真实售后体验反馈，工作人员核对后为您登记调研福利。',
  giftText: '提交后由工作人员核对并登记福利',
  satisfactionOptions: ['满意', '一般', '不满意'],
  resolvedOptions: ['已解决', '处理中', '未解决'],
  ratingMax: 5,
  successTitle: '提交成功',
  successMessage: '感谢参与售后调研，工作人员会根据联系方式核对并登记福利。'
}

const REPAIR_PRODUCT_OPTIONS = [
  ['牙科光固化机', 'CV-215、CV-215-I、CV-215 GUN、G1、G2、G3、G4、G5、G6、G7、G8、One Sec、Sweet Cure', 'ykgghj'],
  ['牙科种植机', 'Surgic Pro+、Surgic Pro、Surgic Plus', 'ykzzj'],
  ['机用根管锉', 'DT-C3', 'jyggc'],
  ['气动洁牙机', 'CV-S、CV-P、CV-K', 'qdjyj'],
  ['牙科根管长度测定仪', 'DPEX-6', 'ykggcdcdy'],
  ['牙科弯手机', 'D45L、D15L、DW15L', 'ykwsj'],
  ['牙科种植手机', 'W201L、SG20、W20L、CX20', 'ykzzsj'],
  ['喷砂洁牙机', 'DT-X1、DT-X2、DT-X3、DT-X4、DT-X5', 'psjyj'],
  ['根管预备机', 'T-Fine-II(IS)、T-Fine-II(LED)、T-Fine-II(CC)', 'ggybj'],
  ['高速气涡轮手机', 'CV/GX602、CV/GX604、CV/GX612、CV/GX、CV/GX622、CV/GX624、CV/GX632、CV/GX634、CV/GX642、CV/GX644、CV/GX652、CV/GX654、GK01L、GK02L、GK03L、GK45L、GN02L、GN45L、GN01、G401、G402、G445、G406、G408、G409、G410、G201、G245、G206、G208、G209、G210', 'gsqwlssj'],
  ['网电源供电骨组织手术设备', 'DT-JZ1', 'wdygdgzzsssb'],
  ['牙科抛光手机', 'PMTC-I、PMTC-E', 'ykpgsj'],
  ['牙科低压电动马达', 'NL 400-1、NL 400-2、NL 400-3、NL 400-4、NL 400-5', 'ykdyddmd'],
  ['低速气动马达手机', 'CV/DX、CV/DX802、J05/D05M/D05Z、J03W/D05M/D05Z、J04/D05M/D05Z、D02W/D02M/D02Z、Z45L/D02M/D02Z、Z01/D02M/D02Z、D04W/D04M/D04Z、D01W/D01M/D01Z、D05W/D04M/D04Z、D04W/D04M/D03Z、J03Z', 'dsqdmdsj'],
  ['热熔牙胶充填系统', 'DT-Fill、DT-Fill Plus', 'rryjctxx'],
  ['牙科去冠器', 'EASY REMOVER 01', 'ykqgq'],
  ['超声洁牙机工作尖', 'CV-EN18、CV-EN22、CV-EN28', 'csjyjgzj'],
  ['医用放大镜', 'CV-288、CV-292', 'yyfdj'],
  ['牙科用刀', '15HD、25HD、40HD、60HD、90HD、OKS15、OKS25、OKS40、OKS60、OKS80', 'ykyd'],
  ['牙科用镊', '根管锉夹持器 DT-JCQ-I', 'ykyn'],
  ['一次性使用牙科冲洗针', 'S-27G-22、S-27G-26、S-30G-22、S-30G-26、PP-S-26G-26', 'ycxsykcxz'],
  ['口腔冲洗器', 'DT-CX1', 'kqcxq'],
  ['牙用充填器', 'D01、D02、D03', 'yyctq'],
  ['牙科种植用扳手', 'F型', 'ykzzybs'],
  ['牙科医师椅', 'B型、M型、S型', 'ykysy'],
  ['牙胶尖切断器', 'CV-Fill-P1', 'yjjqdq'],
  ['一次性使用护牙弯角', 'DT-HY01、DT-HY02', 'ycxsyhywj'],
  ['气动洁牙机工作尖', 'SJ1、SJ2、SJ3、SG1、SG2、SQ1、SQ2、SQ3、SW1、SW2、SW3、SY1、SZ1', 'qdjyjgzj']
].map(([label, model, initials], index) => ({
  id: `repair-product-${String(index + 1).padStart(2, '0')}`,
  value: `repair-product-${String(index + 1).padStart(2, '0')}`,
  name: label,
  product_name: label,
  label,
  model,
  initials,
  searchKeywords: [label, model, initials].join(' ').toLowerCase()
}))

function safeText(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function normalizeSettingKeys(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []

  const text = value.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
  } catch (error) {
    // URL-based cloud-object calls may encode arrays as comma-separated text.
  }
  return text.split(',')
}

function parseSurveyConfig(value) {
  try {
    const parsed = value ? JSON.parse(value) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_SURVEY_CONFIG }
    const cleanOptions = (list, fallback) => {
      const items = Array.isArray(list)
        ? list.map(item => safeText(item, 20)).filter(Boolean)
        : []
      return items.length ? items.slice(0, 8) : fallback
    }
    return {
      ...DEFAULT_SURVEY_CONFIG,
      ...parsed,
      enabled: parsed.enabled !== false,
      title: safeText(parsed.title, 40) || DEFAULT_SURVEY_CONFIG.title,
      subtitle: safeText(parsed.subtitle, 120) || DEFAULT_SURVEY_CONFIG.subtitle,
      giftText: safeText(parsed.giftText, 80) || DEFAULT_SURVEY_CONFIG.giftText,
      satisfactionOptions: cleanOptions(parsed.satisfactionOptions, DEFAULT_SURVEY_CONFIG.satisfactionOptions),
      resolvedOptions: cleanOptions(parsed.resolvedOptions, DEFAULT_SURVEY_CONFIG.resolvedOptions),
      ratingMax: Math.min(10, Math.max(1, parseInt(parsed.ratingMax, 10) || DEFAULT_SURVEY_CONFIG.ratingMax)),
      successTitle: safeText(parsed.successTitle, 20) || DEFAULT_SURVEY_CONFIG.successTitle,
      successMessage: safeText(parsed.successMessage, 120) || DEFAULT_SURVEY_CONFIG.successMessage
    }
  } catch (e) {
    return { ...DEFAULT_SURVEY_CONFIG }
  }
}

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return String(value).trim()
  }
  return ''
}

function getSubscriptionTemplateId(scene = '') {
  const key = getSubscriptionTemplateKey(scene)
  return getEnvValue(`WX_SUBSCRIBE_TEMPLATE_${key}`, `WECHAT_SUBSCRIBE_TEMPLATE_${key}`)
}

function normalizeGuide(item = {}, type = '') {
  const category = item.category || '操作指南'
  const isHomeIntroVideo = HOME_INTRO_VIDEO_CATEGORIES.some(name => category.includes(name))
  const title = isHomeIntroVideo
    ? (item.desc || item.title || item.description || category)
    : (item.title || category)

  return {
    id: item._id,
    type: item.type || type,
    category,
    audience: item.audience || 'client',
    title,
    description: item.description || item.desc || '',
    summary: item.summary || item.description || item.desc || '',
    desc: item.desc || '',
    content: item.content || '',
    media: Array.isArray(item.media) ? item.media : [],
    paperTitle: category,
    sections: [{
      title: category,
      lines: [item.desc, item.file_name ? `当前文档：${item.file_name}` : ''].filter(Boolean)
    }],
    fileName: item.file_name || '',
    fileUrl: item.file_url || '',
    fileType: item.file_type || '',
    updateTime: item.update_time || ''
  }
}

module.exports = {
  async getSubscriptionConfig() {
    try {
      const templates = SUBSCRIPTION_CONFIG_SCENES
        .map(item => ({ ...item, templateId: getSubscriptionTemplateId(item.scene) }))
        .filter(item => item.templateId)
      return { code: 0, data: { templates } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getSurveyConfig() {
    try {
      const res = await db.collection('cicada_settings').where({ key: 'survey_config' }).limit(1).get()
      const item = res.data && res.data[0]
      return { code: 0, data: parseSurveyConfig(item && item.value) }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async submitSurvey(data = {}) {
    try {
      await checkRateLimit('survey', getClientIdentity(this), SURVEY_RATE_LIMIT)

      const configRes = await db.collection('cicada_settings').where({ key: 'survey_config' }).limit(1).get()
      const config = parseSurveyConfig(configRes.data && configRes.data[0] && configRes.data[0].value)
      if (config.enabled === false) return { code: -1, msg: '调研表暂未启用' }

      const contact = safeText(data.contact, 80)
      const comment = safeText(data.comment, 500)
      if (!contact) return { code: -1, msg: '请填写联系方式' }
      if (!comment) return { code: -1, msg: '请填写调研反馈' }

      const rating = Math.min(config.ratingMax, Math.max(0, parseInt(data.rating, 10) || 0))
      if (!safeText(data.satisfaction, 30)) return { code: -1, msg: '请选择整体满意度' }
      if (!rating) return { code: -1, msg: '请选择服务评分' }
      if (!safeText(data.resolved, 30)) return { code: -1, msg: '请选择问题是否解决' }

      // 不信任客户端伪造的 user_id；有 token 时才绑定真实用户
      let userId = ''
      const token = safeText(data.token, 128)
      if (token) {
        try {
          const userRes = await db.collection('cicada_users').where({ token }).limit(1).get()
          const user = userRes.data && userRes.data[0]
          if (user && !user.disabled && user.token_expire && Date.now() <= user.token_expire) {
            userId = user._id || ''
          }
        } catch (authErr) {
          userId = ''
        }
      }

      const res = await db.collection('cicada_surveys').add({
        user_id: userId,
        order_no: safeText(data.orderNo || data.order_no, 80),
        satisfaction: safeText(data.satisfaction, 30),
        rating,
        resolved: safeText(data.resolved, 30),
        comment,
        contact,
        source: safeText(data.source, 30) || 'miniapp',
        status: 'new',
        create_time: Date.now(),
        update_time: Date.now()
      })
      return { code: 0, data: { id: res.id, successTitle: config.successTitle, successMessage: config.successMessage } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getCategories({ forceRefresh = false } = {}) {
    try {
      const cacheKey = 'categories:online'
      if (!forceRefresh) {
        const cached = getCache(cacheKey)
        if (cached) return { code: 0, data: cached, cache: true }
      }

      const res = await db.collection('cicada_product_categories')
        .where({ status: db.command.in(['上架', 'active']) })
        .orderBy('sort', 'asc')
        .get()
      setCache(cacheKey, res.data)
      return { code: 0, data: res.data }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getRepairProductOptions({ keyword = '' } = {}) {
    try {
      const normalizedKeyword = safeText(keyword, 60).toLowerCase()
      const list = normalizedKeyword
        ? REPAIR_PRODUCT_OPTIONS.filter(item => item.searchKeywords.includes(normalizedKeyword))
        : REPAIR_PRODUCT_OPTIONS
      return { code: 0, data: { list, total: list.length } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getFaultKb({ category_id, forceRefresh = false } = {}) {
    try {
      const cacheKey = `fault-kb:${category_id || 'all'}`
      if (!forceRefresh) {
        const cached = getCache(cacheKey)
        if (cached) return { code: 0, data: cached, cache: true }
      }

      const query = category_id
        ? db.collection('cicada_fault_kb').where({ category_id })
        : db.collection('cicada_fault_kb')
      const [faultRes, categoryRes] = await Promise.all([
        query.get(),
        db.collection('cicada_product_categories').get()
      ])
      const categoryMap = categoryRes.data.reduce((map, item) => {
        map[item._id] = item.category_name
        return map
      }, {})
      const list = faultRes.data
        .map(item => ({
          ...item,
          category_name: categoryMap[item.category_id] || ''
        }))
        .filter(item => item.category_name)
      setCache(cacheKey, list)
      return { code: 0, data: list }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getSettings(params = {}) {
    try {
      const source = params && params.keys != null
        ? params
        : (this && this.params) || {}
      const { keys } = source
      const requested = normalizeSettingKeys(keys)
        .map(key => String(key || '').trim())
        .filter(Boolean)
      if (!requested.length) {
        return { code: -1, msg: '请指定要读取的配置项' }
      }
      const allowedKeys = [...new Set(requested.filter(key => PUBLIC_SETTING_KEYS.has(key)))]
      if (!allowedKeys.length) {
        return { code: 0, data: {} }
      }

      const res = await db.collection('cicada_settings')
        .where({ key: db.command.in(allowedKeys) })
        .get()
      const settings = {}
      res.data.forEach(item => {
        if (PUBLIC_SETTING_KEYS.has(item.key)) {
          settings[item.key] = item.value
        }
      })
      return { code: 0, data: settings }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getGuides({ forceRefresh = false } = {}) {
    try {
      const cacheKey = 'guides:client'
      if (!forceRefresh) {
        const cached = getCache(cacheKey)
        if (cached) return { code: 0, data: cached, cache: true }
      }

      const res = await db.collection('cicada_guides').orderBy('sort', 'asc').get()
      // 工程师内部指南不暴露给小程序端
      const guides = res.data
        .filter(isClientAudienceGuide)
        .map(item => normalizeGuide(item))
      setCache(cacheKey, guides)
      return { code: 0, data: guides }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async getGuide({ type = '', forceRefresh = false } = {}) {
    try {
      const guideType = String(type || '').trim()
      const cacheKey = `guide:client:${guideType || 'default'}`
      if (!forceRefresh) {
        const cached = getCache(cacheKey)
        if (cached) return { code: 0, data: cached, cache: true }
      }

      const aliases = GUIDE_CATEGORY_ALIASES[guideType] || [guideType]
      const res = await db.collection('cicada_guides').orderBy('sort', 'asc').get()
      const matched = res.data.find(item =>
        isClientAudienceGuide(item) && (
          item.type === guideType ||
          aliases.some(alias => item.category && item.category.includes(alias))
        )
      )

      if (!matched) return { code: 0, data: null }

      const guide = normalizeGuide(matched, guideType)
      setCache(cacheKey, guide)
      return { code: 0, data: guide }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
