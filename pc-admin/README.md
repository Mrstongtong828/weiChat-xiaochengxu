# Docte PC Admin

这是 Docte 项目的 PC 后台管理端，基于 `Vue 3 + Vite + Element Plus`，用于工单处理、报价、付款核销、物流导入、发票登记、待办中心和基础运营统计。

## 运行

环境要求：

- Node.js `>= 20.19.0`

安装依赖：

```bash
npm install
```

复制本地环境配置：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

本地开发：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

## 云函数 URL 配置

后台接口地址默认使用 `src/config/api.js` 中的兜底云空间，也可以在 `.env.local` 中配置。真实环境验收前必须确认这些 URL 已指向当前 uniCloud 云空间 URL 化后的云函数：

- `cicada-admin-sys`
- `cicada-admin-kb`
- `cicada-admin-order`
- `cicada-admin-customer`

推荐优先配置统一云空间基地址：

```bash
VITE_UNICLOUD_BASE_URL=https://your-env-id.example.com
```

如果每个云函数 URL 独立，也可以分别配置：

```bash
VITE_ADMIN_SYS_URL=https://your-env-id.example.com/cicada-admin-sys
VITE_ADMIN_KB_URL=https://your-env-id.example.com/cicada-admin-kb
VITE_ADMIN_ORDER_URL=https://your-env-id.example.com/cicada-admin-order
VITE_ADMIN_CUSTOMER_URL=https://your-env-id.example.com/cicada-admin-customer
VITE_CLIENT_PUBLIC_URL=https://your-env-id.example.com/cicada-client-public
```

`VITE_CLIENT_PUBLIC_URL` 是可选项。未配置时，健康检查会使用已 URL 化的 `cicada-admin-order/getSubscriptionConfig` 只读端点确认订阅模板配置通道可达；如果你已经为 `cicada-client-public` 开启 URL 化，可以显式配置它。

正式环境已在 `.env.production` 中固定为服务空间 `env-00jy6g4qwi94`，后台域名为 `https://admin.cicadadental.cn`。执行 `npm run build` 时 Vite 会读取该生产配置；`.env.production.local` 或构建环境中预先注入的同名变量可以覆盖它，上线构建前应确认最终值指向同一服务空间。

如果切换云空间、测试环境或生产环境，需要同步更新 `.env.local` 并重新构建，否则后台页面可能仍访问旧环境数据。验收前建议先用无效 token 请求 `getAdminOrderList` 和 `getTodoSummary`，确认返回的是当前部署代码的鉴权错误结构，而不是旧环境的 404/500 空响应。

也可以直接运行健康检查脚本：

```bash
npm run check:urls
```

该脚本按 `.env`、`.env.local`、`.env.production`、`.env.production.local` 的顺序加载配置，并允许进程环境变量最终覆盖；因此仓库默认检查 `.env.production` 指向的正式空间。它会用无效 token 请求 `getAdminOrderList`、`getTodoSummary`，同时检查 `getSubscriptionConfig` 是否可达。期望结果是后台两个接口返回 `code=401` 且包含“鉴权失败”的响应，订阅配置接口返回 `code=0` 和 `templates` 数组；如果出现非 401 业务码、404、500 空响应或方法不存在，说明错误契约、URL 化配置或云函数部署仍需处理。

## Goal 验收重点

### 工单分页和筛选

- 工单列表通过 `getAdminOrderList` 请求服务端分页数据。
- 后端返回 `list`、`total`、`page`、`pageSize` 和 `deviceModels`。
- 验收时准备超过 100 条工单，确认第 101 条之后能通过分页看到。
- 验证状态、关键词、设备型号、发票状态和待办筛选后的界面总数与云函数返回的 `total` 一致。

### 后台代客建单

- 工单页“新建工单”用于电话、门店收件等线下受理场景；表单默认收件日期为当天、初始状态为“已到店/已签收”，也可改为“待客户寄入”或“运输中”。
- 受理信息包含收件日期、对接业务员、客户寄入快递公司和快递单号；客户类型、名称、联系人、11 位手机号、地址以及至少一台设备为必填。
- 提交时会用客户名称、联系人、手机号和地址同步生成寄入及维修后回寄联系人信息。收件日期保存到 `ship_out_info.received_at`；选择“运输中”时必须填写寄入快递单号。
- 对接业务员保存到 CRM 客户档案的 `biz_user`。匹配到已有客户时只补齐空值，不覆盖档案中已有的对接业务员。
- 选择“已到店/已签收”会同时将 `arrival_confirm_status` 设为 `confirmed`；新设备会按 SN 沉淀到客户设备台账。
- 发布该功能必须同时重新部署 `cicada-admin-order` 并重新构建、发布 `pc-admin`，仅更新其中一端会导致新增字段丢失或界面仍使用旧表单。

### 导出

- 选中工单时导出选中数据。
- 未选中工单时循环拉取当前筛选下的全部分页数据并导出。
- 导出完成提示会显示实际导出数量，验收时需要确认提示数量与导出文件行数一致。

### 待办中心

- 首页调用 `getTodoSummary` 展示待签收、待报价、待核销、待开票、待回寄、异常工单。
- 点击待办卡片会进入工单页并携带 `todo` 查询参数。
- 工单页筛选逻辑与首页待办统计复用服务端 `todoType` 规则，验收时需要确认首页数量与列表总数一致。

### 发票登记

- 工单抽屉会展示发票状态、抬头、税号和备注。
- 后台更新发票状态时会写回 `invoice_info`，并保留已有发票申请字段。
- 验收时需要从小程序提交发票申请，再在后台改为已开具，最后回到小程序刷新确认状态同步。

### 订阅消息

- 后台签收、回寄、完成、报价发布和付款核销会触发订阅消息发送逻辑。
- 发送成功、失败或跳过都会写入 `cicada_subscription_logs`。
- 发送失败不应阻塞后台主流程。
- 上线前运行 `npm run check:subscription`，确认六个既有订阅场景模板均已配置。
- 真机或微信开发者工具验收需覆盖：允许授权、拒绝授权、模板缺失三种情况；拒绝授权或模板缺失时主流程仍应成功，日志状态应分别能看到 `sent`、`skipped` 或 `failed`。

## 安全审计

上线前运行：

```bash
npm audit --omit=dev
```

当前期望结果为：

```text
found 0 vulnerabilities
```
