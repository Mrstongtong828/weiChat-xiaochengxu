# 售后报价与后台模块升级 Goal

本文档用于规划本次“对标宇森 / NSK 牙科器械售后系统”的后台改造。目标不是一次性重写整套系统，而是在现有 `pc-admin`、小程序和 uniCloud 后端基础上，优先补齐“工单服务报价弹窗 + 报价支付闭环 + 备件库存联动”的可验收能力。

## 可复制的 Codex Goal

```text
/goal 在现有牙科器械检修系统中，分阶段升级后台工单报价能力：把当前简单维修报价改造成“配件费用 + 服务费用 + 其他费用”的三段式报价弹窗，并补齐报价记录、小程序展示、客户确认/支付、备件库存联动和结算入口的最小可用闭环。

First action: 先读取并汇报以下文件/目录的现状，不做修改：
  - AGENTS.md
  - pc-admin/src/views/WorkOrder.vue
  - pc-admin/src/api/order.js
  - pc-admin/src/router/index.js
  - pc-admin/src/components/Layout/MainLayout.vue
  - pc-admin/src/utils/orderTransform.js
  - docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js
  - docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js
  - docte-master/uniCloud-alipay/database/
  - docte-master/pages/
汇报：现有报价字段、现有付款字段、现有工单状态、现有后台菜单、现有数据库集合、现有小程序报价/支付入口数量。等用户确认后再开始实现。

Scope:
  - PC 后台：pc-admin/src/views/WorkOrder.vue、pc-admin/src/api/order.js、pc-admin/src/router/index.js、pc-admin/src/components/Layout/MainLayout.vue、pc-admin/src/utils/orderTransform.js，可按需要新增 pc-admin/src/views/work-order/*、pc-admin/src/views/Inventory*.vue、pc-admin/src/views/Settlement*.vue、pc-admin/src/api/inventory.js、pc-admin/src/api/settlement.js。
  - 小程序：docte-master/pages/index/index.vue、docte-master/api/*.js，可按需要新增报价明细展示相关组件或组合逻辑。
  - 云函数：docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js、docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js，可按需要新增 admin inventory/settlement 云函数。
  - 数据库：docte-master/uniCloud-alipay/database/ 下新增或扩展报价、配件、库存流水、结算相关 schema 和索引文档。
  - 不在本 goal 中实现企业微信客服会话存档、完整税控开票、真实第三方物流轨迹插件、复杂工程师绩效算法。

Constraints:
  - 必须遵守 AGENTS.md；如需并行子代理，必须先检查项目根目录是否存在 agents 目录。若不存在，不得伪造自定义角色映射。
  - 不要删除或回退用户已有改动；开始前和每个阶段结束后都运行 git status -sb 并报告异常。
  - 保持现有报价字段兼容：quote_items、parts_fee、labor_fee、total_price、quote_status、payment_status 不能被直接破坏。
  - 新报价结构必须能从旧报价数据降级展示；旧工单不应因为缺少新字段而报错。
  - 不新增 npm 依赖，除非用户明确批准。
  - 不改动微信支付密钥、订阅消息模板 ID、云空间 URL 等敏感配置。
  - 不通过跳过测试、删除校验、放宽权限来让构建通过。
  - PC 后台沿用 Vue 3 + Element Plus；小程序沿用 uni-app / Vue 3；后端沿用 uniCloud 云函数返回格式 code/data/msg。

Done when:
  1. P0 报价模型兼容升级完成：后端能保存三段式报价结构 parts/services/others/final_price/remark，同时继续写入旧字段 parts_fee、labor_fee、total_price、quote_items；旧数据在后台和小程序均可正常展示。
  2. P0 后台报价弹窗完成：WorkOrder 中出现三段式服务报价弹窗或等价交互，包含配件费用、服务费用、其他费用、自动合计、最终报价、200 字备注、保存草稿、发送报价；所有行都支持新增、删除、单价、数量、金额自动计算。
  3. P0 发送报价闭环完成：点击发送报价后，后台更新 quote_status=issued、payment_status=pending，写入 timeline 和 cicada_order_events，并触发已有订阅消息逻辑；重复发送不会产生不一致金额。
  4. P1 小程序报价展示完成：客户在小程序工单详情能看到配件费用、服务费用、其他费用、最终报价和备注；客户确认报价后 quote_status=confirmed/authorization_status=confirmed；微信支付和对公凭证上传仍可用。
  5. P1 备件库存最小闭环完成：新增配件库、库存流水 schema/API/后台页面；报价弹窗能从配件库选择配件并带出编号、名称、型号、单价、库存；付款确认或维修领用时生成库存出库流水，库存不足时阻止出库并提示。
  6. P1 结算入口完成：后台新增结算管理菜单或页面，能按待付款、待核销、已付款筛选工单，查看报价金额、付款方式、付款凭证、核销状态，并能跳回工单详情。
  7. P2 工单详情体验完成：报价、付款、物流、发票、审计记录在工单处理视图中有清晰分区；打印/导出至少包含最终报价、三类费用小计和报价备注。
  8. P2 数据库和索引文档完成：新增或变更的集合 schema、初始化样例、索引要求写入 docte-master/uniCloud-alipay/database/，并在 INDEXES.md 或独立文档中列出必须手动创建的索引。
  9. 验证命令通过：在 docte-master 运行 npm run check 退出码 0；在 pc-admin 运行 npm run build 退出码 0；若涉及 URL 配置，运行 pc-admin 的 npm run check:urls 并报告结果。
  10. 最终回复列出：改动文件、数据结构变化、兼容策略、手动验收步骤、未实现的后续项和残余风险。

Stop if:
  - 发现必须修改不在 Scope 内的核心认证、支付密钥、云空间部署配置或生产环境变量。
  - 需要新增 npm 依赖或升级 Node/Vite/uni-app/Element Plus 版本。
  - 现有报价、支付、发票或物流流程的测试/构建开始失败，且失败不是本阶段改动直接导致的可定位问题；不要通过修改测试或删除功能绕过。
  - 旧工单数据无法可靠迁移或兼容展示，需要一次性数据迁移脚本才能继续。
  - 数据库唯一索引、库存扣减并发一致性或支付回调幂等性无法在当前 uniCloud 能力内保证。
  - 小程序支付或订阅消息需要真实生产密钥才能继续验证；先停下报告需要的环境条件。
  - 项目根目录不存在 agents 目录但任务要求强制使用自定义子代理；先停下报告约束冲突。

Use a token budget of 180000 tokens for this goal.
```

## 分阶段实施计划

### P0：三段式报价弹窗和后端兼容

目标：先把截图中的“服务报价”核心体验做出来，但不强依赖库存模块。

主要改动：

- 升级 `cicada-admin-order/updateOrderQuote`，支持 `parts`、`services`、`others`、`final_price`。
- 保持旧字段兼容：继续计算并保存 `parts_fee`、`labor_fee`、`total_price`、`quote_items`。
- 改造 `pc-admin/src/views/WorkOrder.vue` 的报价区，做成弹窗或等价分区。
- 更新 `pc-admin/src/utils/orderTransform.js`，让新旧报价数据都能正常映射。

验收标准：

- 后台能新增至少 1 条配件费用、1 条服务费用、1 条其他费用。
- 修改单价或数量后，单行金额和三类小计自动变化。
- 最终报价默认等于自动合计，但允许手动调整。
- 备注超过 200 字时前端阻止发送或后端返回明确错误。
- 发送报价后，工单 `quote_status` 为 `issued`，`payment_status` 为 `pending`。
- 老工单只有 `quote_items` 时，后台不报错，仍能展示为兼容报价。
- `cd pc-admin && npm run build` 通过。

### P1：小程序报价确认和支付展示

目标：客户能在小程序看到完整报价明细，并完成确认、支付或上传凭证。

主要改动：

- 扩展 `cicada-client-order` 的报价字段暴露逻辑。
- 小程序工单详情展示三段式报价明细。
- 确认报价、微信支付、付款凭证上传继续复用现有接口。

验收标准：

- 未发布报价时，小程序不展示报价金额和明细。
- 报价发布后，小程序能看到配件、服务、其他费用三组明细。
- 客户确认报价后，`quote_status=confirmed`，`authorization_status=confirmed`。
- 微信支付创建预支付订单时使用最终报价金额。
- 对公凭证上传后，后台付款状态进入待核销。
- `cd docte-master && npm run check` 通过。

### P1：备件库存最小闭环

目标：让报价弹窗的配件费用有真实数据源，并形成库存流水。

建议新增集合：

- `cicada_parts`：配件主数据。
- `cicada_inventory_flows`：库存流水。

配件字段建议：

- `part_code`
- `part_name`
- `model`
- `compatible_models`
- `purchase_cost`
- `sale_price`
- `stock`
- `warning_threshold`
- `enabled`

库存流水字段建议：

- `part_id`
- `order_id`
- `flow_type`
- `quantity`
- `before_stock`
- `after_stock`
- `operator_id`
- `remark`
- `create_time`

验收标准：

- 后台有配件列表页面，能按编码、名称、适配型号、库存状态筛选。
- 能新增、编辑、禁用配件。
- 报价弹窗点击“添加配件”能选择启用状态的配件。
- 选择配件后自动带出编码、名称、型号、销售单价。
- 库存不足时，报价可保存草稿，但付款后出库或维修领用必须阻止。
- 每一次出库/入库/盘点都会写入库存流水。
- 低于预警阈值的配件在列表中有明确标识。

### P1：结算管理入口

目标：把工单里的付款状态抽出来，形成财务可用的结算视图。

主要改动：

- 新增 `SettlementManagement.vue` 或等价页面。
- 新增菜单：结算管理。
- 复用现有 `payment_status`、`payment_proofs`、`total_price`、`invoice_info`。

验收标准：

- 页面能按待付款、待核销、已付款筛选。
- 列表显示工单号、客户、最终报价、付款方式、凭证数量、付款状态、发票状态。
- 点击工单能回到对应工单处理视图。
- 财务角色能访问结算页面，普通工程师不能核销付款。
- 核销成功后工单付款状态为 `paid`，并写入审计事件。
- `cd pc-admin && npm run build` 通过。

### P2：工单详情和打印导出增强

目标：让报价、结算、物流、发票、审计记录更接近截图中的独立工单详情体验。

主要改动：

- 优化工单处理视图的信息分区。
- 打印/导出增加报价明细。
- 如成本可控，可新增独立工单详情路由。

验收标准：

- 工单详情或抽屉中至少包含：客户信息、设备信息、报修信息、报价信息、付款信息、物流信息、发票信息、时间线。
- 打印单包含三类费用小计、最终报价、报价备注。
- 导出字段包含报价状态、付款状态、最终报价、配件费用、服务费用、其他费用。
- 旧工单没有新报价结构时，打印和导出不报错。

## 数据兼容策略

新结构作为主结构：

```js
quote_detail: {
  parts: [],
  services: [],
  others: [],
  parts_total: 0,
  services_total: 0,
  others_total: 0,
  auto_total: 0,
  final_price: 0,
  remark: ''
}
```

旧字段继续保留：

```js
quote_items: [],
parts_fee: 0,
labor_fee: 0,
total_price: 0,
quote_status: 'pending',
payment_status: 'pending'
```

兼容要求：

- 写入新报价时同步写旧字段。
- 读取旧报价时转换成新结构展示。
- 小程序优先读取新结构，缺失时降级读取旧字段。
- 报表和结算短期仍以 `total_price` 为准，避免大范围改动。

## 手动验收脚本

1. 创建或选择一个待报价工单。
2. 后台进入工单，新增配件费用、服务费用、其他费用。
3. 保存草稿，刷新页面，确认草稿仍在。
4. 发送报价，确认状态进入待付款。
5. 小程序打开该工单，确认能看到完整报价明细。
6. 客户确认报价。
7. 走微信支付或上传对公凭证。
8. 后台结算页面看到待核销或已付款记录。
9. 核销付款，确认工单付款状态变为已付款。
10. 如果报价使用了库存配件，确认库存流水生成且库存变化正确。

## 验证命令

```bash
cd docte-master
npm run check
```

```bash
cd pc-admin
npm run build
npm run check:errors
```

如涉及远端 URL 化云函数：

```bash
cd pc-admin
npm run check:urls
```

## 残余风险

- 库存扣减若需要强一致并发控制，uniCloud 侧可能需要事务或幂等锁设计。
- 微信支付完整验收依赖真实商户号和回调配置。
- 小程序订阅消息是否能送达依赖模板 ID、openid 和用户授权。
- 如果未来要对接企业微信客服、税控开票、第三方物流轨迹，需要拆成独立 goal。
