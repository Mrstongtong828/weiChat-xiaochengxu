import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const checks = []

function addCheck(name, fn) {
  checks.push({ name, fn })
}

function includes(file, patterns) {
  const content = read(file)
  return patterns.every((pattern) => pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern))
}

addCheck('goal planning document exists', () => exists('AFTERSALES_QUOTE_GOAL.md'))
addCheck('admin quote backend stores structured quote and legacy fields', () => includes('docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js', [
  'quote_detail',
  'parts_total',
  'services_total',
  'others_total',
  'buildLegacyQuoteItemsFromDetail',
  'quote_items',
  'parts_fee',
  'labor_fee',
  'total_price'
]))
addCheck('admin quote UI has three fee sections and part picker', () => includes('pc-admin/src/views/WorkOrder.vue', [
  '配件费用',
  '服务费用',
  '其他费用',
  '最终报价',
  'partPickerVisible',
  '选择库存配件',
  'maxlength="200"'
]))
addCheck('mini program exposes and renders structured quote detail', () => includes('docte-master/pages/index/index.vue', [
  'detailQuoteGroups',
  'quote-group',
  'normalizeQuoteDetail'
]) && includes('docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js', [
  'quoteDetail',
  'quote_detail'
]))
addCheck('inventory backend and database artifacts exist', () => [
  'docte-master/uniCloud-alipay/database/cicada_parts.schema.json',
  'docte-master/uniCloud-alipay/database/cicada_inventory_flows.schema.json',
  'docte-master/uniCloud-alipay/database/cicada_parts.init_data.json'
].every(exists) && includes('docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js', [
  'async listParts',
  'async savePart',
  'async listInventoryFlows',
  'async useOrderParts',
  'outboundOrderInventory',
  'inventory_deducted'
]))
addCheck('inventory admin page and menu are wired', () => includes('pc-admin/src/router/index.js', [
  'InventoryManagement',
  "path: 'inventory'"
]) && includes('pc-admin/src/components/Layout/MainLayout.vue', [
  "canAccessMenu('inventory')",
  '配件库存管理'
]) && exists('pc-admin/src/views/InventoryManagement.vue') && exists('pc-admin/src/api/inventory.js'))
addCheck('settlement admin page and backend are wired', () => includes('docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js', [
  'async getSettlementList',
  'view_settlement'
]) && includes('pc-admin/src/router/index.js', [
  'SettlementManagement',
  "path: 'settlement'"
]) && exists('pc-admin/src/views/SettlementManagement.vue') && exists('pc-admin/src/api/settlement.js'))
addCheck('print and export include quote totals and remark', () => includes('pc-admin/src/utils/orderPrint.js', [
  '配件小计',
  '服务小计',
  '其他小计',
  '最终报价',
  '报价备注',
  '报价明细'
]) && includes('pc-admin/src/views/WorkOrder.vue', [
  'quotePartsTotal',
  'quoteServicesTotal',
  'quoteOthersTotal',
  'quoteFinalPrice',
  'quoteRemark',
  'quoteDetail'
]))
addCheck('database index checklist includes inventory collections', () => includes('docte-master/uniCloud-alipay/database/INDEXES.md', [
  '## cicada_parts',
  'part_code',
  '## cicada_inventory_flows',
  'part_id, create_time desc'
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
  console.error('Aftersales goal local readiness check failed.')
  process.exitCode = 1
}
