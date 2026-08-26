# 收货配件签收同步工单状态实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC 后台确认收货配件后，在不回退后续状态的前提下，通过现有后台接口把 `pending`/`sent` 工单同步推进为 `received`。

**Architecture:** `WorkOrder.vue` 继续编排现有 `confirmReceivedParts`、`confirmInboundArrival` 和 `updateOrderStatus` API。配件签收成功后先应用响应快照，仅对 `pending`/`sent` 发起主状态更新；物流已送达待入库的工单走专用入库接口，其余工单走通用状态接口。最后统一重新加载列表和状态统计，第二次调用失败按部分成功处理。一个 PC 专属 Node 检查脚本验证关键状态保护、调用顺序、接口路由、反馈文案和刷新行为。

**Tech Stack:** Vue 3 Composition API、Element Plus、Vite、Node.js ESM 检查脚本

## Global Constraints

- 仅允许修改 `pc-admin/`。
- 不修改或部署小程序前端、客户端云函数、后台云函数、共享业务逻辑、数据库结构或线上数据。
- 不改变现有 PC 后台 API 请求或响应格式。
- 不绕过后端权限、物流前置条件和订单状态机。
- 只有 `pending` 和 `sent` 可以由配件签收操作自动推进为 `received`；任何其他状态不得自动回退。
- 项目当前没有 `npm test` 脚本；必须如实记录该门禁缺失，并运行定向检查、现有 PC 检查和生产构建。

---

### Task 1: 增加失败的签收状态同步定向检查

**Files:**
- Create: `pc-admin/scripts/check-received-parts-status-sync.mjs`
- Modify: `pc-admin/package.json`

**Interfaces:**
- Consumes: `pc-admin/src/views/WorkOrder.vue` 源代码文本。
- Produces: `npm run check:receipt-status-sync`，成功时输出 `Received-parts status sync checks passed.`，任一约束缺失时以非零状态退出。

- [ ] **Step 1: 编写当前必然失败的检查脚本**

```js
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(resolve(root, 'src/views/WorkOrder.vue'), 'utf8')
const transformSource = readFileSync(resolve(root, 'src/utils/orderTransform.js'), 'utf8')
const mockSource = readFileSync(resolve(root, 'scripts/local-mock-server.mjs'), 'utf8')
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

if (failures.length) {
  console.error('Received-parts status sync checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Received-parts status sync checks passed.')
```

- [ ] **Step 2: 注册定向检查命令**

在 `pc-admin/package.json` 的 `scripts` 中加入：

```json
"check:receipt-status-sync": "node scripts/check-received-parts-status-sync.mjs"
```

- [ ] **Step 3: 运行检查并确认它因实现缺失而失败**

Run: `cd pc-admin && npm run check:receipt-status-sync`

Expected: FAIL，并至少报告 `missing pending/sent status guard`、`missing receipt status sync predicate` 和 `missing partial-success warning`。

### Task 2: 实现签收后主状态同步和部分成功反馈

**Files:**
- Modify: `pc-admin/src/views/WorkOrder.vue`
- Modify: `pc-admin/src/utils/orderTransform.js`
- Modify: `pc-admin/src/api/order.js`
- Modify: `pc-admin/src/utils/request.js`
- Modify: `pc-admin/scripts/local-mock-server.mjs`
- Test: `pc-admin/scripts/check-received-parts-status-sync.mjs`

**Interfaces:**
- Consumes: `getOrderStatusValue(order): string`、`confirmReceivedParts(token, orderId)`、`confirmInboundArrival(token, orderId)`、`updateOrderStatus(token, orderId, status)`、`applyOrderSnapshot(result, fallbackRow)`、`refreshOrderAfterMutation(result, row)`。
- Produces: `shouldSyncReceivedStatus(order): boolean`；新的 `confirmCurrentReceivedParts()` 保证只有 `pending`/`sent` 自动推进到 `received`。

- [ ] **Step 1: 集中定义合法订单状态与签收同步来源状态**

在 `adminStatusOptions` 附近增加：

```js
const adminOrderStatusValues = new Set(['pending', 'sent', 'received', 'inspecting', 'fixing', 'shipped', 'completed', 'cancelled'])
const receiptStatusSyncSourceStatuses = new Set(['pending', 'sent'])
```

在 `getOrderStatusValue` 后增加：

```js
const shouldSyncReceivedStatus = (order = {}) => receiptStatusSyncSourceStatuses.has(getOrderStatusValue(order))
const shouldConfirmInboundArrival = (order = {}) => order.arrivalConfirmStatus === 'pending'
const syncReceivedOrderStatus = (token, order = {}) => shouldConfirmInboundArrival(order)
  ? confirmInboundArrival(token, order._id, { suppressErrorMessage: true })
  : updateOrderStatus(token, order._id, 'received', { suppressErrorMessage: true })
```

- [ ] **Step 2: 防止旧版签收对象被误判为订单快照**

把 `getMutationOrder` 改为只接受带订单标识、合法订单状态或订单专属签收字段的对象：

```js
const getMutationOrder = (result) => {
  const data = result && result.order ? result.order : result
  if (!data || typeof data !== 'object') return null
  const hasOrderStatus = adminOrderStatusValues.has(data.statusEn) || adminOrderStatusValues.has(data.status)
  if (!(data._id || data.order_no || hasOrderStatus || data.received_parts_receipt || data.receivedPartsReceipt)) return null
  return data
}
```

并把 `mergeOrderSnapshot` 中内联的状态数组判断替换为：

```js
const statusEn = snapshot.statusEn || (adminOrderStatusValues.has(snapshot.status) ? snapshot.status : '')
```

- [ ] **Step 3: 编排配件签收与主状态更新**

把 `confirmCurrentReceivedParts` 的请求部分改为：

```js
receivedPartsConfirming.value = true
try {
  const token = localStorage.getItem('adminToken')
  const orderBeforeConfirm = currentOrder.value
  let receiptResult
  try {
    receiptResult = await confirmReceivedParts(token, orderBeforeConfirm._id)
  } catch (error) {
    ElMessage.error(error.message || '配件签收确认失败')
    return
  }

  const confirmedOrder = applyOrderSnapshot(receiptResult, orderBeforeConfirm) || orderBeforeConfirm
  let finalResult = receiptResult
  let statusSynced = false
  let statusSyncError = null

  if (shouldSyncReceivedStatus(confirmedOrder)) {
    try {
      finalResult = await syncReceivedOrderStatus(token, confirmedOrder)
      applyOrderSnapshot(finalResult, confirmedOrder)
      statusSynced = true
    } catch (error) {
      statusSyncError = error
    }
  }

  try {
    await refreshOrderAfterMutation(finalResult, confirmedOrder)
  } catch (error) {
    ElMessage.warning(`配件已确认签收，但后台数据刷新失败：${error.message || '未知错误'}`)
    return
  }

  if (statusSyncError) {
    ElMessage.warning(`配件已确认签收，但工单状态同步失败：${statusSyncError.message || '未知错误'}`)
  } else if (statusSynced) {
    ElMessage.success('收货配件已确认签收，工单状态已同步')
  } else {
    ElMessage.success('收货配件已确认签收')
  }
} finally {
  receivedPartsConfirming.value = false
}
```

- [ ] **Step 4: 运行定向检查并确认通过**

Run: `cd pc-admin && npm run check:receipt-status-sync`

Expected: PASS，输出 `Received-parts status sync checks passed.`。

- [ ] **Step 5: 检查变更只位于 PC 后台**

Run: `git diff --name-only`

Expected: 只出现：

```text
pc-admin/docs/superpowers/plans/2026-08-22-received-parts-order-status-sync.md
pc-admin/package.json
pc-admin/scripts/local-mock-server.mjs
pc-admin/scripts/check-received-parts-status-sync.mjs
pc-admin/src/api/order.js
pc-admin/src/utils/orderTransform.js
pc-admin/src/utils/request.js
pc-admin/src/views/WorkOrder.vue
```

### Task 3: 回归验证、构建和提交

**Files:**
- Verify: `pc-admin/package.json`
- Verify: `pc-admin/src/views/WorkOrder.vue`
- Verify: `pc-admin/scripts/check-received-parts-status-sync.mjs`
- Verify: `pc-admin/dist/`

**Interfaces:**
- Consumes: 完成后的 PC 后台源码与现有 npm scripts。
- Produces: 通过的定向检查、现有安全/兼容检查、生产构建，以及只含 `pc-admin/` 的 Git 提交。

- [ ] **Step 1: 记录项目测试脚本缺失**

Run: `cd pc-admin && npm test`

Expected: FAIL，输出 `Missing script: "test"`。这是已获用户批准继续的既有测试缺口，不新增伪测试脚本替代。

- [ ] **Step 2: 运行 PC 后台回归检查**

Run:

```powershell
npm run check:receipt-status-sync
npm run check:errors
npm run check:security
npm run check:urls
npm run check:staff
npm run check:print
```

Expected: 六个命令均退出 0。

- [ ] **Step 3: 运行生产构建**

Run: `cd pc-admin && npm run build`

Expected: PASS，Vite 输出位于 `pc-admin/dist/`；若构建只造成被 `.gitignore` 忽略的产物变化，不提交 `dist/`。

- [ ] **Step 4: 执行最终范围和敏感信息检查**

Run:

```powershell
git status --short
git diff --name-only
git diff --cached --name-only
```

Expected: 没有 `docte-master/`、根目录小程序、云函数、共享模块、数据库结构、环境文件或敏感信息变更。

- [ ] **Step 5: 暂存明确文件并提交**

```powershell
git add -- pc-admin/docs/superpowers/specs/2026-08-22-received-parts-order-status-sync-design.md pc-admin/docs/superpowers/plans/2026-08-22-received-parts-order-status-sync.md pc-admin/package.json pc-admin/scripts/check-received-parts-status-sync.mjs pc-admin/scripts/local-mock-server.mjs pc-admin/src/api/order.js pc-admin/src/utils/orderTransform.js pc-admin/src/utils/request.js pc-admin/src/views/WorkOrder.vue
git diff --cached --stat
git diff --cached --name-only
git commit -m "fix(admin): sync receipt confirmation status" -m "CONTEXT: Confirmed received-parts records could leave pending or sent order states visible in the PC admin list." -m "CHANGE: Advances eligible orders to received through the existing admin API and adds guarded partial-success handling plus a focused check." -m "WHY: Staff need receipt details, list filters, and status statistics to reflect one persisted workflow state." -m "IMPACT: New PC-admin confirmations synchronize the main order state without changing mini-program, backend, or database behavior."
```

Expected: 新提交只包含上述九个 `pc-admin/` 文件。

- [ ] **Step 6: 推送明确的目标远程分支**

Run: `git push origin HEAD:codex/order-status-sync-manual-select`

Expected: `Mrstongtong828/CICADA-` 的 `codex/order-status-sync-manual-select` 更新到新提交；不推送到其他远程或分支。
