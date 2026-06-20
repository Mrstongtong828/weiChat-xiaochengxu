# 牙医仪器检修管理系统

这是一个面向牙科设备售后维修场景的多端项目，包含客户使用的微信小程序、管理员和工程师使用的 PC 后台，以及共用的 uniCloud 云函数和数据库结构。

## 项目组成

| 模块 | 位置 | 技术栈 | 说明 |
| --- | --- | --- | --- |
| 用户端小程序 | 项目根目录 | uni-app、Vue 3、微信小程序 | 客户提交报修、查看维修进度、查询包裹、管理地址、查看政策和联系客服 |
| PC 管理后台 | `pc-admin/` | Vue 3、Vite、Element Plus、Pinia | 管理员和工程师处理工单、知识库、用户、系统设置和数据导出 |
| 云端服务 | `uniCloud-alipay/` | uniCloud 云函数、云数据库 | 用户登录、工单管理、支付同步、订阅消息、后台管理接口 |

## 核心能力

- 微信小程序客户登录和用户资料维护
- 报修工单提交、图片和视频上传入口
- 维修进度、报价确认、支付状态和回寄物流展示
- 地址、投诉建议、发票信息和产品信息入口
- PC 后台工单分页、筛选、导出、批量操作和待办中心
- 故障知识库、系统配置、用户和反馈管理
- 微信支付 JSAPI 预支付、主动查单同步和订阅消息提醒
- uniCloud 数据库 schema、初始化数据、索引说明和维护脚本

## 订单状态机与数据闭环

工单是整个系统的主线，投诉、发票、设备、物流、付款、回访都挂在**同一张工单**下，不做成独立模块。

- **主状态机**（后端唯一真相，见 `uniCloud-alipay/cloudfunctions/common/cicada-order-workflow`）：
  `已提交 → 运输中 → 已签收 → 检测中 → 维修中 → 已回寄 → 已完成`（另有已取消）。
- **子状态**：报价 `quote_status`、付款 `payment_status` 不塞进主状态，前端按「主状态 + 子状态」统一派生显示标签（待确认报价 / 待付款 / 待核款等），小程序首页、我的、详情三处口径一致。
- **后端为唯一来源**：支付/确认/收货后强制回拉工单详情，不在本地缓存里猜状态。
- **闭环动作**：报价确认 / 拒绝维修 → 微信支付或对公转账上传凭证 → 客户确认收货 → 服务评价回访（不满意自动转投诉）。
- **身份桥**：小程序用户下单时按手机号 / openid 自动匹配或建档 CRM 客户（`cicada_customers`），并把 `customer_id` 回写到工单与设备档案，使小程序与后台是“同一个客户”。
- **设备档案沉淀**：报修提交 / 维修完成时按 SN 自动新增或更新设备档案（型号、保修状态、历史工单、最近工单），与后台 CRM 设备台账合流。

## 目录结构

```text
api/                         小程序接口封装
pages/                       小程序页面
store/                       小程序状态管理
utils/                       请求、云函数和通用工具
config/                      资源和业务配置
static/                      小程序静态资源
pc-admin/                    PC 管理后台
uniCloud-alipay/             uniCloud 云函数、数据库 schema 和公共模块
scripts/                     本地检查脚本
goal.md                      阶段性验收目标
INDEX_TASK.md                数据库索引创建说明
后端对接任务清单.md          后端接口补齐清单
```

## 环境要求

- Node.js `>= 20.19.0`
- npm
- 微信开发者工具
- HBuilderX 或 uni-app CLI
- 已关联的 uniCloud 云空间（本项目使用支付宝云，目录为 `uniCloud-alipay/`）

## 用户端小程序运行

安装依赖：

```bash
npm install
```

复制本地环境变量：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

启动微信小程序开发构建：

```bash
npm run dev:mp-weixin
```

生产构建：

```bash
npm run build:mp-weixin
```

本地验收：

```bash
npm run check
```

构建产物默认输出到：

- 开发版：`unpackage/dist/dev/mp-weixin`
- 生产版：`unpackage/dist/build/mp-weixin`

## PC 管理后台运行

```bash
cd pc-admin
npm install
cp .env.example .env.local
npm run dev
```

默认本地地址为 `http://localhost:5173`。生产构建：

```bash
npm run build
```

后台通过 URL 化云函数访问 uniCloud，需要在 `pc-admin/.env.local` 或 `pc-admin/src/config/api.js` 中配置实际云函数地址。更多说明见 `pc-admin/配置指南.md`。

## uniCloud 配置

云函数位于 `uniCloud-alipay/cloudfunctions/`：

- `cicada-client-user`：用户登录和资料
- `cicada-client-order`：客户工单、支付和订阅消息
- `cicada-client-public`：公共内容、政策、指南和知识库
- `cicada-admin-order`：后台工单管理、配件库存、结算（也承载工单列表的客户摘要）
- `cicada-admin-customer`：后台客户档案（CRM）、设备台账、历史工单、合规日志
- `cicada-admin-kb`：后台故障知识库
- `cicada-admin-sys`：后台系统、用户、配置和投诉处理闭环
- `cicada-maintenance`：维护和后台任务

上线前需要在 uniCloud 控制台配置数据库索引，尤其是：

- `cicada_orders.order_no` 唯一索引
- 用户工单查询相关的 `user_id + create_time` 复合索引
- 后台状态筛选相关的 `status + create_time` 复合索引

完整索引说明见 `INDEX_TASK.md` 和 `uniCloud-alipay/database/INDEXES.md`。

## 关键环境变量

微信登录：

- `WX_APPID`
- `WX_SECRET`

微信支付：

- `WX_PAY_APPID`
- `WX_PAY_MCH_ID`
- `WX_PAY_SERIAL_NO`
- `WX_PAY_NOTIFY_URL`
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

不要把真实密钥写入仓库；本地示例配置请参考 `.env.example` 和 `pc-admin/.env.example`。完整的上线配置逐条清单见 `docte-master/上线配置清单.md`。

## 接口约定

- 统一返回结构：`{ code, message, data }`
- `code = 0` 表示成功
- 认证请求携带 `Authorization: Bearer {token}`
- 遇到 `401`、`1004` 或 `100401` 时前端会清理登录态

小程序主流程当前以 uniCloud 云对象调用为主，微信手机号登录走 `cicada-client-user.login({ code, phoneCode })`。`api/auth.js` 和 `api/repair.js` 是兼容封装，可后续继续统一调用入口。

## 上线前检查

1. 创建并核对数据库索引。
2. 配置微信登录、支付和订阅消息环境变量。
3. 部署所有 uniCloud 云函数。
4. 开启后台云函数 URL 化，并更新 PC 后台接口地址。
5. 运行小程序和 PC 后台构建检查。
6. 使用真实或准生产数据验证报修、报价、支付、发票、物流和订阅消息闭环。

## 参考文档

- `CLAUDE.md`（仓库导览与架构说明，最权威）
- `docte-master/上线配置清单.md`（微信支付 / 订阅模板 / 索引逐条配置清单）
- `SCALING_GUIDE.md`
- `后端对接任务清单.md`
- `pc-admin/README.md`
- `pc-admin/配置指南.md`
- `uniCloud-alipay/database/INDEXES.md`
