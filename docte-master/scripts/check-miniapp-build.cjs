const fs = require('node:fs')
const path = require('node:path')

const targetDir = path.resolve(process.argv[2] || 'unpackage/dist/build/mp-weixin')
const appEntry = path.join(targetDir, 'app.js')

if (!fs.existsSync(appEntry)) {
  console.error(`[miniapp-build-check] Missing application entry: ${appEntry}`)
  process.exit(1)
}

const source = fs.readFileSync(appEntry, 'utf8')
const localModules = Array.from(source.matchAll(/require\(["'](\.[^"']+)["']\)/g), match => {
  const modulePath = path.resolve(targetDir, match[1])
  return path.extname(modulePath) ? modulePath : `${modulePath}.js`
})
const startupSource = [appEntry, ...localModules]
  .filter(file => fs.existsSync(file))
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n')
const hasAppFactory = /function\s+createApp\s*\(|createApp\s*=/.test(startupSource)
const hasMount = /createApp\(\)\.app\.mount\(["']#app["']\)/.test(startupSource)
const hasAppExport = /exports\.createApp\s*=/.test(source)

if (!hasAppFactory || !hasMount || !hasAppExport) {
  console.error('[miniapp-build-check] Invalid app.js: application startup code was removed by the compiler')
  process.exit(1)
}

console.log(`[miniapp-build-check] Passed: ${appEntry}`)
