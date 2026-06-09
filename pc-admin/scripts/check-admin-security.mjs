import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const repoRoot = path.resolve(projectRoot, '..')

const adminSysPath = path.join(repoRoot, 'docte-master', 'uniCloud-alipay', 'cloudfunctions', 'cicada-admin-sys', 'index.obj.js')
const requestPath = path.join(projectRoot, 'src', 'utils', 'request.js')
const adminSessionPath = path.join(projectRoot, 'src', 'utils', 'adminSession.js')

const adminSysSource = fs.readFileSync(adminSysPath, 'utf8')
const requestSource = fs.readFileSync(requestPath, 'utf8')
const adminSessionSource = fs.readFileSync(adminSessionPath, 'utf8')
const sessionSource = `${requestSource}\n${adminSessionSource}`

const forbiddenLogPatterns = [
  /console\.log\([^)]*password/is,
  /console\.log\([^)]*密码/is,
  /console\.log\([^)]*token/is,
  /console\.log\([^)]*httpInfo/is,
  /console\.log\([^)]*解析后的参数/is,
  /console\.log\([^)]*数据库查询结果/is,
  /console\.log\([^)]*接收到的参数/is,
  /console\.log\([^)]*登录请求/is
]

let failed = false

for (const pattern of forbiddenLogPatterns) {
  if (pattern.test(adminSysSource)) {
    console.error(`[fail] cicada-admin-sys contains sensitive debug logging: ${pattern}`)
    failed = true
  }
}

if (!requestSource.includes("localStorage.getItem('adminToken')") && !requestSource.includes('localStorage.getItem("adminToken")')) {
  console.error('[fail] request interceptor does not read adminToken from localStorage')
  failed = true
}

if (!/Authorization\s*=\s*`Bearer \$\{[^}]+}/.test(requestSource)) {
  console.error('[fail] request interceptor does not attach Authorization Bearer token')
  failed = true
}

const requestSessionRequirements = [
  ['handleSessionExpired', /handleSessionExpired/],
  ['remove adminToken', /localStorage\.removeItem\(['"]adminToken['"]\)/],
  ['remove adminUser', /localStorage\.removeItem\(['"]adminUser['"]\)/],
  ['redirect to login', /window\.location\.(?:href|assign|replace)\s*(?:=|\()/],
  ['401 detection', /status\s*={2,3}\s*401|statusCode\s*={2,3}\s*401|code\s*={2,3}\s*401/],
  ['token expiry detection', /Token.*过期|token.*expired|鉴权失败|Unauthorized/is]
]

for (const [label, pattern] of requestSessionRequirements) {
  if (!pattern.test(sessionSource)) {
    console.error(`[fail] request session expiry handling missing: ${label}`)
    failed = true
  }
}

const adminLoginRateLimitRequirements = [
  ['rate limit config', /ADMIN_LOGIN_RATE_LIMIT/],
  ['login failure recorder', /recordAdminLoginFailure/],
  ['login failure clearer', /clearAdminLoginFailures/],
  ['rate limits collection', /cicada_rate_limits/],
  ['username identity', /admin-login:username/],
  ['ip identity', /admin-login:ip/],
  ['last login ip audit', /last_login_ip/],
  ['failed count audit', /failed_login_count/]
]

for (const [label, pattern] of adminLoginRateLimitRequirements) {
  if (!pattern.test(adminSysSource)) {
    console.error(`[fail] admin login rate limiting missing: ${label}`)
    failed = true
  }
}

if (!failed) {
  console.log('[ok] admin security checks passed')
} else {
  process.exitCode = 1
}
