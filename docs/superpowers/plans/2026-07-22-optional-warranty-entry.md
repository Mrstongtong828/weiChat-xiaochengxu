# Optional Warranty Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许工作人员自行补录质保月数或截止日期，并在信息缺失时保持“待补充”，不再默认推算 12 个月。

**Architecture:** 设备档案是质保事实来源，工单保存质保状态快照。客户设备页和工单检测页都可录入可选质保字段；三个云函数使用一致的“显式截止日优先，其次采购日期 + 显式月数，否则未知”规则。

**Tech Stack:** Vue 3、Element Plus、uni-app、uniCloud 云对象、JSON Schema。

## Global Constraints

- 不覆盖当前工作区已有的无关修改。
- 未填写质保时间时不得默认 12 个月。
- 未知质保状态不得自动判定免费或收费。
- 状态必须同时使用文字和颜色表达。

---

### Task 1: 统一质保推算规则

**Files:**
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-customer/index.obj.js`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js`

**Interfaces:**
- Consumes: `buy_date`, `warranty_months`, `warranty_expire`, `ext_warranty`
- Produces: `in_warranty`, `warranty_status`, `charge_type`, `effective_expire`

- [ ] 删除未填写月数时的 12 个月回退。
- [ ] 保留显式截止日优先和延保最晚日期规则。
- [ ] 未提供可计算信息时返回 `unknown` / `pending`。
- [ ] 使用 `node --check` 校验三个云函数语法。

### Task 2: 完善客户设备质保表单

**Files:**
- Modify: `pc-admin/src/views/CustomerManagement.vue`

**Interfaces:**
- Consumes: 客户设备表单和设备列表 API。
- Produces: 可为空的 `warranty_months`、`warranty_expire`，以及自动计算预览。

- [ ] 将质保月数默认值由 `0` 改为空值。
- [ ] 增加“月数或截止日期任选其一”的帮助信息。
- [ ] 显示自动计算结果或“质保信息待补充”。
- [ ] 保存时保持空值，不臆造期限。

### Task 3: 在工单中支持质保补录

**Files:**
- Modify: `pc-admin/src/views/WorkOrder.vue`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- Modify: `docte-master/uniCloud-alipay/database/cicada_order_items.schema.json`

**Interfaces:**
- Consumes: 工单产品项和 SN 设备查询结果。
- Produces: 产品项质保月数/截止日、工单质保快照。

- [ ] 在检测产品区加入可选质保月数和截止日期。
- [ ] SN 命中设备时回填现有质保信息。
- [ ] 保存产品项后重算 `in_warranty` / `warranty_status` / `charge_type`。
- [ ] 未知状态显示“质保信息待补充”。

### Task 4: 同步数据说明与用户端提示

**Files:**
- Modify: `docte-master/uniCloud-alipay/database/cicada_user_devices.schema.json`
- Modify: `docte-master/pages/index/index.vue`
- Modify: `README.md`

**Interfaces:**
- Consumes: 工单质保状态快照。
- Produces: 一致的“在保/过保/待补充”说明。

- [ ] 明确质保字段为可选且无默认值。
- [ ] 小程序报价处展示未知状态提示。
- [ ] 更新 README 中自动判定和设备沉淀说明。

### Task 5: 构建验证

**Files:**
- Verify: `pc-admin/`
- Verify: `docte-master/`

**Interfaces:**
- Consumes: 完成后的代码。
- Produces: 可构建的 PC 后台和微信小程序。

- [ ] 运行 `npm run build`（`pc-admin/`）。
- [ ] 运行 `npm run check`（`docte-master/`）。
- [ ] 检查最终 diff，确认没有覆盖无关改动。
