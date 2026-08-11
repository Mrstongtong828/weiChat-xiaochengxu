import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pageSource = await readFile(new URL('./index.vue', import.meta.url), 'utf8')
const repairApiSource = await readFile(new URL('../../api/repair.js', import.meta.url), 'utf8')

test('支付确认框明确区分取消与继续支付', () => {
  assert.match(pageSource, /confirmText:\s*['"]继续支付['"]/)
  assert.match(pageSource, /cancelText:\s*['"]确认取消['"]/)
})

test('创建预支付单前获取当前微信 code 并传到云端', () => {
  assert.match(pageSource, /const payerCode = await requestWechatLoginCode\(\)/)
  assert.match(pageSource, /createRepairWechatPay\(order\.recordId \|\| order\.id, payerCode\)/)
  assert.match(repairApiSource, /createRepairWechatPay = \(id, payerCode = ['"]['"]\)/)
  assert.match(repairApiSource, /payer_code:\s*payerCode/)
})
