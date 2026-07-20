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

function resolveUrl(envKey, functionName) {
  const explicitUrl = normalizeBase(readEnv(envKey))
  if (explicitUrl) return explicitUrl

  const cloudBase = normalizeBase(readEnv('VITE_UNICLOUD_BASE_URL'))
  if (cloudBase) return `${cloudBase}/${functionName}`

  throw new Error(`Missing ${envKey} or VITE_UNICLOUD_BASE_URL.`)
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
    return { ok: response.ok, status: response.status, text, json }
  } finally {
    clearTimeout(timeout)
  }
}

function fail(message, detail = '') {
  console.error(`[fail] ${message}`)
  if (detail) console.error(detail)
  process.exitCode = 1
}

function fatal(message, detail = '') {
  fail(message, detail)
  process.exit(1)
}

function roleSummary(list) {
  return list.reduce((summary, user) => {
    const role = user && user.role ? user.role : '<missing>'
    summary[role] = (summary[role] || 0) + 1
    return summary
  }, {})
}

const adminSysUrl = resolveUrl('VITE_ADMIN_SYS_URL', 'cicada-admin-sys')
const username = readEnv('ADMIN_CHECK_USERNAME')
const password = readEnv('ADMIN_CHECK_PASSWORD')
let token = readEnv('ADMIN_CHECK_TOKEN')
let loginUser = null

console.log(`[info] adminSys URL: ${adminSysUrl}`)

if (!token && username && password) {
  const loginResult = await postJson(`${adminSysUrl}/adminLogin`, { username, password })
  if (!loginResult.json || loginResult.json.code !== 0) {
    fatal('adminLogin failed', loginResult.text)
  } else {
    token = loginResult.json.token || (loginResult.json.data && loginResult.json.data.token)
    loginUser = loginResult.json.user || (loginResult.json.data && loginResult.json.data.user)
    console.log(`[ok] login user: ${loginUser && loginUser.username || username}, role: ${loginUser && loginUser.role || '<unknown>'}`)
  }
}

if (!token) {
  fail(
    'missing admin credentials',
    'Set ADMIN_CHECK_USERNAME and ADMIN_CHECK_PASSWORD, or set ADMIN_CHECK_TOKEN, then run npm run check:staff.'
  )
} else {
  const staffResult = await postJson(`${adminSysUrl}/manageStaff`, { token, action: 'list' })
  if (!staffResult.json || staffResult.json.code !== 0) {
    fail('manageStaff list failed', staffResult.text)
  } else {
    const list = staffResult.json.data
    if (!Array.isArray(list)) {
      fail('manageStaff returned non-array data', JSON.stringify(staffResult.json).slice(0, 500))
    } else {
      console.log(`[ok] staff count: ${list.length}`)
      console.log(`[ok] role summary: ${JSON.stringify(roleSummary(list))}`)
      if (!list.length) {
        fail(
          'staff list is empty',
          'Local code queries cicada_users by backend roles only. If login succeeded here, check deployed cicada-admin-sys version and cicada_users.role values in this cloud space.'
        )
      }
    }
  }
}
