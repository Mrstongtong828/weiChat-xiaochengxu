import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const apiSource = readFileSync(new URL('../src/api/order.js', import.meta.url), 'utf8')
const viewSource = readFileSync(new URL('../src/views/WorkOrder.vue', import.meta.url), 'utf8')

const restoreApi = apiSource.match(/export const restoreCancelledOrder[\s\S]*?\n\}/)?.[0] || ''
assert.match(restoreApi, /updateOrderStatus/)
assert.match(restoreApi, /status:\s*'restore_cancelled'/)
assert.doesNotMatch(restoreApi, /\/restoreCancelledOrder/)
assert.match(viewSource, /if \(!isUserCancel\(error\) && !error\.__displayed\)/)

console.log('[ok] cancelled order restore uses the existing URL endpoint')
