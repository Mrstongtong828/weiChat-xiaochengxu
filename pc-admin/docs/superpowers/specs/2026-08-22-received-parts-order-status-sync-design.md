# 收货配件签收同步工单状态设计

## 背景

PC 管理后台的工单处理抽屉可以保存并确认客户随设备寄入的配件。确认成功后，`received_parts_receipt.status` 会变为 `confirmed`，并记录签收人和签收时间；工单列表的状态则只来自订单主字段 `status`。当前两个字段独立更新，因此可能出现配件明细显示“已确认签收”，而列表仍显示“已提交”或“运输中”的不一致现象。

本次修复仅允许修改 `pc-admin/`。不得修改或部署小程序前端、客户端云函数、后台云函数、共享状态机、数据库结构或线上数据。

## 目标

后台人员在 PC 管理后台完成“确认配件签收”后，如果工单仍处于“已提交”或“运输中”，前端应根据物流入库标记调用现有 `confirmInboundArrival` 或 `updateOrderStatus` 接口，将订单主状态推进为 `received`，随后以服务端响应刷新当前工单、列表和状态统计。

## 非目标

- 不修改 `confirmReceivedParts`、`confirmInboundArrival` 或 `updateOrderStatus` 的接口格式。
- 不绕过后端已有的权限、物流前置条件或状态机校验。
- 不将已经进入“处理中”“已回寄”“已完成”“已取消”的工单回退到“已签收”。
- 不在列表加载时自动写数据库，也不批量修复历史数据。
- 不用展示层派生状态掩盖服务端主状态。
- 不部署 PC 后台、云函数、小程序或数据库变更。

## 方案

### 确认流程

`confirmCurrentReceivedParts` 保持现有保存明细和确认对话框流程，然后按以下顺序执行：

1. 调用 `confirmReceivedParts`，记录配件明细的签收人和签收时间。
2. 从该接口的服务端响应合并最新工单快照。
3. 判断签收前的订单主状态：
   - `pending` 或 `sent` 且 `arrival_confirm_status='pending'`：调用现有 `confirmInboundArrival`，完成物流送达后的正式入库确认。
   - 其他 `pending` 或 `sent`：调用 `updateOrderStatus(token, orderId, 'received')`。
   - `received`、`inspecting`、`fixing`、`shipped`、`completed`、`cancelled`：不调用状态更新，防止重复请求或状态回退。
4. 使用状态更新响应再次合并服务端快照。
5. 统一重新加载当前筛选下的工单列表和状态统计。

前端只编排现有的配件签收、入库确认和状态更新接口。后端仍负责判断当前管理员权限、状态流转是否合法，以及寄入物流等前置条件是否满足。

### 状态判断

状态判断使用工单的英文主状态 `statusEn`。若当前快照缺少 `statusEn`，则通过现有状态映射把中文 `status` 转为英文状态。只有明确识别为 `pending` 或 `sent` 时才自动推进，未知状态不自动写入。

### 成功与失败反馈

两次调用无法在纯前端实现数据库事务，因此需要区分以下结果：

- 两次调用均成功：提示“收货配件已确认签收，工单状态已同步”。
- 配件签收成功，状态本来已是 `received` 或更后阶段：提示“收货配件已确认签收”。
- 配件签收成功，但状态更新被后端拒绝或网络失败：保留已成功的配件签收记录，刷新服务端数据，并用警告提示“配件已确认签收，但工单状态同步失败：<后端错误>”。不得显示整体失败，也不得在页面上伪造“已签收”状态。
- 配件签收接口失败：保持现有错误提示，不调用状态更新接口。

部分成功后，按钮会因服务端返回的 `received_parts_receipt.status=confirmed` 而不可再次确认；操作人员可使用列表中现有的状态菜单，在满足后端条件后手动推进状态。

## 代码边界

### 修改

- `pc-admin/src/views/WorkOrder.vue`
  - 增加签收后是否需要推进主状态的纯判断逻辑。
  - 编排 `confirmReceivedParts` 与现有 `confirmInboundArrival`/`updateOrderStatus`。
  - 对成功、无需推进和部分成功提供准确反馈。
- `pc-admin/src/utils/orderTransform.js`
  - 保留 `arrival_confirm_status`，供前端选择符合后端前置条件的现有接口。
- `pc-admin/src/api/order.js`、`pc-admin/src/utils/request.js`
  - 为状态同步请求提供可选的错误消息静默配置，避免拦截器错误与业务层部分成功警告重复展示；其他请求保持原行为。
- `pc-admin/scripts/local-mock-server.mjs`
  - 覆盖物流已签收、待确认入库的本地验证场景。
- `pc-admin/scripts/check-received-parts-status-sync.mjs`
  - 静态检查签收与状态同步的关键调用顺序、状态保护和部分成功提示。
- `pc-admin/package.json`
  - 增加 PC 专属的定向检查命令 `check:receipt-status-sync`。

### 不修改

- `docte-master/` 下的全部小程序、云函数、共享模块和数据库文件。
- 仓库根目录的工作流检查脚本。
- PC 后台 API 请求结构和环境配置。

## 验证

### 定向检查

运行 `npm run check:receipt-status-sync`，验证：

- 配件签收成功后存在 `pending`/`sent` 到 `received` 的自动推进逻辑。
- 已签收或更后阶段不会自动回退。
- 状态同步根据 `arrival_confirm_status` 使用现有 `confirmInboundArrival` 或 `updateOrderStatus` API。
- 部分成功时使用警告而不是整体失败提示。
- 操作结束后刷新列表和状态统计。

### PC 后台回归

在 `pc-admin/` 运行：

```bash
npm test
npm run build
npm run check:errors
npm run check:security
npm run check:urls
npm run check:staff
npm run check:print
```

仓库当前可能没有 `test` 脚本；若 `npm test` 因脚本缺失失败，应如实记录，而不是修改小程序或后端代码规避。

### 手工场景

使用本地 mock 验证：

1. `pending` 工单确认配件签收后，列表状态变为“已签收”。
2. `sent` 工单确认配件签收后，列表状态变为“已签收”。
3. `fixing` 或更后阶段工单确认配件签收后，主状态保持不变。
4. 模拟入库确认或状态更新失败时，配件签收信息仍保留，并显示部分成功警告。
5. 状态筛选使工单离开当前列表时，抽屉仍保留服务端最新快照，状态统计完成刷新。

## 风险与边界

- 纯前端双调用不是原子操作；第二步失败时会短暂或持续存在配件已签收、主状态未推进的情况。本设计通过明确告警和重新加载服务端数据避免假成功。
- 后端可能因缺少寄入物流单号、物流未签收或非法状态流转拒绝推进。本修复不会绕过这些生产规则。
- 历史不一致数据不会因打开列表自动改写；本次只保证新的 PC 后台确认操作会尝试同步。历史数据应由有权限的后台人员通过现有状态菜单逐条处理，或在另行获得数据库/后端授权后制定迁移方案。
