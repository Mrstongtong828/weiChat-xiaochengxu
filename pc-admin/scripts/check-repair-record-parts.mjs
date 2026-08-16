import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const workOrder = fs.readFileSync(path.join(projectRoot, 'src', 'views', 'WorkOrder.vue'), 'utf8')
const adminOrder = fs.readFileSync(path.join(projectRoot, '..', 'docte-master', 'uniCloud-alipay', 'cloudfunctions', 'cicada-admin-order', 'index.obj.js'), 'utf8')
const saveRepairRecord = adminOrder.slice(
  adminOrder.indexOf('async saveRepairRecord('),
  adminOrder.indexOf('async saveReceivedParts(')
)

assert.match(workOrder, /openPartPicker\('repair'\)/, 'repair record must support selecting an inventory part')
assert.match(workOrder, /addManualRepairPart/, 'repair record must support manually adding a part')
assert.match(workOrder, /selectRepairPart[\s\S]*partId[\s\S]*partCode[\s\S]*name[\s\S]*model[\s\S]*quantity/, 'inventory selection must map the repair part fields')
assert.match(workOrder, /parts:\s*usedParts\.map[\s\S]*part_id[\s\S]*part_code[\s\S]*name[\s\S]*model[\s\S]*quantity/, 'repair record must submit every editable part field')
assert.match(saveRepairRecord, /repair_record:\s*repairRecord/, 'backend must persist the repair snapshot')
assert.doesNotMatch(saveRepairRecord, /useOrderParts|inventory_status|stock\s*:/, 'saving a repair record must not deduct inventory')

console.log('[ok] repair record part entry checks passed')
