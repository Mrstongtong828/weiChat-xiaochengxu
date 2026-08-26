# Work Order Progress Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the PC work-order progress and open tab consistent immediately after quote authorization and return-logistics confirmation.

**Architecture:** Keep the existing backend workflow untouched. Extract the frontend-only stage/tab decisions into a small pure module, and use an optimistic order snapshot for the existing batch return-shipment endpoint, which only returns a summary. Preserve that snapshot if the immediate list reload is stale.

**Tech Stack:** Vue 3 Composition API, Element Plus, Node.js built-in test runner.

## Global Constraints

- Modify only `pc-admin/`; do not modify mini-program code, cloud functions, shared workflow logic, database schema, or production data.
- Do not make the phone-confirm action transition the actual order status; it only records customer authorization through the existing admin endpoint.
- Do not commit or push unless explicitly requested.

---

### Task 1: Quote Authorization Presentation

**Files:**
- Create: `pc-admin/src/modules/workOrders/workflowPresentation.js`
- Create: `pc-admin/src/modules/workOrders/workflowPresentation.test.mjs`
- Modify: `pc-admin/src/views/WorkOrder.vue`

**Interfaces:**
- Produces: `getWorkflowStageIndex(order)` and `getRecommendedWorkflowTab(order, options)`.
- Consumes: normalized order fields `status`, `returnNo`, `quoteStatus`, `authorizationStatus`, `paymentStatus`, `chargeType`, `inWarranty`, and `warrantyStatus`.

- [ ] **Step 1: Write failing unit tests**

```js
assert.equal(getRecommendedWorkflowTab({ status: '已签收', quoteStatus: 'issued' }), 'quote')
assert.equal(getWorkflowStageIndex({ status: '已签收', quoteStatus: 'confirmed', authorizationStatus: 'confirmed' }), 3)
assert.equal(getWorkflowStageIndex({ status: '已签收', quoteStatus: 'issued', paymentStatus: 'not_required', chargeType: 'free', inWarranty: true, warrantyStatus: 'in_warranty' }), 3)
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test src/modules/workOrders/workflowPresentation.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure presentation rules and wire them into the drawer**

```js
export const isRepairReady = (order = {}) => (
  order.authorizationStatus === 'confirmed'
  || order.paymentStatus === 'paid'
  || (order.paymentStatus === 'not_required' && order.chargeType === 'free' && order.inWarranty === true)
)

export const getWorkflowStageIndex = (order = {}) => {
  if (order.status === '已完成' || order.status === '已回寄' || order.returnNo) return 4
  if (order.status === '处理中' || isRepairReady(order)) return 3
  if (['issued', 'confirmed', 'rejected'].includes(order.quoteStatus) || Number(order.totalPrice) > 0) return 2
  return ['已签收', '检测中'].includes(order.status) ? 1 : 0
}
```

Use the extracted function in `WorkOrder.vue` so an issued paid quote opens the quote tab for phone confirmation, and a confirmed authorization opens the repair tab with the repair stage highlighted.

- [ ] **Step 4: Run focused test**

Run: `node --test src/modules/workOrders/workflowPresentation.test.mjs`

Expected: PASS.

### Task 2: Immediate Return Shipment Snapshot

**Files:**
- Modify: `pc-admin/src/views/WorkOrder.vue`
- Modify: `pc-admin/src/utils/orderListSnapshot.js`
- Create: `pc-admin/src/utils/orderListSnapshot.test.mjs`

**Interfaces:**
- Produces: `preserveOrderSnapshot(orders, snapshot)` for a just-confirmed shipment.
- Consumes: a normalized order snapshot containing `_id`, `statusEn`, `status`, `returnCompany`, `returnNo`, `shippedAt`, `timeline`, `needsReturn`, and `archiveStatus`.

- [ ] **Step 1: Write failing unit tests**

```js
const optimistic = { _id: 'order-1', statusEn: 'shipped', status: '已回寄', returnNo: 'SF123' }
const staleRows = [{ _id: 'order-1', statusEn: 'fixing', status: '处理中' }]
assert.deepEqual(preserveOrderSnapshot(staleRows, optimistic), [optimistic])
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test src/utils/orderListSnapshot.test.mjs`

Expected: FAIL because the generalized snapshot helper does not exist.

- [ ] **Step 3: Apply the existing backend-compatible shipment shape before reload**

```js
const snapshot = {
  _id: order._id,
  statusEn: 'shipped',
  status: '已回寄',
  returnCompany,
  returnNo,
  shippedAt: Date.now(),
  timeline: [...order.timeline, { title: '回寄发货', desc: `${returnCompany} ${returnNo}`, time: Date.now(), done: true }]
}
applyOrderSnapshot(snapshot, order)
await loadOrders({ orderSnapshot: snapshot })
```

Extend `mergeOrderSnapshot` to retain return carrier, tracking number, shipment time, status, and timeline; use the generalized preservation helper only when a just-reloaded row is older than the optimistic snapshot.

- [ ] **Step 4: Run focused tests**

Run: `node --test src/utils/orderListSnapshot.test.mjs src/modules/workOrders/workflowPresentation.test.mjs`

Expected: PASS.

### Task 3: Verification

**Files:**
- Modify only files from Tasks 1-2 if verification identifies a defect.

- [ ] **Step 1: Run the PC-admin regression suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Build the PC admin**

Run: `npm run build`

Expected: Vite build and post-build output checks pass.

- [ ] **Step 3: Run directly related checks**

Run: `npm run check:receipt-status-sync` and `npm run check:receipt-list-refresh`

Expected: both checks pass.

- [ ] **Step 4: Inspect final scope**

Run: `git diff --name-only` and `git diff --cached --name-only`

Expected: only `pc-admin/` source, tests, and this plan document are changed; no staged files.

## Self-Review

Spec coverage: Task 1 covers post-publish tab selection and post-phone-confirm repair-stage presentation without changing business state. Task 2 covers immediate return-logistics display and stale list reload protection. Task 3 covers focused and full PC-admin validation.

Placeholder scan: no placeholders remain.

Type consistency: Task 1 uses normalized camelCase order fields. Task 2 uses normalized snapshot fields and merges them into the existing order row before calling the list reload.
