# 工单签收状态同步与人工状态选择 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复工单签收后页面残留旧状态的问题，并让后台工单列表的黄色状态标签支持人工选择、保存和立即回显。

**Architecture:** 复用 `cicada-admin-order` 的现有状态更新、权限、状态机和审计能力。PC Admin 在签收或人工改状态成功后，以接口返回的最新工单为首选数据源，必要时再调用详情接口，将列表行、当前抽屉和签收表单统一回填，避免本地旧对象继续显示运输中。

**Tech Stack:** Vue 3 + Element Plus + Vite PC Admin；uniCloud cloud-object JavaScript；Node.js 检查脚本。

## Global Constraints

- 以 `CICADA-/docte-master/` 和 `CICADA-/pc-admin/` 为唯一实现目录。
- 不绕过 `cicada-order-workflow` 的状态机和 `assertRolePermission` 权限校验。
- 保持现有 API 字段兼容，状态值继续使用中文展示值与后端已有状态映射。
- 不修改历史备份目录，不提交构建缓存、登录凭据或 `.env.local`。
- 截图只保留黄色状态下拉已展开的界面。

---

### Task 1: Map the current status and receipt contracts

**Files:**
- Inspect: `pc-admin/src/views/WorkOrder.vue`
- Inspect: `pc-admin/src/api/order.js`
- Inspect: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- Inspect: `docte-master/uniCloud-alipay/cloudfunctions/common/cicada-order-workflow/index.js`

**Interfaces:**
- Consumes: existing `confirmReceivedParts`, `saveReceivedParts`, `updateStatus`, `getOrderDetail`, `getAllowedStatusOptions` contracts.
- Produces: exact field names and helper boundaries for Tasks 2 and 3.

- [ ] **Step 1: Trace the receipt submit path**

  Identify the methods invoked by `confirmCurrentReceivedParts`, the response shape, and whether it includes a full order object or only receipt fields.

- [ ] **Step 2: Trace the status update path**

  Identify the API method and response shape used by `handleQuickStatusChange` and the drawer status form. Record the existing backend status enum and display mapping.

- [ ] **Step 3: Trace the list/detail refresh path**

  Identify the canonical list loader, detail loader, row normalization helper, and the assignments that update `currentOrder`, `pagedOrders`, and `receivedPartsForm`.

### Task 2: Return the canonical order after receipt confirmation

**Files:**
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- Modify: `pc-admin/src/api/order.js`
- Test: `scripts/check-order-workflow.mjs` (contract assertions only if needed)

**Interfaces:**
- Consumes: existing receipt confirmation validation and order update transaction.
- Produces: `confirmReceivedParts` response with the persisted order projection, including the updated `status`, `update_time`, timeline, and receipt fields.

- [ ] **Step 1: Add a backend regression assertion**

  Extend the workflow contract check to require that the receipt confirmation method returns or reloads the persisted order after writing the receipt fields.

- [ ] **Step 2: Reload the order after the receipt update**

  After the existing successful `cicada_orders` update and audit event, read the order by `_id` with the active-order filter and return it through the same projection used by `getOrderDetail`. Do not synthesize status locally.

- [ ] **Step 3: Preserve API compatibility**

  Keep existing receipt fields at the top level of `data`; add the canonical order under `data.order` only if the current response is not already a full order. Ensure missing orders return the existing error shape.

- [ ] **Step 4: Normalize the frontend API wrapper**

  Make `confirmReceivedParts` expose the canonical order consistently (`response.data.order || response.data`) so the view can use one path for all environments.

- [ ] **Step 5: Run the targeted workflow check**

  Run `node scripts/check-order-workflow.mjs` from `CICADA-` and expect `Workflow closure checks passed.`

### Task 3: Synchronize receipt and manual status changes in the view

**Files:**
- Modify: `pc-admin/src/views/WorkOrder.vue`
- Modify: `pc-admin/src/utils/orderStatus.js` only if the shared status option mapping lacks the required manual values.

**Interfaces:**
- Consumes: canonical order from Task 2, existing `getOrderDetail`, `updateStatus`, `getAllowedStatusOptions`, and row normalization helpers.
- Produces: one refresh helper used by receipt confirmation and manual status updates; UI state immediately reflects the persisted order.

- [ ] **Step 1: Add a canonical refresh helper**

  Implement a local helper that accepts a normalized order, replaces the matching row in the source order list, updates `currentOrder`, and rehydrates `receivedPartsForm` from that same object. If the response has no order payload, fetch the detail by id before applying state.

- [ ] **Step 2: Use the helper after receipt confirmation**

  In `confirmCurrentReceivedParts`, await the confirmation request, apply the canonical order, then refresh the list counts only after the local row/detail state is updated. Keep the success notification and loading cleanup in `finally`.

- [ ] **Step 3: Make the yellow tag a manual selector**

  Render the status tag as an Element Plus dropdown whenever the user has `update_status` permission. The menu should include the full backend-supported manual status list, mark the current value, and not silently disable the tag just because there is no state-machine next step. Preserve the existing tooltip and visual tag tone.

- [ ] **Step 4: Persist and refresh manual selection**

  In `handleQuickStatusChange`, skip no-op selections, call `updateStatus`, apply the returned canonical order (or detail reload), then refresh list data. On error, leave the previous row untouched and show the existing error notification.

- [ ] **Step 5: Keep drawer state consistent**

  When the currently open order changes, update `newStatus`, status dwell text, timeline, and receipt controls from the refreshed object so the drawer cannot show the pre-submit status.

- [ ] **Step 6: Add focused view contract checks**

  Extend existing static checks or add a small Node contract test that asserts the view contains the shared refresh helper, receipt refresh call, manual dropdown command handler, and `updateStatus` invocation.

### Task 4: Build, run, and capture the acceptance screenshot

**Files:**
- Create: `output/order-status-manual-dropdown.png`

**Interfaces:**
- Consumes: Tasks 2 and 3 running in the PC Admin Vite app.
- Produces: verified build output and one screenshot showing the yellow status menu expanded.

- [ ] **Step 1: Install or reuse PC Admin dependencies**

  From `CICADA-/pc-admin`, run `npm install` only if `node_modules` is absent; keep the repository-local npm cache.

- [ ] **Step 2: Run static and build checks**

  Run `npm run check:urls`, `npm run check:errors`, and `npm run build` from `CICADA-/pc-admin`. Also run the root workflow check.

- [ ] **Step 3: Start the local admin server**

  Run `npm run dev -- --host 127.0.0.1` and record the actual URL if port 5173 is occupied.

- [ ] **Step 4: Capture only the expanded yellow dropdown**

  Use Playwright to open the work-order view with the existing local mock/session path, expand the yellow status tag, and save exactly `output/order-status-manual-dropdown.png`. Crop or region-capture only the relevant work-order area.

- [ ] **Step 5: Inspect the screenshot**

  Verify the yellow tag, dropdown options, and surrounding row are visible without overlap or stale “运输中” text after a status change.

### Task 5: Commit and push the feature branch

**Files:**
- Modify: all implementation files from Tasks 2-3
- Create: `output/order-status-manual-dropdown.png`

**Interfaces:**
- Consumes: passing checks and screenshot from Task 4.
- Produces: a pushed feature branch based on the latest `CICADA-` branch.

- [ ] **Step 1: Review repository rules and diff**

  Run `git status`, `git diff --stat`, `git diff`, and `git log --oneline -5` inside `CICADA-`; confirm unrelated files remain untouched.

- [ ] **Step 2: Run the smart-git security scan and test gate**

  Run the skill-provided secret scan and the project’s available checks; stop and fix any failure before staging.

- [ ] **Step 3: Create the feature branch**

  Create a branch named `codex/order-status-sync-manual-select` from the current branch.

- [ ] **Step 4: Commit with the required message format**

  Stage only the implementation files and screenshot, then commit with a five-part `fix(orders): ...` message describing context, change, why, and impact.

- [ ] **Step 5: Push to the configured remote**

  Push the new branch with upstream tracking and report the branch name, commit id, remote URL, and screenshot path.
