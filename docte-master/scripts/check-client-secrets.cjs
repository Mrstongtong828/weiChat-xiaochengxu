const fs = require('node:fs')
const path = require('node:path')

const targetDir = path.resolve(process.argv[2] || 'unpackage/dist/build/mp-weixin')
const textExtensions = new Set(['.js', '.json', '.wxml', '.wxss', '.html', '.txt'])

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(fullPath) : [fullPath]
  })
}

function isPlaceholder(value = '') {
  return !value || /^(?:<|your-|replace-|placeholder|changeme|请|填)/i.test(String(value).trim())
}

function containsClientSecret(content) {
  const cloudSpaceConfigs = content.matchAll(/"accessKey"\s*:\s*"([^"]*)"[\s\S]{0,200}?"secretKey"\s*:\s*"([^"]*)"/g)
  for (const match of cloudSpaceConfigs) {
    if (!isPlaceholder(match[1]) || !isPlaceholder(match[2])) return true
  }

  const environmentSecrets = content.matchAll(/(?:WX_SECRET|WECHAT_SECRET)\s*[=:]\s*["']?([^\s"',;]+)/g)
  for (const match of environmentSecrets) {
    if (!isPlaceholder(match[1])) return true
  }

  return /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content)
}

if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
  console.error(`[client-secret-check] Build output does not exist: ${targetDir}`)
  process.exit(1)
}

const findings = walk(targetDir)
  .filter(file => textExtensions.has(path.extname(file).toLowerCase()))
  .filter(file => containsClientSecret(fs.readFileSync(file, 'utf8')))
  .map(file => path.relative(targetDir, file))

if (findings.length) {
  console.error('[client-secret-check] Potential client-side credentials found:')
  findings.forEach(file => console.error(`- ${file}`))
  process.exit(1)
}

console.log(`[client-secret-check] Passed: ${targetDir}`)
