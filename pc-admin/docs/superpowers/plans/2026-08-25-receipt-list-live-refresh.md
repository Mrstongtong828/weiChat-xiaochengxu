# Receipt List Live Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the PC admin order list on `received` immediately after a successful receipt confirmation, even when the first list read briefly returns the previous `sent` row.

**Architecture:** Add a small pure helper that preserves a server-confirmed `received` snapshot only when the matching list row is still `pending` or `sent`. `WorkOrder.vue` opts into this helper only from the received-parts confirmation flow; all other list refresh callers keep the current behavior. The local mock deliberately serves one stale post-write list response so the browser acceptance flow proves the fix.

**Tech Stack:** Vue 3 Composition API, Element Plus, Node.js ESM assertions, Vite, Playwright CLI

## Global Constraints

- Modify only `pc-admin/`.
- Do not modify mini-program frontend code, client cloud functions, admin cloud functions, shared business logic, database schema, indexes, or online data.
- Do not change existing API parameters, response fields, permissions, or order status transitions.
- Do not change refresh behavior for quotes, remarks, repair records, invoices, returns, or other order mutations.
- Preserve later server states (`inspecting`, `fixing`, `shipped`, `completed`, `cancelled`) instead of forcing `received`.
- Do not insert a protected snapshot when the current list response excludes that order.
- Store acceptance screenshots under `pc-admin/output/playwright/`.

---

## File Structure

- Create `pc-admin/src/utils/orderListSnapshot.js`: pure receipt snapshot protection with no Vue or API dependency.
- Create `pc-admin/scripts/check-receipt-list-live-refresh.mjs`: behavioral assertions plus source-wiring checks.
- Modify `pc-admin/src/views/WorkOrder.vue`: opt-in list refresh parameter and receipt-only call site.
- Modify `pc-admin/scripts/local-mock-server.mjs`: serve one stale list row immediately after a successful inbound confirmation.
- Modify `pc-admin/package.json`: register `check:receipt-list-refresh`.
- Create `pc-admin/output/playwright/receipt-detail-confirmed.png`: accepted detail state.
- Create `pc-admin/output/playwright/receipt-list-updated.png`: accepted list state without browser refresh.

### Task 1: Add the failing receipt-list regression check

**Files:**
- Create: `pc-admin/scripts/check-receipt-list-live-refresh.mjs`
- Modify: `pc-admin/package.json`

**Interfaces:**
- Consumes: planned `preserveReceivedOrderSnapshot(orders, snapshot)` export.
- Produces: `npm run check:receipt-list-refresh` acceptance command.

- [ ] **Step 1: Write the failing check**

Create `pc-admin/scripts/check-receipt-list-live-refresh.mjs` with behavioral cases for stale, later, and absent rows plus source-wiring checks:

```js
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

assert.match(workOrderSource, /const loadOrders = async \(\{ receiptSnapshot = null \} = \{\}\) =>/)
assert.match(workOrderSource, /preserveReceivedOrderSnapshot\(transformOrders\(list\), receiptSnapshot\)/)
assert.match(workOrderSource, /preserveReceiptSnapshot: statusSynced/)
assert.match(mockSource, /staleReceiptListSnapshot/)

console.log('Receipt list live-refresh checks passed.')
```

- [ ] **Step 2: Register the command**

Add this script to `pc-admin/package.json`:

```json
"check:receipt-list-refresh": "node scripts/check-receipt-list-live-refresh.mjs"
```

- [ ] **Step 3: Run the check and verify it fails**

Run: `npm run check:receipt-list-refresh`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/utils/orderListSnapshot.js`.

### Task 2: Protect the confirmed receipt snapshot in the PC list

**Files:**
- Create: `pc-admin/src/utils/orderListSnapshot.js`
- Modify: `pc-admin/src/views/WorkOrder.vue`
- Test: `pc-admin/scripts/check-receipt-list-live-refresh.mjs`

**Interfaces:**
- Consumes: transformed list rows with `_id`, `status`, and `statusEn`; transformed confirmed snapshot with the same fields.
- Produces: `preserveReceivedOrderSnapshot(orders: Array, snapshot: object | null): Array`.

- [ ] **Step 1: Implement the pure snapshot helper**

Create `pc-admin/src/utils/orderListSnapshot.js`:

```js
const staleReceiptStatuses = new Set(['pending', 'sent'])

const getOrderStatus = (order = {}) => String(order.statusEn || order.status || '')

export const preserveReceivedOrderSnapshot = (orders = [], snapshot = null) => {
  if (!Array.isArray(orders) || !snapshot || !snapshot._id || getOrderStatus(snapshot) !== 'received') return orders

  const index = orders.findIndex(order => order && order._id === snapshot._id)
  if (index < 0 || !staleReceiptStatuses.has(getOrderStatus(orders[index]))) return orders

  const next = [...orders]
  next[index] = { ...orders[index], ...snapshot }
  return next
}
```

- [ ] **Step 2: Import the helper and make list protection opt-in**

In `pc-admin/src/views/WorkOrder.vue`, add:

```js
import { preserveReceivedOrderSnapshot } from '../utils/orderListSnapshot.js'
```

Change `loadOrders` to accept an optional snapshot and protect only the transformed response:

```js
const loadOrders = async ({ receiptSnapshot = null } = {}) => {
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const statusFilter = wo.filter ? toEnglishStatus(wo.filter) : undefined
    const data = await getOrderList(token, statusFilter, wo.page, wo.pageSize, {
      keyword: wo.search.trim(),
      deviceModel: wo.deviceFilter,
      invoiceStatus: searchInvoiceStatus.value,
      warrantyStatus: wo.warrantyFilter,
      customerType: resolveCustomerTypeValue(wo.customerTypeFilter),
      todoType: activeTodoType.value,
      slaLevel: slaFilter.value,
      responseMode: 'page'
    })
    const list = Array.isArray(data) ? data : (data.list || [])
    orders.value = preserveReceivedOrderSnapshot(transformOrders(list), receiptSnapshot)
    totalOrders.value = Array.isArray(data) ? orders.value.length : Number(data.total || 0)
    deviceModelOptions.value = Array.isArray(data.deviceModels) ? data.deviceModels : deviceModelOptions.value
    selectedOrders.value = []
  } catch (error) {
    orders.value = []
    totalOrders.value = 0
    ElMessage.error(error.message || '工单列表加载失败')
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 3: Pass the snapshot through the shared refresh with a default-off option**

Change `refreshOrderAfterMutation` to:

```js
const refreshOrderAfterMutation = async (result, row, { preserveReceiptSnapshot = false } = {}) => {
  const merged = applyOrderSnapshot(result, row)
  await loadOrders({ receiptSnapshot: preserveReceiptSnapshot ? merged : null })
  const fresh = row && orders.value.find(item => item._id === row._id)
  if (fresh) {
    applyOrderSnapshot(fresh, row)
  } else if (merged && currentOrder.value && currentOrder.value._id === merged._id) {
    currentOrder.value = merged
    newStatus.value = merged.status
    resetReceivedPartsForm(merged)
  }
  await refreshStatusBreakdown()
  return merged
}
```

- [ ] **Step 4: Enable protection only after receipt status synchronization succeeds**

Change the receipt refresh call in `confirmCurrentReceivedParts` to:

```js
await refreshOrderAfterMutation(finalResult, confirmedOrder, {
  preserveReceiptSnapshot: statusSynced
})
```

Do not change any other `refreshOrderAfterMutation` call.

- [ ] **Step 5: Run the check before mock support**

Run: `npm run check:receipt-list-refresh`

Expected: FAIL at `assert.match(mockSource, /staleReceiptListSnapshot/)`, while helper behavior and page wiring assertions pass.

### Task 3: Simulate a stale first read and complete browser acceptance

**Files:**
- Modify: `pc-admin/scripts/local-mock-server.mjs`
- Test: `pc-admin/scripts/check-receipt-list-live-refresh.mjs`
- Create: `pc-admin/output/playwright/receipt-detail-confirmed.png`
- Create: `pc-admin/output/playwright/receipt-list-updated.png`

**Interfaces:**
- Consumes: existing local mock methods `confirmInboundArrival` and `getAdminOrderList`.
- Produces: one deterministic stale list response after a successful `received` write, followed by current responses.

- [ ] **Step 1: Make the acceptance fixture a transported order**

Change the target mock order from `pending` to `sent` while retaining `arrival_confirm_status: 'pending'`:

```js
const orders = [
  {
    _id: 'order001',
    order_no: 'WX20260609001',
    status: 'sent',
    arrival_confirm_status: 'pending',
```

- [ ] **Step 2: Store the pre-write row when inbound confirmation succeeds**

Near the mock server state, add:

```js
let staleReceiptListSnapshot = null
```

Before mutating the order in the `confirmInboundArrival` handler, capture the old row:

```js
staleReceiptListSnapshot = JSON.parse(JSON.stringify(order))
order.status = 'received'
```

- [ ] **Step 3: Serve the stale row once from the next unfiltered list request**

In `getAdminOrderList`, after `filterOrders(body)` and before pagination mapping, replace only the matching row and consume the snapshot:

```js
let list = filterOrders(body)
if (staleReceiptListSnapshot && !body.status) {
  const staleIndex = list.findIndex(order => order._id === staleReceiptListSnapshot._id)
  if (staleIndex >= 0) {
    list = [...list]
    list[staleIndex] = staleReceiptListSnapshot
    staleReceiptListSnapshot = null
  }
}
```

- [ ] **Step 4: Run focused and regression checks**

Run:

```powershell
npm run check:receipt-list-refresh
npm run check:receipt-status-sync
npm run check:errors
npm run check:security
npm run check:print
```

Expected: all five commands exit 0.

- [ ] **Step 5: Build the PC admin**

Run: `npm run build`

Expected: Vite production build succeeds and writes ignored output to `pc-admin/dist/`.

- [ ] **Step 6: Start the local mock and Vite server**

Run the existing mock server on `http://127.0.0.1:8787` and Vite on an available local port. Configure all PC admin API bases to the mock URL. Record the exact port and stop both processes after acceptance.

- [ ] **Step 7: Verify `npx` and run Playwright acceptance**

Run: `Get-Command npx`

Expected: an `npx` command path is returned.

Using the Playwright CLI wrapper, open the PC admin, authenticate with the local mock account, and execute:

1. Open the `sent` order's processing drawer.
2. Confirm received parts.
3. Assert the detail shows `已确认签收`, signer, time, and status `已签收`.
4. Capture `pc-admin/output/playwright/receipt-detail-confirmed.png`.
5. Close the drawer without reloading the page.
6. Assert the matching table row shows `已签收` even though the first list response contained `sent`.
7. Capture `pc-admin/output/playwright/receipt-list-updated.png`.

- [ ] **Step 8: Run final Git and security gates**

Run:

```powershell
git diff --check
git status --short
git diff --name-only
git diff --cached --name-only
```

Expected: only authorized `pc-admin/` paths; no mini-program, cloud function, shared logic, database, environment, credential, or temporary browser files.

- [ ] **Step 9: Commit and push**

Stage only the reviewed implementation, plan, tests, mock, and two requested screenshots. Commit with the `smart-git-commit` CONTEXT/CHANGE/WHY/IMPACT format, then push explicitly:

```powershell
git push --set-upstream origin codex/receipt-list-live-refresh
```

Expected: `Mrstongtong828/CICADA-` receives the branch; no deployment occurs.
