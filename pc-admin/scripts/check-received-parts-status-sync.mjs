import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(resolve(root, 'src/views/WorkOrder.vue'), 'utf8')
const transformSource = readFileSync(resolve(root, 'src/utils/orderTransform.js'), 'utf8')
const mockSource = readFileSync(resolve(root, 'scripts/local-mock-server.mjs'), 'utf8')
const apiSource = readFileSync(resolve(root, 'src/api/order.js'), 'utf8')
const requestSource = readFileSync(resolve(root, 'src/utils/request.js'), 'utf8')
const start = source.indexOf('const confirmCurrentReceivedParts = async () => {')
const end = source.indexOf('\nconst confirmSaveRemark = async () => {', start)
const block = start >= 0 && end > start ? source.slice(start, end) : ''
const failures = []

const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

expect(block, 'missing confirmCurrentReceivedParts implementation')
expect(source.includes("const receiptStatusSyncSourceStatuses = new Set(['pending', 'sent'])"), 'missing pending/sent status guard')
expect(source.includes('const shouldSyncReceivedStatus = (order = {}) => receiptStatusSyncSourceStatuses.has(getOrderStatusValue(order))'), 'missing receipt status sync predicate')
expect(source.includes("const shouldConfirmInboundArrival = (order = {}) => order.arrivalConfirmStatus === 'pending'"), 'missing pending-arrival routing predicate')
expect(source.includes('confirmInboundArrival(token, order._id,'), 'missing dedicated inbound-arrival confirmation route')
expect(block.indexOf('confirmReceivedParts(') >= 0 && block.indexOf('confirmReceivedParts(') < block.indexOf('syncReceivedOrderStatus(token, confirmedOrder)'), 'order status must update after receipt confirmation')
expect(block.includes('if (shouldSyncReceivedStatus(confirmedOrder))'), 'missing no-regression status condition')
expect(block.includes('ElMessage.warning(`配件已确认签收，但工单状态同步失败：${statusSyncError.message || \'未知错误\'}`)'), 'missing partial-success warning')
expect(block.includes("ElMessage.success('收货配件已确认签收，工单状态已同步')"), 'missing synchronized success message')
expect(block.includes('await refreshOrderAfterMutation(finalResult, confirmedOrder)'), 'missing unified order refresh')
expect(source.includes('const hasOrderStatus = adminOrderStatusValues.has(data.statusEn) || adminOrderStatusValues.has(data.status)'), 'old receipt-only responses can be mistaken for order snapshots')
expect(transformSource.includes('arrivalConfirmStatus: order.arrival_confirm_status || order.arrivalConfirmStatus ||'), 'order transform drops arrival confirmation status')
expect(mockSource.includes("if (method === 'confirmInboundArrival' && order)"), 'local mock misses inbound-arrival confirmation')
expect(source.includes("{ suppressErrorMessage: true }"), 'status synchronization does not suppress duplicate interceptor errors')
expect(apiSource.includes('requestConfig = {}') && apiSource.includes('}, requestConfig)'), 'order API does not forward per-request error display config')
expect(requestSource.includes('const suppressErrorMessage = response.config && response.config.suppressErrorMessage === true'), 'business error interceptor cannot suppress duplicate messages')
expect(requestSource.includes('const suppressErrorMessage = error.config && error.config.suppressErrorMessage === true'), 'network error interceptor cannot suppress duplicate messages')

if (failures.length) {
  console.error('Received-parts status sync checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Received-parts status sync checks passed.')
