import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { getQuotePublishPresentation, resolveZeroPriceWarrantyAction } from '../src/utils/warrantyQuote.js'

const projectRoot = process.cwd()
const repoRoot = path.resolve(projectRoot, '..')

const readRepo = (...segments) => fs.readFileSync(path.join(repoRoot, ...segments), 'utf8')

const adminOrder = readRepo('docte-master', 'uniCloud-alipay', 'cloudfunctions', 'cicada-admin-order', 'index.obj.js')
const clientOrder = readRepo('docte-master', 'uniCloud-alipay', 'cloudfunctions', 'cicada-client-order', 'index.obj.js')
const miniProgram = readRepo('docte-master', 'pages', 'index', 'index.vue')
const statusMeta = readRepo('docte-master', 'pages', 'index', 'composables', 'statusMeta.js')
const workflow = readRepo('docte-master', 'uniCloud-alipay', 'cloudfunctions', 'common', 'cicada-order-workflow', 'index.js')
const warrantyPolicy = readRepo('docte-master', 'uniCloud-alipay', 'cloudfunctions', 'common', 'cicada-warranty-policy', 'index.js')
const adminView = fs.readFileSync(path.join(projectRoot, 'src', 'views', 'WorkOrder.vue'), 'utf8')

assert.equal(
  resolveZeroPriceWarrantyAction({
    order: { chargeType: 'pending', inWarranty: false, warrantyStatus: 'unknown' },
    items: [{ _id: 'item-1', coverage_result: 'free', coverage_reason: 'quality_issue' }]
  }),
  'save',
  'a zero-price quote should save valid local warranty decisions before publishing'
)
assert.equal(
  resolveZeroPriceWarrantyAction({
    order: { chargeType: 'pending', inWarranty: true, warrantyStatus: 'in_warranty' },
    items: [{ _id: 'item-1', coverage_result: 'free', coverage_reason: 'human_damage' }]
  }),
  'block',
  'an invalid free reason must not be auto-saved as warranty-free'
)
assert.equal(
  resolveZeroPriceWarrantyAction({
    order: { charge_type: 'free', in_warranty: true, warranty_status: 'in_warranty' },
    items: []
  }),
  'publish',
  'a confirmed backend warranty snapshot can publish without another save'
)

assert.equal(getQuotePublishPresentation('pending').buttonLabel, '发布报价给客户')
assert.equal(getQuotePublishPresentation('issued').buttonLabel, '更新并重新发布')
assert.equal(getQuotePublishPresentation('rejected').buttonLabel, '重新发布报价')

const requirements = [
  ['admin only allows zero amount when every item is explicitly warranty-free', adminOrder, /warranty_free_confirmed\s*===\s*true[\s\S]*零元质保方案要求所有设备均人工判断在保，且本次结论为质保免费/],
  ['admin stores item-level coverage result', adminOrder, /coverage_result/],
  ['admin view requires explicit warranty-free item decision', adminView, /将每台设备标记为“质保免费”/],
  ['admin marks warranty-free payment as not required', adminOrder, /payment_status\s*=\s*isWarrantyFree\s*\?\s*'not_required'/],
  ['paid quotes do not inherit warranty not-required status', adminOrder, /order\.payment_status\s*===\s*'paid'\s*\?\s*'paid'\s*:\s*'pending'/],
  ['shipping explicitly allows charge_type free', adminOrder, /paymentStatus\s*!==\s*'not_required'\s*\|\|\s*chargeType\s*!==\s*'free'/],
  ['client rejects unverified zero-amount confirmation', clientOrder, /该零元方案未通过在保校验/],
  ['client records warranty authorization', clientOrder, /客户已确认零元质保方案，无需付款/],
  ['mini program exposes warranty confirmation action', miniProgram, /确认质保维修/],
  ['confirmed warranty orders expose no billing action', miniProgram, /if \(isWarrantyFreeOrder\(order\)\) return \{ visible: false/],
  ['mini program declares payment unnecessary', miniProgram, /无需微信支付或上传付款凭证/],
  ['mini program skips payment status for warranty-free orders', statusMeta, /\['paid', 'not_required'\]\.includes\(payment\)/],
  ['mini program advances past payment progress', statusMeta, /\['paid', 'not_required'\]\.includes\(order\.paymentStatus\)/],
  ['admin persists item decisions before every issued quote', adminView, /status\s*===\s*'issued'[\s\S]*saveOrderItemsInfo\(\{ showSuccess: false, refreshOrders: false \}\)/],
  ['warranty evidence changes require quote permission', adminOrder, /changesWarrantyEvidence[\s\S]*assertRolePermission\(currentAdmin, 'issue_quote'\)/],
  ['unified product warranty defaults to 12 months', warrantyPolicy, /DEFAULT_PRODUCT_WARRANTY_MONTHS\s*=\s*12/],
  ['missing invoice falls back to factory date plus 30 days', warrantyPolicy, /addDaysToDateStr\(manufactureDate, 30\)/],
  ['client supplied purchase date is not trusted for automatic coverage', clientOrder, /const source = device \|\| \{\}/],
  ['repair start requires quote and customer authorization', workflow, /维修前必须先确认维修方案[\s\S]*维修前必须取得客户授权/],
  ['paid replacement parts receive a scoped repair extension', warrantyPolicy, /same_fault_same_replaced_part/],
  ['scoped repair warranty requires a manual fault-and-part match', warrantyPolicy, /scope === 'same_fault_same_replaced_part' && source\.repair_warranty_match !== true/],
  ['free repair requires an allowed policy reason', adminOrder, /coverageResult\s*===\s*'free'\s*&&\s*warrantyPolicy\.isFreeCoverageReason\(coverageReason\)/],
  ['repair warranty duration is fixed to three months', warrantyPolicy, /const months = DEFAULT_REPAIR_PART_WARRANTY_MONTHS/],
  ['mini program states the correct one-way warranty freight policy', miniProgram, /客户承担寄入厂家运费，厂家承担维修完成后的单程回寄运费/],
  ['admin exposes all policy exclusion categories', adminView, /improper_disinfection[\s\S]*voltage_damage[\s\S]*unauthorized_repair[\s\S]*label_or_sn_damage[\s\S]*force_majeure_or_uninsured_transport/]
]

let failed = false
for (const [label, source, pattern] of requirements) {
  if (!pattern.test(source)) {
    console.error(`[fail] ${label}`)
    failed = true
  }
}

if (failed) {
  process.exitCode = 1
} else {
  console.log('[ok] warranty-free flow checks passed')
}
