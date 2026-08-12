import assert from 'node:assert/strict'
import fs from 'node:fs'

const adminCloud = fs.readFileSync(
  new URL('../docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js', import.meta.url),
  'utf8'
)
const invoiceView = fs.readFileSync(
  new URL('../pc-admin/src/views/InvoiceManagement.vue', import.meta.url),
  'utf8'
)

assert.match(adminCloud, /title_type:\s*normalizeText\(inv\.title_type/)
assert.match(adminCloud, /remark:\s*normalizeText\(inv\.remark/)
assert.match(invoiceView, /row\.title_type/)
assert.match(invoiceView, /row\.remark/)

console.log('Invoice application field contract passed')
