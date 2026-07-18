import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const readJson = (file) => JSON.parse(read(file))

const checks = []

function addCheck(name, fn) {
  checks.push({ name, fn })
}

function fileExists(file) {
  return fs.existsSync(path.join(root, file))
}

function includes(file, patterns) {
  const content = read(file)
  return patterns.every((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(content)
    return content.includes(pattern)
  })
}

function cloudPackageMatches(functionName) {
  const pkg = readJson(`docte-master/uniCloud-alipay/cloudfunctions/${functionName}/package.json`)
  return pkg.name === functionName &&
    pkg['cloudfunction-config'] &&
    pkg['cloudfunction-config'].path === `/${functionName}`
}

addCheck('goal.md exists', () => fileExists('goal.md'))
addCheck('client applyInvoice API wired', () => includes('docte-master/api/content.js', [
  'export const applyInvoice',
  '.applyInvoice(withToken(data))',
  'unwrapCloudResult'
]))
addCheck('client order cloud function has invoice application', () => includes('docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js', [
  'async applyInvoice',
  'findOwnedOrder',
  'invoice_info',
  '待开票'
]))
addCheck('admin order list supports paged response and todo summary', () => includes('docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js', [
  'async getAdminOrderList',
  'responseMode',
  'fetchOrderBatches',
  'async getTodoSummary',
  'matchesTodoType'
]))
addCheck('subscription sending and logging are present', () => includes('docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js', [
  'sendOrderSubscription',
  'cicada_subscription_logs',
  'quote_issued',
  'payment_confirmed'
]))
addCheck('subscription public config exists', () => includes('docte-master/uniCloud-alipay/cloudfunctions/cicada-client-public/index.obj.js', [
  'async getSubscriptionConfig',
  'WX_SUBSCRIBE_TEMPLATE_',
  'WECHAT_SUBSCRIBE_TEMPLATE_'
]))
addCheck('goal cloud functions have deployment package metadata', () => [
  'cicada-client-public',
  'cicada-client-order',
  'cicada-admin-order'
].every(cloudPackageMatches))
addCheck('subscription log schema exists', () => fileExists('docte-master/uniCloud-alipay/database/cicada_subscription_logs.schema.json'))
addCheck('order schema includes sent status', () => includes('docte-master/uniCloud-alipay/database/cicada_orders.schema.json', ['"sent"']))
addCheck('pc admin order API supports filters and todo summary', () => includes('pc-admin/src/api/order.js', [
  'getOrderList',
  'invoiceStatus',
  'todoType',
  'getTodoSummary'
]))
addCheck('pc admin home shows todo summary', () => includes('pc-admin/src/views/Home.vue', [
  'getTodoSummary',
  'todoGroups',
  'navigateTodo'
]))
addCheck('pc admin workorder uses server pagination and export-all', () => includes('pc-admin/src/views/WorkOrder.vue', [
  'responseMode: \'page\'',
  'totalOrders',
  'fetchAllFilteredOrders',
  '已导出'
]))
addCheck('extracted utility files exist', () => [
  'docte-master/pages/index/composables/invoiceFlow.js',
  'pc-admin/src/utils/orderExport.js',
  'pc-admin/src/utils/orderPrint.js',
  'pc-admin/src/utils/errorMessage.js'
].every(fileExists))
addCheck('pc admin URL and error checks are wired', () => includes('pc-admin/package.json', [
  '"check:urls"',
  '"check:subscription"',
  '"check:errors"'
]))
addCheck('README documents manual goal acceptance', () => includes('docte-master/README.md', [
  'Goal 验收清单',
  'npm run check:urls',
  'cicada_subscription_logs'
]))

let failed = false

for (const check of checks) {
  let ok = false
  try {
    ok = Boolean(check.fn())
  } catch {}
  if (ok) {
    console.log(`[ok] ${check.name}`)
  } else {
    failed = true
    console.error(`[fail] ${check.name}`)
  }
}

if (failed) {
  console.error('Local goal structure check failed.')
  process.exitCode = 1
}
