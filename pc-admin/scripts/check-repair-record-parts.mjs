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

assert.match(workOrder, /addRepairProduct/, 'repair record must support adding products')
assert.match(workOrder, /removeRepairProduct/, 'repair record must support removing products')
assert.match(workOrder, /product\.source === 'manual'/, 'only manually added repair products may be removed')
assert.match(workOrder, /openPartPicker\('repair',\s*productIndex\)/, 'inventory picker must target the selected repair product')
assert.match(workOrder, /canPerformOrderAction\('view_inventory'\)[\s\S]*?openPartPicker\('repair',\s*productIndex\)/, 'inventory picker must use the backend inventory view permission')
assert.match(workOrder, /addManualRepairPart\(productIndex\)/, 'manual repair parts must target the selected product')
assert.match(workOrder, /selectRepairPart[\s\S]*productIndex[\s\S]*partId[\s\S]*partCode[\s\S]*name[\s\S]*model[\s\S]*quantity/, 'inventory selection must map the product repair part fields')
assert.match(workOrder, /products:\s*repairRecordForm\.products\.map[\s\S]*parts:\s*product\.parts[\s\S]*part_id[\s\S]*part_code[\s\S]*name[\s\S]*model[\s\S]*quantity/, 'repair record must submit every product part field')
assert.match(workOrder, /productPartKeys[\s\S]*savedParts\.forEach[\s\S]*repairRecordForm\.products\[0\]\.parts\.push/, 'legacy top-level parts must be merged into the first product')
assert.match(workOrder, /aggregateRepairParts[\s\S]*aggregated\.get\(key\)\.quantity \+= quantity/, 'compatibility parts must be deduplicated with quantities aggregated')
assert.match(workOrder, /createRepairProduct\(\{ \.\.\.item, \.\.\.existing, key, source: 'order' \}/, 'saved repair product values must override order defaults')
assert.doesNotMatch(workOrder, /repairRecordForm\.parts/, 'obsolete global repair part form state must not remain')
assert.doesNotMatch(workOrder, /usedParts\.slice\(0,\s*30\)/, 'compatibility parts must not be silently truncated')
assert.match(saveRepairRecord, /rawParts\.length > 1500/, 'backend must accept the bounded multi-product compatibility aggregate')
assert.match(saveRepairRecord, /repair_record:\s*repairRecord/, 'backend must persist the repair snapshot')
assert.doesNotMatch(saveRepairRecord, /useOrderParts|inventory_status|stock\s*:/, 'saving a repair record must not deduct inventory')

console.log('[ok] repair record part entry checks passed')
