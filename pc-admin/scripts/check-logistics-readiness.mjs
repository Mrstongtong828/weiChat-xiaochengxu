import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return env
      const index = trimmed.indexOf('=')
      if (index <= 0) return env
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      env[key] = value
      return env
    }, {})
}

const fileEnv = {
  ...parseEnvFile(path.join(projectRoot, '.env')),
  ...parseEnvFile(path.join(projectRoot, '.env.local')),
  ...parseEnvFile(path.join(projectRoot, '.env.production')),
  ...parseEnvFile(path.join(projectRoot, '.env.production.local'))
}

const readEnv = (key) => process.env[key] || fileEnv[key] || ''
const normalizeBase = (base = '') => String(base || '').replace(/\/$/, '')

function resolveAdminOrderUrl() {
  const explicitUrl = normalizeBase(readEnv('VITE_ADMIN_ORDER_URL'))
  if (explicitUrl) return explicitUrl
  const cloudBase = normalizeBase(readEnv('VITE_UNICLOUD_BASE_URL'))
  if (cloudBase) return `${cloudBase}/cicada-admin-order`
  throw new Error('缺少 VITE_ADMIN_ORDER_URL 或 VITE_UNICLOUD_BASE_URL，无法检查目标云空间')
}

async function postJson(url, body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const text = await response.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {}
    return { status: response.status, text, json }
  } finally {
    clearTimeout(timeout)
  }
}

const token = readEnv('ADMIN_CHECK_TOKEN')
if (!token) {
  console.error('[fail] 缺少 ADMIN_CHECK_TOKEN。请临时注入正式管理员 token；不要使用 VITE_ 前缀，也不要提交到 Git。')
  process.exit(1)
}

const expectedMode = readEnv('LOGISTICS_EXPECT_MODE') || 'live'
if (!['live', 'query_only', 'fallback'].includes(expectedMode)) {
  console.error(`[fail] LOGISTICS_EXPECT_MODE 仅支持 live、query_only 或 fallback，当前为 ${expectedMode}`)
  process.exit(1)
}

let result
try {
  const url = `${resolveAdminOrderUrl()}/getLogisticsReadiness`
  result = await postJson(url, { token })
} catch (error) {
  console.error(`[fail] 物流配置自检请求失败：${error.message}`)
  process.exit(1)
}

const data = result.json && result.json.data
if (result.status !== 200 || !result.json || result.json.code !== 0 || !data) {
  const message = result.json && (result.json.msg || result.json.message)
  console.error(`[fail] 物流配置自检接口异常：HTTP ${result.status} ${message || '响应格式不正确'}`)
  process.exit(1)
}

const checks = [
  ['实时查询', data.queryConfigured],
  ['订阅推送', data.subscribeConfigured],
  ['回调验签', data.callbackConfigured]
]
for (const [name, configured] of checks) {
  console.log(`[${configured ? 'ok' : 'missing'}] ${name}：${configured ? '已配置' : '未完整配置'}`)
}
console.log(`[info] 服务商：${data.provider || 'unknown'}；当前模式：${data.mode || 'unknown'}；要求模式：${expectedMode}`)

if (Array.isArray(data.missing) && data.missing.length) {
  console.error(`[missing] 环境变量：${data.missing.join(', ')}`)
}

if (data.mode !== expectedMode || (expectedMode === 'live' && data.ready !== true)) {
  console.error('[fail] 目标云空间未达到要求的物流运行模式，请完成配置并重新部署相关云函数。')
  process.exit(1)
}

console.log('[ok] 物流配置达到发布要求；本检查未读取或输出任何第三方凭证。')
