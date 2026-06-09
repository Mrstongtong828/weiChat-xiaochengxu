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
const defaultCloudBase = 'https://env-00jy6bcqqsjw.dev-hz.cloudbasefunction.cn'
const cloudBase = normalizeBase(readEnv('VITE_UNICLOUD_BASE_URL') || defaultCloudBase)
const resolveUrl = (envKey, functionName) => normalizeBase(readEnv(envKey) || `${cloudBase}/${functionName}`)

const adminOrderUrl = resolveUrl('VITE_ADMIN_ORDER_URL', 'cicada-admin-order')
const clientPublicUrl = normalizeBase(readEnv('VITE_CLIENT_PUBLIC_URL') || adminOrderUrl)
const invalidToken = `codex-healthcheck-${Date.now()}`

async function postJson(url, body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {}
    return { status: res.status, text, json }
  } finally {
    clearTimeout(timeout)
  }
}

function isExpectedAuthFailure(result) {
  const message = result.json && (result.json.msg || result.json.message)
  const rawText = result.text || ''
  return result.status >= 400 &&
    result.status < 600 &&
    (
      (typeof message === 'string' && message.includes('鉴权失败')) ||
      rawText.includes('鉴权失败')
    )
}

function getResultMessage(result) {
  const message = result.json && (result.json.msg || result.json.message)
  if (message) return message
  if ((result.text || '').includes('鉴权失败')) return '鉴权失败'
  return ''
}

const checks = [
  {
    name: 'getAdminOrderList invalid token',
    url: `${adminOrderUrl}/getAdminOrderList`,
    body: { token: invalidToken, page: 1, pageSize: 1, responseMode: 'page' }
  },
  {
    name: 'getTodoSummary invalid token',
    url: `${adminOrderUrl}/getTodoSummary`,
    body: { token: invalidToken },
    expect: isExpectedAuthFailure
  },
  {
    name: 'getSubscriptionConfig reachable',
    url: `${clientPublicUrl}/getSubscriptionConfig`,
    body: {},
    expect: (result) => {
      const data = result.json && result.json.data
      return result.status === 200 &&
        result.json &&
        result.json.code === 0 &&
        data &&
        Array.isArray(data.templates)
    }
  }
].map((check) => ({ expect: isExpectedAuthFailure, ...check }))

let failed = false

for (const check of checks) {
  try {
    const result = await postJson(check.url, check.body)
    if (check.expect(result)) {
      console.log(`[ok] ${check.name}: ${result.status} ${getResultMessage(result)}`)
    } else {
      failed = true
      const body = result.text ? result.text.slice(0, 300) : '<empty body>'
      console.error(`[fail] ${check.name}: ${result.status} ${body}`)
    }
  } catch (error) {
    failed = true
    console.error(`[fail] ${check.name}: ${error.message}`)
  }
}

if (failed) {
  console.error('Admin cloud function URL healthcheck failed. Check .env.local URLs and redeploy cloud functions.')
  process.exitCode = 1
}
