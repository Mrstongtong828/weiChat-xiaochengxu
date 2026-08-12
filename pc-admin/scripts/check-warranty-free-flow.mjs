import fs from 'node:fs'
import path from 'node:path'

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

const requirements = [
  ['admin only allows zero amount when every item is explicitly warranty-free', adminOrder, /仅所有设备均明确为质保免费的工单可以发布零元质保方案/],
  ['admin stores item-level coverage result', adminOrder, /coverage_result/],
  ['admin view requires explicit warranty-free item decision', adminView, /将每台设备标记为“质保免费”/],
  ['admin marks warranty-free payment as not required', adminOrder, /payment_status\s*=\s*isWarrantyFree\s*\?\s*'not_required'/],
  ['paid quotes do not inherit warranty not-required status', adminOrder, /order\.payment_status\s*===\s*'paid'\s*\?\s*'paid'\s*:\s*'pending'/],
  ['shipping explicitly allows charge_type free', adminOrder, /order\.charge_type\s*===\s*'free'/],
  ['client rejects unverified zero-amount confirmation', clientOrder, /该零元方案未通过在保校验/],
  ['client records warranty authorization', clientOrder, /客户已确认零元质保方案，无需付款/],
  ['mini program exposes warranty confirmation action', miniProgram, /确认质保维修/],
  ['confirmed warranty orders expose no billing action', miniProgram, /if \(isWarrantyFreeOrder\(order\)\) return \{ visible: false/],
  ['mini program declares payment unnecessary', miniProgram, /无需微信支付或上传付款凭证/],
  ['mini program skips payment status for warranty-free orders', statusMeta, /\['paid', 'not_required'\]\.includes\(payment\)/],
  ['mini program advances past payment progress', statusMeta, /\['paid', 'not_required'\]\.includes\(order\.paymentStatus\)/],
  ['admin permits zero amount only for warranty-free orders', adminView, /total\s*<=\s*0\s*&&\s*!isCurrentOrderWarrantyFree\.value/],
  ['warranty evidence changes require quote permission', adminOrder, /changesWarrantyEvidence[\s\S]*assertRolePermission\(currentAdmin, 'issue_quote'\)/],
  ['unified product warranty defaults to 12 months', warrantyPolicy, /DEFAULT_PRODUCT_WARRANTY_MONTHS\s*=\s*12/],
  ['missing invoice falls back to factory date plus 30 days', warrantyPolicy, /addDaysToDateStr\(manufactureDate, 30\)/],
  ['client supplied purchase date is not trusted for automatic coverage', clientOrder, /const source = device \|\| \{\}/],
  ['repair start requires quote and customer authorization', workflow, /维修前必须先确认维修方案[\s\S]*维修前必须取得客户授权/],
  ['paid replacement parts receive a scoped repair extension', warrantyPolicy, /same_fault_same_replaced_part/],
  ['scoped repair warranty requires a manual fault-and-part match', warrantyPolicy, /scope === 'same_fault_same_replaced_part' && source\.repair_warranty_match !== true/],
  ['free repair requires an allowed policy reason', adminOrder, /warrantyPolicy\.isFreeCoverageReason\(patch\.coverage_reason\)/],
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
