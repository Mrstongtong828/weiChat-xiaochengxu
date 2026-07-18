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
  ...parseEnvFile(path.join(projectRoot, '.env.local'))
}

const readEnv = (key) => process.env[key] || fileEnv[key] || ''
const normalizeBase = (base = '') => String(base || '').replace(/\/$/, '')
const cloudBase = normalizeBase(readEnv('VITE_UNICLOUD_BASE_URL'))
const resolveUrl = (envKey, functionName) => {
  const explicitUrl = normalizeBase(readEnv(envKey))
  if (explicitUrl) return explicitUrl
  if (cloudBase) return `${cloudBase}/${functionName}`
  throw new Error(`Missing ${envKey} or VITE_UNICLOUD_BASE_URL; refusing to use a default cloud environment.`)
}
const adminOrderUrl = resolveUrl('VITE_ADMIN_ORDER_URL', 'cicada-admin-order')
const configUrl = normalizeBase(readEnv('VITE_CLIENT_PUBLIC_URL')) || adminOrderUrl

const res = await fetch(`${configUrl}/getSubscriptionConfig`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}'
})
const text = await res.text()
let json = null
try {
  json = text ? JSON.parse(text) : null
} catch {}

const templates = json && json.data && Array.isArray(json.data.templates)
  ? json.data.templates
  : []
const missing = templates.filter(item => item.configured === false || !item.templateId && item.configured !== true)

if (res.status !== 200 || !json || json.code !== 0 || !templates.length) {
  console.error(`[fail] subscription config endpoint: ${res.status} ${text.slice(0, 300)}`)
  process.exit(1)
}

for (const item of templates) {
  const state = item.configured === false ? 'missing' : 'configured'
  console.log(`[${state === 'configured' ? 'ok' : 'fail'}] ${item.scene}: ${state}`)
}

if (missing.length) {
  console.error('Subscription template IDs are not fully configured in the target uniCloud environment.')
  process.exit(1)
}
