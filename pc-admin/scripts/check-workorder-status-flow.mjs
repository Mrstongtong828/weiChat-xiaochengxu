import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { toChineseStatus, toEnglishStatus } from '../src/utils/orderStatus.js'

const viewSource = readFileSync(new URL('../src/views/WorkOrder.vue', import.meta.url), 'utf8')
const backendSource = readFileSync(new URL('../../docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js', import.meta.url), 'utf8')

assert.equal(toChineseStatus('inspecting'), '检测中')
assert.equal(toEnglishStatus('检测中'), 'inspecting')
assert.match(viewSource, /workflowStatuses\.value\.map\(item => item\.label\)/)
assert.match(viewSource, /const transitions = \(workflowConfig\.value/)
assert.match(viewSource, /targetStatus === 'sent'.*!order\.logisticsNo/)
assert.doesNotMatch(viewSource, /adminActionStatusOptions/)
assert.match(viewSource, /v-for="status in getAllStatusOptions\(row\)"/)
assert.match(viewSource, /canChangeOrderStatus = computed/) 
assert.match(viewSource, /confirmationLines = \[/)
assert.match(backendSource, /next === 'sent' && currentStatus === 'pending'/)
assert.match(backendSource, /请先录入寄入物流单号，再标记为运输中/)
assert.match(backendSource, /desc: `当前进度：\$\{getOrderStatusLabel\(status\)\}`/)
assert.match(backendSource, /title: '工单已恢复'/)
assert.match(backendSource, /desc: `当前进度：\$\{restoredStatusLabel\}`/)

console.log('[ok] workorder status flow matches the customer-visible workflow')
