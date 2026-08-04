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

// uniCloud（支付宝云）服务空间客户端凭据是小程序端 uniCloud SDK 正常调用云函数所
// 必需的运行时配置：HBuilderX 关联服务空间后会写入 unicloud.spaces.local.json 并
// 随发行包一起编译进客户端，凭据形如
//   {"provider":"alipay","spaceId":"env-xxx","accessKey":"...","secretKey":"..."}
// 这类凭据只能发起匿名/公网云函数调用（云函数内部仍做鉴权），并不等同于服务端密钥
// （WX_SECRET、支付私钥、OSS 密钥等），因此属于允许随包分发的“客户端凭据”。
// 只有出现在 uniCloud 空间配置之外的 accessKey/secretKey 组合才判定为泄露。
function isUniCloudSpaceCredential(content, matchStart) {
  const before = content.slice(Math.max(0, matchStart - 400), matchStart)
  return /"(?:spaceId|id)"\s*:\s*"env-[^"]*"/.test(before)
}

function containsClientSecret(content) {
  const cloudSpaceConfigs = content.matchAll(/"accessKey"\s*:\s*"([^"]*)"[\s\S]{0,200}?"secretKey"\s*:\s*"([^"]*)"/g)
  for (const match of cloudSpaceConfigs) {
    if (isPlaceholder(match[1]) && isPlaceholder(match[2])) continue
    if (isUniCloudSpaceCredential(content, match.index)) continue
    return true
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
