import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { preserveReceivedOrderSnapshot } from '../src/utils/orderListSnapshot.js'

const root = resolve(import.meta.dirname, '..')
const workOrderSource = readFileSync(resolve(root, 'src/views/WorkOrder.vue'), 'utf8')
const mockSource = readFileSync(resolve(root, 'scripts/local-mock-server.mjs'), 'utf8')

const receivedSnapshot = {
  _id: 'order001',
  status: '已签收',
  statusEn: 'received',
  receivedPartsReceipt: { status: 'confirmed', confirmedByName: 'System Admin' }
}

const staleRows = [{ _id: 'order001', status: '运输中', statusEn: 'sent', customerName: '陈医生' }]
const protectedRows = preserveReceivedOrderSnapshot(staleRows, receivedSnapshot)
assert.equal(protectedRows[0].statusEn, 'received')
assert.equal(protectedRows[0].status, '已签收')
assert.equal(protectedRows[0].customerName, '陈医生')
assert.notEqual(protectedRows, staleRows)

const laterRows = [{ _id: 'order001', status: '处理中', statusEn: 'fixing' }]
assert.equal(preserveReceivedOrderSnapshot(laterRows, receivedSnapshot), laterRows)

const absentRows = [{ _id: 'order002', status: '运输中', statusEn: 'sent' }]
assert.equal(preserveReceivedOrderSnapshot(absentRows, receivedSnapshot), absentRows)
assert.equal(absentRows.length, 1)

const unsyncedSnapshot = { ...receivedSnapshot, status: '运输中', statusEn: 'sent' }
assert.equal(preserveReceivedOrderSnapshot(staleRows, unsyncedSnapshot), staleRows)

assert.match(workOrderSource, /const loadOrders = async \(\{ receiptSnapshot = null, orderSnapshot = null \} = \{\}\) =>/)
assert.match(workOrderSource, /const receiptSafeRows = preserveReceivedOrderSnapshot\(result\.rows, receiptSnapshot\)/)
assert.match(workOrderSource, /orders\.value = preserveOrderSnapshot\(receiptSafeRows, orderSnapshot\)/)
assert.match(workOrderSource, /if \(receiptSnapshot\) throw error/)
assert.match(workOrderSource, /preserveReceiptSnapshot: statusSynced/)
assert.match(mockSource, /staleReceiptListSnapshot/)
assert.match(mockSource, /status: 'sent',\s+arrival_confirm_status: 'pending'/)
assert.match(mockSource, /staleReceiptListSnapshot = JSON\.parse\(JSON\.stringify\(order\)\)/)
assert.match(mockSource, /list\[staleIndex\] = staleReceiptListSnapshot\s+staleReceiptListSnapshot = null/)

console.log('Receipt list live-refresh checks passed.')
