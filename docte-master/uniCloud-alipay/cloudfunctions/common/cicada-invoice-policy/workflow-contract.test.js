const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('client invoice application persists the unified invoice contract', () => {
  const source = read('cicada-client-order/index.obj.js')
  const applyInvoice = source.slice(source.indexOf('async applyInvoice('), source.indexOf('async cancelOrder('))

  assert.match(applyInvoice, /invoice_type: INVOICE_TYPE/)
  assert.match(applyInvoice, /delivery_method: INVOICE_DELIVERY_METHOD/)
  assert.match(applyInvoice, /expected_delivery_days: INVOICE_EXPECTED_WORKING_DAYS/)
  assert.doesNotMatch(applyInvoice, /isPaperSpecial/)
  assert.doesNotMatch(applyInvoice, /expected_delivery_days:\s*isPaper/)
})

test('admin invoice updates reject postal data and use the unified service level', () => {
  const source = read('cicada-admin-order/index.obj.js')
  const updateInvoice = source.slice(source.indexOf('async updateInvoiceStatus('), source.indexOf('async updateOrderRemark('))

  assert.match(updateInvoice, /当前发票流程不登记邮寄物流/)
  assert.match(updateInvoice, /expected_delivery_days: INVOICE_EXPECTED_WORKING_DAYS/)
  assert.doesNotMatch(updateInvoice, /expected_delivery_days:\s*nextDeliveryMethod/)
})
