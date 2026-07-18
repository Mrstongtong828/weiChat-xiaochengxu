# 牙医仪器检修管理系统

面向牙科设备售后维修场景的多端项目：客户使用的微信小程序、管理员 / 工程师 / 财务 / 客服使用的 PC 后台，以及两端共用的 uniCloud（支付宝云）云函数与数据库。

## 项目组成

| 模块 | 位置 | 技术栈 | 说明 |
| --- | --- | --- | --- |
| 用户端小程序 | `docte-master/` | uni-app、Vue 3、微信小程序 | 客户提交报修、查看维修进度、确认报价、支付、查询包裹、管理地址与设备、投诉建议、查看政策和联系客服 |
| PC 管理后台 | `pc-admin/` | Vue 3、Vite、Element Plus、Pinia | 工单、配件库存、结算、客户 CRM、知识库、反馈闭环、系统设置和数据导出 |
| 云端服务 | `docte-master/uniCloud-alipay/` | uniCloud 云函数、云数据库 | 登录、工单状态机、支付与退款、订阅消息、CRM、后台管理接口 |

> 仓库根目录还保留了一份**残缺的小程序旧拷贝**（`App.vue`、`main.js`、`pages.json` 等，没有 `pages/` 与后端）。以 `docte-master/` 为准，根目录文件不是运行版本。最权威的架构导览见根目录 `CLAUDE.md`。

## 核心能力

### 客户端小程序
- 微信手机号登录与用户资料维护
- 报修工单提交、图片 / 视频上传入口、设备 SN 绑定与历史查询
- **在保 / 过保自动判定**：下单按设备购机日期 + 质保月数推算到期日，自动标记 `in_warranty` / `charge_type`（免费 / 收费），最终以工程师报价为准
- 维修进度、报价确认 / 拒绝、支付状态和回寄物流展示（口径与后台一致）
- 拒绝报价的归档闭环：未拆检自动取消归档，已检测 / 维修的设备走原路回寄后结案
- 地址、投诉建议、发票信息、政策与客服 / 公众号入口

### PC 管理后台
- 工单分页、筛选、**SLA 时效预警与筛选**、导出、批量操作和待办中心
- 配件库存：配件目录、报价用料扣减、库存流水，**含「报价含配件但未绑库存」告警**
- 结算与**微信支付 v3 退款**（全额 / 部分、幂等防重、写审计）
- 客户 CRM：档案、设备台账、历史工单、标签、导入导出、合规日志
- 故障知识库、反馈（投诉 / 建议）处理闭环（分派 / 紧急度 / 回复 / 回访 / 结案）
- 系统设置：保修政策 / 收费办法**文档上传**、隐私合规内容、联系方式与公众号配置、小程序体验码

### 权限与数据安全（RBAC）
- 员工角色：`admin`（管理员）、`engineer`（工程师）、`finance`（财务）、`support`（客服）
- 工单列表的客户手机号按角色脱敏，仅 `admin` 可见完整号（与 CRM `view_phone` 策略对齐）
- 配件采购成本仅 `admin` / `finance` 可见，其他角色不下发成本字段
- 权限唯一真相在 `cicada-order-workflow` 的 `PERMISSIONS` 表，前后端共同遵守

## 订单状态机与数据闭环

工单是整个系统的主线，投诉、发票、设备、物流、付款、回访都挂在**同一张工单**下，不做成独立模块。

- **主状态机**（后端唯一真相，见 `docte-master/uniCloud-alipay/cloudfunctions/common/cicada-order-workflow`）：
  `已提交 → 运输中 → 已签收 → 检测中 → 维修中 → 已回寄 → 已完成`（另有已取消）。
- **子状态**：报价 `quote_status`、付款 `payment_status`、质保 `warranty_status` / `charge_type` 不塞进主状态，前端按「主状态 + 子状态」统一派生显示标签，小程序首页、我的、详情三处口径一致。
- **后端为唯一来源**：支付 / 确认 / 收货后强制回拉工单详情，不在本地缓存里猜状态。
- **闭环动作**：报价确认 / 拒绝维修 → 微信支付或对公转账上传凭证 → 客户确认收货 → 服务评价回访（不满意自动转投诉）。
- **身份桥**：小程序下单时按手机号 / openid 自动匹配或建档 CRM 客户（`cicada_customers`），并把 `customer_id` 回写到工单与设备档案，使小程序与后台是“同一个客户”。
- **设备档案沉淀**：报修提交 / 维修完成时按 SN 自动新增或更新设备档案（型号、购机日期、推算质保到期、历史工单），与后台 CRM 设备台账合流。

## 目录结构

```text
docte-master/                客户端小程序 + 共用 uniCloud 后端（运行版本）
├─ api/                      小程序接口封装
├─ pages/                    小程序页面
├─ components/               小程序组件
├─ store/                    小程序状态管理
├─ utils/                    请求、云函数和通用工具
├─ config/                   资源和业务配置
├─ static/                   小程序静态资源
└─ uniCloud-alipay/          云函数、数据库 schema、公共模块和索引说明
pc-admin/                    PC 管理后台
docs/                        Agent / 协作文档
scripts/                     本地检查脚本
CLAUDE.md                    仓库导览与架构说明（最权威）
goal.md / DEPLOY_GOAL.md     阶段性 / 部署验收目标
INDEX_TASK.md                数据库索引创建说明
后端对接任务清单.md          后端接口补齐清单
```

## 环境要求

- Node.js `>= 20.19.0`
- npm
- 微信开发者工具
- HBuilderX 或 uni-app CLI
- 已关联的 uniCloud 云空间（本项目使用支付宝云，目录为 `docte-master/uniCloud-alipay/`）

## 用户端小程序运行

在 `docte-master/` 目录下执行：

```bash
npm install
npm run dev:mp-weixin     # 开发构建，产物在 unpackage/dist/dev/mp-weixin
npm run build:mp-weixin   # 生产构建，产物在 unpackage/dist/build/mp-weixin
npm run check             # 等同 build:mp-weixin，作为本地验收检查
```

构建完成后用微信开发者工具打开对应产物目录预览。

## PC 管理后台运行

```bash
cd pc-admin
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev                  # 默认 http://localhost:5173
npm run build                # 产物输出到 dist/
```

后台通过 URL 化云函数访问 uniCloud，需要在 `pc-admin/.env.local` 或 `pc-admin/src/config/api.js` 中配置实际云函数地址。更多说明见 `pc-admin/配置指南.md`。

## uniCloud 配置

云函数位于 `docte-master/uniCloud-alipay/cloudfunctions/`：

- `cicada-client-user`：用户登录、资料、投诉建议提交
- `cicada-client-order`：客户工单、在保判定、支付、订阅消息
- `cicada-client-public`：公共内容、政策、指南和知识库
- `cicada-admin-order`：后台工单、配件库存、结算、退款、SLA（也承载工单列表的客户摘要与脱敏）
- `cicada-admin-customer`：客户档案（CRM）、设备台账、历史工单、合规日志
- `cicada-admin-kb`：后台故障知识库
- `cicada-admin-sys`：系统、员工、配置和投诉处理闭环
- `cicada-maintenance`：维护和后台清理任务

云函数改动经 HBuilderX「上传并部署」生效；后台云函数需开启 **URL 化**并在 PC 后台配置对应地址。

上线前需要在 uniCloud 控制台手动创建数据库索引，尤其是：

- `cicada_orders.order_no` 唯一索引
- 用户工单查询相关的 `user_id + create_time` 复合索引
- 后台状态筛选相关的 `status + create_time` 复合索引

完整索引说明见 `INDEX_TASK.md` 和 `docte-master/uniCloud-alipay/database/INDEXES.md`。

## 关键环境变量

微信登录：`WX_APPID`、`WX_SECRET`

微信支付（含退款）：

- `WX_PAY_APPID`、`WX_PAY_MCH_ID`、`WX_PAY_SERIAL_NO`、`WX_PAY_NOTIFY_URL`
- `WX_PAY_PRIVATE_KEY` 或 `WX_PAY_PRIVATE_KEY_BASE64`
- `WX_PAY_API_V3_KEY`

订阅消息：

- `WX_SUBSCRIBE_TEMPLATE_REPAIR_SUBMITTED`
- `WX_SUBSCRIBE_TEMPLATE_ORDER_RECEIVED`
- `WX_SUBSCRIBE_TEMPLATE_QUOTE_ISSUED`
- `WX_SUBSCRIBE_TEMPLATE_PAYMENT_CONFIRMED`
- `WX_SUBSCRIBE_TEMPLATE_ORDER_SHIPPED`
- `WX_SUBSCRIBE_TEMPLATE_ORDER_COMPLETED`
- `WX_SUBSCRIBE_TEMPLATE_REVIEW_INVITE`

不要把真实密钥写入仓库；本地示例配置参考 `.env.example` 和 `pc-admin/.env.example`。完整上线配置逐条清单见 `docte-master/上线配置清单.md`。

## 接口约定

- 统一返回结构：`{ code, msg, data }`，`code = 0` 表示成功
- 认证请求携带 `Authorization: Bearer {token}`
- 遇到 `401`、`1004` 或 `100401` 时前端清理登录态并跳转登录
- 小程序主流程以 uniCloud 云对象调用为主，微信手机号登录走 `cicada-client-user.login({ code, phoneCode })`

## 上线前检查

1. 创建并核对数据库索引。
2. 配置微信登录、支付（含退款）和订阅消息环境变量。
3. 部署所有 uniCloud 云函数。
4. 开启后台云函数 URL 化，并更新 PC 后台接口地址。
5. 运行小程序和 PC 后台构建检查。
6. 用准生产数据验证报修、在保判定、报价、支付 / 退款、发票、物流、回访与订阅消息闭环。

## 参考文档

- `CLAUDE.md`（仓库导览与架构说明，最权威）
- `docte-master/上线配置清单.md`（微信支付 / 订阅模板 / 索引逐条配置清单）
- `AFTERSALES_QUOTE_GOAL.md` / `AFTERSALES_DEPLOY_ACCEPTANCE.md`（售后报价与验收目标）
- `SCALING_GUIDE.md`（约 1000 用户容量调优）
- `后端对接任务清单.md`
- `pc-admin/README.md`、`pc-admin/配置指南.md`
- `docte-master/uniCloud-alipay/database/INDEXES.md`
