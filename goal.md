# Docte Project Goal

## Objective

将 `E:\小程序开发\docte` 项目按当前复盘建议分阶段补齐业务闭环、后台数据可靠性、页面可维护性和后续体验能力。执行时必须逐项推进，每一项完成后都要按对应验收标准验证，再进入下一项。

## Global Rules

- 未收到用户明确指令前，不要修改项目文件。
- 只有用户反馈“执行第 X 项”或同等明确指令后，才开始对应任务。
- 每次执行前先拉取最新代码，并检查 `git status -sb`。
- 不要回退用户或远端已有改动；若遇到冲突，先说明冲突文件和建议处理方式。
- 每项任务完成后必须运行相关验证命令，并在回复中列出验证结果。
- 涉及前台小程序时，优先运行 `cd docte-master && npm run check`。
- 涉及 PC 后台时，优先运行 `cd pc-admin && npm run build`。
- 涉及依赖或安全时，运行对应项目的 `npm audit --omit=dev`。
- 修改完成后再由用户决定是否提交、推送或继续下一项。

## Recommended Order

1. 执行第 1 项：补齐前台发票申请闭环。
2. 执行第 2 项：后台工单列表改为真实服务端分页。
3. 执行第 3 项：拆分前台首页和后台工单页，降低维护和性能风险。
4. 执行第 4 项：新增后台待办中心。
5. 执行第 5 项：新增用户端状态订阅提醒。

## Task 1: 补齐前台发票申请闭环

优先级：P0

### Purpose

小程序首页已经展示“待开票”和申请入口，但当前前台接口仍返回“开票申请云接口暂未接入”。本任务要让用户能从小程序提交发票申请，并让后台管理端看到和处理该申请。

### Files

- `docte-master/api/content.js`
- `docte-master/pages/index/index.vue`
- `docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js`
- `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- 需要时同步检查 `pc-admin/src/views/WorkOrder.vue`

### Implementation Notes

- 在 `cicada-client-order` 中新增用户发票申请方法。
- 校验用户 token 和工单归属，避免用户申请不属于自己的工单。
- 写入或更新工单的 `invoice_info`，至少包含：是否需要开票、状态、发票抬头、税号、备注、申请时间。
- 将 `docte-master/api/content.js` 中的 `applyInvoice` 从 `Promise.reject` 改为调用真实云对象方法。
- 保持后台 `updateInvoiceStatus` 继续用于管理端登记或更新开票状态。
- 小程序提交成功后刷新订单列表或本地更新发票状态。

### Acceptance Criteria

- 小程序点击发票申请入口不会再出现“开票申请云接口暂未接入”。
- 用户只能给自己的可开票工单提交申请。
- 提交发票申请后，工单数据中出现 `invoice_info`，状态进入“待开票”或等价状态。
- 后台工单页能看到该工单的发票状态、抬头、税号和备注。
- 后台将发票状态改为“已开具”后，小程序刷新能看到状态变化。
- 异常情况有明确提示：未登录、工单不存在、无权限、缺少抬头或税号。

### Verification

- 运行 `cd docte-master && npm run check`。
- 运行 `cd pc-admin && npm run build`。
- 手动验证：小程序申请开票 -> 后台查看待开票 -> 后台改为已开具 -> 小程序刷新状态。

## Task 2: 后台工单列表改为真实服务端分页

优先级：P1

### Purpose

后台工单页当前固定请求前 100 条数据，再在前端分页和筛选。工单超过 100 条后会漏数据，搜索、筛选和导出也会不可靠。本任务要把分页、筛选和总数交给后端处理。

### Files

- `pc-admin/src/views/WorkOrder.vue`
- `pc-admin/src/api/order.js`
- `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- 需要时同步检查 `pc-admin/src/utils/orderTransform.js`

### Implementation Notes

- 扩展 `getOrderList` 参数，支持 `status`、`page`、`pageSize`、搜索关键词、设备型号、发票状态等必要筛选条件。
- 后端 `getAdminOrderList` 返回 `list` 和 `total`，并保持兼容旧数组返回形态，或一次性同步前端适配。
- `WorkOrder.vue` 分页切换、页大小切换、状态筛选、搜索时重新请求后端。
- 区分“当前页导出”和“当前筛选全部导出”；如果导出全部，需要后端接口或循环分页拉取。
- 保留当前选中、批量操作和刷新逻辑的稳定性。

### Acceptance Criteria

- 工单超过 100 条时，第 101 条及之后仍能在后台通过分页看到。
- 后台分页总数使用后端返回的 `total`，不是本地数组长度。
- 状态筛选、关键词搜索、设备筛选、发票状态筛选不会漏掉前 100 条之外的结果。
- 分页切换、页大小切换不会丢失当前筛选条件。
- 批量操作后刷新列表仍停留在合理页码，并显示最新数据。
- 导出逻辑清楚区分当前页和当前筛选全部，导出数量与界面提示一致。

### Verification

- 运行 `cd pc-admin && npm run build`。
- 构造或使用超过 100 条工单数据验证分页。
- 验证筛选结果总数与云函数返回一致。
- 验证批量操作、导入物流、报价和核销后列表刷新正常。

## Task 3: 拆分前台首页和后台工单页

优先级：P1

### Purpose

小程序首页和后台工单页都已承载大量业务。继续堆功能会增加回归成本和性能风险。本任务要在不改变行为的前提下拆分结构，让后续发票、支付、报价、物流等功能更容易维护。

### Files

- `docte-master/pages/index/index.vue`
- `pc-admin/src/views/WorkOrder.vue`
- 可新增小程序组合逻辑或组件文件，例如 `docte-master/pages/index/composables/*`
- 可新增后台组合逻辑或组件文件，例如 `pc-admin/src/views/work-order/*` 或 `pc-admin/src/composables/*`

### Implementation Notes

- 先抽离纯函数和数据映射，不改变 UI。
- 前台优先拆：包裹查询、发票流程、报价/支付流程、投诉反馈、政策/客服文档。
- 后台优先拆：报价弹窗、付款核销、物流导入、导出、打印、筛选分页。
- 每次拆分保持一个小步可验证，不做大范围样式重写。
- 避免引入新的全局状态库，除非现有代码确实需要。

### Acceptance Criteria

- 拆分后用户可见行为与拆分前一致。
- 小程序首页主文件明显减少业务逻辑体量，核心页面只负责布局和流程编排。
- 后台工单页主文件明显减少弹窗和导入导出细节。
- 抽离出的函数有清晰输入输出，便于后续单独测试。
- 没有新增重复状态源，弹窗开关、表格选择、分页状态仍稳定。

### Verification

- 运行 `cd docte-master && npm run check`。
- 运行 `cd pc-admin && npm run build`。
- 手动验证小程序：首页、报修、包裹查询、报价确认、支付/凭证、发票入口、投诉入口。
- 手动验证后台：工单列表、筛选、报价、核销、物流导入、打印、导出、批量操作。

## Task 4: 新增后台待办中心

优先级：P1

### Purpose

管理员需要快速看到“待签收、待报价、待核销、待开票、待回寄”等关键待办。新增待办中心可以减少漏单，并让后台首页真正成为运营入口。

### Files

- `pc-admin/src/views/Home.vue`
- `pc-admin/src/api/order.js`
- `pc-admin/src/router/index.js`
- `pc-admin/src/views/WorkOrder.vue`
- `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`

### Implementation Notes

- 扩展 `getStatistics` 或新增 `getTodoSummary` 接口。
- 返回待办分组：待签收、待报价、待核销、待开票、待回寄、异常工单。
- 后台首页展示待办卡片，点击后跳转工单页并带对应筛选参数。
- 工单页识别 query 参数并自动应用筛选。
- 待办数量统计逻辑应与工单页筛选逻辑一致。

### Acceptance Criteria

- 后台首页显示所有待办分组和数量。
- 点击任一待办卡片能进入工单页并展示对应工单。
- 首页待办数量与工单页筛选后的总数一致。
- 没有 token 时不会请求待办数据，并能正常跳转登录。
- 接口异常时首页显示错误或空态，不误报为 0。

### Verification

- 运行 `cd pc-admin && npm run build`。
- 使用包含不同状态的工单数据验证每个待办分组数量。
- 点击每个待办卡片验证跳转和筛选。
- 使用无效 token 验证错误处理。

## Task 5: 新增用户端状态订阅提醒

优先级：P2

### Purpose

用户不应频繁打开小程序查询状态。工单签收、报价发布、付款确认、回寄发货时发送订阅提醒，可以提升服务体验并减少客服咨询。

### Files

- `docte-master/pages/index/index.vue`
- `docte-master/api/repair.js`
- `docte-master/api/content.js`
- `docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js`
- `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- 可能需要新增配置文件记录订阅模板 ID

### Implementation Notes

- 明确需要提醒的状态节点：签收、报价发布、付款确认、回寄发货、完成。
- 前台在提交报修、查看进度或确认报价前请求订阅消息授权。
- 后台状态变化时调用发送逻辑。
- 记录发送结果，至少包含工单 ID、用户 ID、模板 ID、发送状态、失败原因、时间。
- 用户拒绝授权时不阻塞主流程。

### Acceptance Criteria

- 用户授权订阅后，指定状态变化能收到微信订阅消息。
- 用户拒绝授权时，报修、确认报价、付款等主流程不受影响。
- 后台状态更新不会因消息发送失败而整体失败。
- 消息发送成功和失败都有日志或记录可查。
- 模板 ID、支付密钥等敏感配置不写入前端代码。

### Verification

- 运行 `cd docte-master && npm run check`。
- 在微信开发者工具或真机环境验证订阅授权流程。
- 后台更新工单状态，验证用户端收到对应提醒。
- 模拟发送失败，验证主流程仍成功且失败原因被记录。

## Security Baseline

当前复盘时：

- `pc-admin npm audit --omit=dev` 结果为 `found 0 vulnerabilities`。
- `docte-master npm audit --omit=dev` 结果为 `found 0 vulnerabilities`。

任何任务如改动依赖，都必须重新运行对应审计命令。

## Completion Checklist

每执行一项任务，完成前必须确认：

- 已说明本次执行的是哪一项任务。
- 已列出修改文件。
- 已运行对应构建或检查命令。
- 已说明手动验证结果或无法手动验证的原因。
- 未开始未被用户明确授权的下一项任务。
