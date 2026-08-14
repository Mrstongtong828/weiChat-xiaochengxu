# 收货配件明细 Implementation Plan

> **For agentic workers:** Implement task-by-task and verify each task before moving on.

**Goal:** 为后台维修工单增加收货配件明细录入、照片凭证、签收审计和维修单打印展示。

**Architecture:** 复用 `cicada_orders` 文档与现有 admin-order 权限/审计能力；前端在 WorkOrder 概览抽屉内维护明细和图片，打印工具从工单对象读取同一数据。

**Tech Stack:** Vue 3、Element Plus、Vite、uniCloud cloud-object、Node.js 测试脚本。

## Global Constraints

- 只修改 `CICADA-` 仓库，不使用旧仓库。
- 不新增运行时依赖；图片继续走现有 `uploadFile`。
- HTTP/云函数返回保持 `{ code, msg, data }` 约定。

### Task 1: 数据模型与后端接口

**Files:**
- Modify: `docte-master/uniCloud-alipay/database/cicada_orders.schema.json`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- Modify: `pc-admin/src/api/order.js`

- [x] 增加字段 schema、输入校验、保存接口、确认接口、详情临时 URL 映射和审计事件。
- [x] 为前端导出 API 方法并保持权限错误透传。

### Task 2: 工单详情编辑区

**Files:**
- Modify: `pc-admin/src/views/WorkOrder.vue`

- [x] 在设备与故障后渲染可增删的名称/数量/备注行、图片选择/预览/删除和签收状态。
- [x] 接入保存与确认接口，保存后刷新当前工单并处理加载、权限和错误状态。

### Task 3: 维修单打印模板

**Files:**
- Modify: `pc-admin/src/utils/orderPrint.js`

- [x] 增加字段定义、规范化函数和维修单区块，输出明细、签收元数据及图片缩略图/占位文案。
- [x] 保证旧工单无字段时打印不报错。

### Task 4: 验证与截图

**Files:**
- Create: `output/playwright/received-parts-page.png`
- Create: `output/playwright/received-parts-print-preview.png`

- [x] 运行前端构建、打印检查、语法校验和接口防篡改检查。
- [x] 启动本地 mock 与 Vite，完成页面流程和打印预览截图。
