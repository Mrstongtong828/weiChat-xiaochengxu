# 牙医仪器检修用户端

这是一个基于 `uni-app + Vue 3` 的微信小程序前端，面向牙医仪器维修场景，主要给客户使用，用于报修、查进度、查包裹、看政策和联系客服。

## 重要提示：前端进度与交接边界

当前 `master` 已经完成“小程序最新版前端 + 原 uniCloud 后台”的融合：

- 旧版小程序前端已经替换为最新版用户端前端。
- 原仓库中的 `uniCloud-alipay/` 后台代码、数据库结构和索引说明已保留。
- 前端页面、交互、路由、底部导航、地址管理页、用户中心页和首页业务模块已整理完成。
- 已执行 `npm run check`，微信小程序生产构建通过。
- 后台同学接手后，重点不是继续替换前端，而是按接口清单补齐后端数据、状态流转和云环境配置。

当前前端进度可以按下面理解：

| 模块 | 前端进度 | 后端需要关注 |
| --- | --- | --- |
| 微信手机号登录 | 页面已接入，走 `cicada-client-user.login({ code, phoneCode })` 云对象 | 配置 `WX_APPID`、`WX_SECRET`，确认 `token + userInfo` 返回 |
| 报修提交 | 页面、表单校验、图片/视频上传入口已完成 | 实现 `/repair/submit`，保存工单和产品明细 |
| 维修进度 | 列表、详情、状态展示已完成 | 实现 `/repair/list`、`/repair/detail`，返回状态和时间线 |
| 包裹查询 | 查询入口和结果展示已完成 | 实现 `/package/query`，维护快递单号签收和处理状态 |
| 政策/客服 | 展示入口已完成 | 实现政策、客服和联系方式接口 |
| 地址/投诉/发票/产品 | 前端入口和部分本地体验逻辑已预留 | 可分阶段补接口，详见 `后端对接任务清单.md` |

请后台同学优先阅读：

- `后端对接任务清单.md`
- `api/content.js`
- `pages/index/index.vue`
- `pages/login/index.vue`
- `uniCloud-alipay/cloudfunctions/cicada-client-user/index.obj.js`
- `uniCloud-alipay/database/INDEXES.md`

## 交接说明

- 前端主流程现在以 `api/content.js` 的 HTTP 接口为主。
- 登录页目前仍保留 `uniCloud.importObject('cicada-client-user')` 的云对象调用方式。
- `api/auth.js`、`api/repair.js` 属于旧版兼容接口，后续可以逐步统一。
- 后端同学主要关注 `api/content.js` 里的接口，以及 `pages/login/index.vue` 的登录返回结构。

## 项目运行

环境要求：

- Node.js `>= 20.19.0`
- 微信开发者工具
- HBuilderX（可选）

安装依赖：

```bash
npm install
```

本地配置接口地址：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

小程序端数据统一走 uniCloud 云对象/云函数，无独立 HTTP 网关，无需配置接口地址。

开发运行：

```bash
npm run dev:mp-weixin
```

生产构建：

```bash
npm run build:mp-weixin
```

交接检查：

```bash
npm run check
```

输出目录：

- 开发版：`unpackage/dist/dev/mp-weixin`
- 生产版：`unpackage/dist/build/mp-weixin`

## 页面入口

`pages.json` 当前已注册页面：

- `pages/index/index`
- `pages/login/index`
- `pages/company/index`
- `pages/mine/index`
- `pages/address/index`

## 主要目录

```text
api/                    接口封装
pages/                  页面
store/                  状态管理
utils/                  请求和云函数封装
config/                 图片和资源配置
static/                 静态资源
uniCloud-alipay/        uniCloud 后端
cloudfunctions/         旧版云函数兼容目录
unpackage/              编译输出
```

## 请求约定

- HTTP 统一返回：`{ code, message, data }`
- `code = 0` 表示成功
- 请求头自动带 `Authorization: Bearer {token}`
- 遇到 `401 / 1004 / 100401`，前端会清理登录态

## 当前后端对接重点

### 登录

- 登录页使用 `cicada-client-user`
- 需要返回 `token` 和 `userInfo`
- 若要统一成 HTTP，也可以改成 `/auth/login`、`/auth/wechat-login`

### 首页主流程

当前前端主要使用这些接口：

- `POST /repair/submit`
- `GET /repair/list`
- `GET /repair/detail`
- `GET /package/query`
- `POST /upload/image`
- `POST /upload/video`
- `GET /common/contact`
- `GET /common/customer-service`
- `GET /policy/warranty`
- `GET /policy/fee`

说明：当前微信手机号登录已统一走 `cicada-client-user.login({ code, phoneCode })` 云对象：`code` 用于换取 openid，`phoneCode` 用于换取手机号。若后端后续希望登录也改成 HTTP，再补 `/auth/login` 或 `/auth/wechat-login` 并同步改前端登录调用。

### 微信支付

当前支付方案是“uni-app 客户端接口 + 自建微信支付 API v3 云端流程”，没有接入 `uni-pay`：

| 层级 | 当前实现 | 职责 |
| --- | --- | --- |
| 小程序页面 | `uni.requestPayment` | 使用 uni-app 统一接口拉起微信收银台 |
| 小程序 API 层 | `api/repair.js` | 调用 `createWechatPayPayment` / `syncWechatPayPayment` |
| 云函数 | `cicada-client-order` | 校验工单和金额、创建 JSAPI 预支付单、生成签名参数、验签解密回调、向微信查单 |
| 后台云函数 | `cicada-admin-order` | 退款、线下转账核销和财务对账 |

`uni.requestPayment` 只负责拉起支付，不能代替服务端下单、签名、回调验签和查单。`uni-pay` 是另一套可选的云端支付模块，若迁移需要同时改造云函数、环境变量、回调和订单状态闭环，不是替换一个前端方法。本项目当前仅面向微信小程序支付，继续采用现有 API v3 实现。

```text
小程序请求 createWechatPayPayment
  -> cicada-client-order 调用微信支付 API v3 创建 JSAPI 预支付单
  -> 小程序调用 uni.requestPayment 拉起微信收银台
  -> 微信异步通知，或小程序调用 syncWechatPayPayment 触发服务端查单
  -> 仅当微信返回 SUCCESS 且商户号、AppID、金额均匹配时写入 payment_status=paid
```

前端 `uni.requestPayment` 的成功回调只表示收银台流程完成，不能作为到账依据。工单支付状态始终以服务端验签回调或主动查单结果为准。

企业客户仍可走线下对公转账，备用入口会调用 `uploadPaymentProof`，订单会写成 `payment_status=uploaded` 和 `payment_method=offline_transfer`，后台再人工核销。

上线前需要在 uniCloud 云函数环境变量中配置以下微信支付参数：下单、查单和支付回调参数配置到 `cicada-client-order`；退款所需参数同步配置到 `cicada-admin-order`。各变量归属见 [`uniCloud-alipay/微信支付与一键开票配置.md`](uniCloud-alipay/微信支付与一键开票配置.md)。

- `WX_PAY_APPID`
- `WX_PAY_MCH_ID`
- `WX_PAY_SERIAL_NO`
- `WX_PAY_NOTIFY_URL`
- `WX_PAY_PRIVATE_KEY` 或 `WX_PAY_PRIVATE_KEY_BASE64`
- `WX_PAY_API_V3_KEY`
- `WX_PAY_PUBLIC_KEY_ID`
- `WX_PAY_PUBLIC_KEY` 或 `WX_PAY_PUBLIC_KEY_BASE64`

当前采用微信支付公钥模式。`WX_PAY_SERIAL_NO` 是商户 API 证书序列号；`WX_PAY_PUBLIC_KEY_ID` 是微信支付公钥 ID，两者不能混用。支付 API 成功响应和异步通知都会校验 `Wechatpay-Serial` 与公钥 ID，并使用下载的微信支付公钥验签。

`WX_PAY_NOTIFY_URL` 需要配置成 URL 化后的 `cicada-client-order/wechatPayNotify` 地址。`admin.cicadadental.cn` 当前是 PC 后台静态托管域名，只有在网关已将请求体及全部 `Wechatpay-*` 请求头原样代理到云函数时，才能作为支付回调域名。

### 订阅消息提醒

小程序只会在本机首次提交报修、确认支付、补录物流、上传对公转账凭证或申请开票时请求一次订阅消息授权；同意、拒绝或关闭后均不再弹出，查看页面不会触发授权。后台状态变更、报价发布、付款核销、微信支付到账后，云函数会尝试发送订阅消息，并把结果写入 `cicada_subscription_logs`。

上线前需要在相关云函数环境变量中配置：

- `WX_APPID`
- `WX_SECRET`
- `WX_SUBSCRIBE_TEMPLATE_REPAIR_SUBMIT`
- `WX_SUBSCRIBE_TEMPLATE_DEVICE_RECEIVE_SHIP`
- `WX_SUBSCRIBE_TEMPLATE_PAYMENT_QUOTE`
- `WX_SUBSCRIBE_TEMPLATE_PROCESS_TIP`
- `WX_SUBSCRIBE_TEMPLATE_ORDER_FINISH_INVOICE`

也支持使用 `WECHAT_SUBSCRIBE_TEMPLATE_*` 作为模板 ID 变量前缀。5 套模板的关键词已通过微信官方接口核对，统一由 `cicada-subscription-message` 公共模块构造；完整映射和各场景标准文案见 [`订阅消息填参规范.md`](订阅消息填参规范.md)。

当前这 5 套模板 ID 如下：

| 模板用途 | 环境变量 | 模板 ID |
| --- | --- | --- |
| 报修受理通知 | `WX_SUBSCRIBE_TEMPLATE_REPAIR_SUBMIT` | `16rLpYERsxE1vW8lG9EH2SKAntV2RQQyCuAgOVhuZTk` |
| 设备取货通知 / 回寄发货 | `WX_SUBSCRIBE_TEMPLATE_DEVICE_RECEIVE_SHIP` | `584ePu61H_23o-61K8C_-_rCHnXhlPijAr28zR0_kmk` |
| 待支付提醒 / 维修报价 / 付款成功 / 付款驳回 | `WX_SUBSCRIBE_TEMPLATE_PAYMENT_QUOTE` | `MZ4vej3PNhckxP5JnmjfigQgX14sjuMyN6wk_6Pppsc` |
| 报修进度提醒 | `WX_SUBSCRIBE_TEMPLATE_PROCESS_TIP` | `YbAYEPlqOlYlELUPUEpUHC8PmQ008RiTBK7DUAStQ4` |
| 工单完成通知 / 发票开具 | `WX_SUBSCRIBE_TEMPLATE_ORDER_FINISH_INVOICE` | `TIqcHTeH2T900ANDd5r8L_M6kYMYCtfl9DjkmuXLAFE` |

手动验收流程：

1. 在微信公众平台申请并启用上述订阅消息模板。
2. 在 uniCloud 控制台配置 `WX_APPID`、`WX_SECRET` 和模板 ID 环境变量，并重新部署 `cicada-client-public`、`cicada-client-order`、`cicada-admin-order`。
3. 在 `pc-admin` 中配置 `.env.local` 指向当前云空间，运行 `npm run check:urls`，确认后台 URL 化已命中最新部署的 `cicada-admin-order`。
4. 运行 `npm run check:subscription`，确认所有订阅场景模板 ID 均已配置；任一场景显示 `missing` 时，订阅消息真机验收不能视为通过。
5. 用真机首次提交报修，确认只出现一次订阅授权弹窗；同意、拒绝或关闭后主流程均应继续，随后进入进度页和再次操作均不再弹出。
6. 在后台发布报价、核销付款、导入签收/回寄物流或修改工单状态，确认用户端能收到对应订阅消息。
7. 查询 `cicada_subscription_logs`，确认成功记录为 `sent`；未配置模板、缺少 openid、发送失败时分别记录 `skipped` 或 `failed`，且后台主流程不失败。

### Goal 验收清单

当前 `goal.md` 覆盖发票闭环、后台服务端分页、页面拆分、待办中心和订阅消息提醒。除本地构建检查外，上线前建议按下面顺序做真实环境验收：

1. 发票闭环：用已付款或已完成/已回寄工单在小程序提交发票申请，确认 `cicada_orders.invoice_info` 写入 `need_invoice=true`、`status=待开票`、抬头、税号、邮箱和备注；后台工单页能看到这些字段；后台改为 `已开具` 后，小程序刷新能看到最新状态。
2. 分页和筛选：准备超过 100 条工单数据，在后台验证第 101 条及之后可通过分页看到；关键词、状态、设备型号、发票状态和待办筛选的总数与云函数 `getAdminOrderList` 返回的 `total` 一致；当前筛选全部导出时，导出提示数量与文件行数一致。
3. 批量操作刷新：分别执行物流签收导入、回寄物流导入、报价发布、付款核销和发票状态更新，确认操作后列表仍保留当前筛选/分页语境并显示最新数据。
4. 待办中心：用覆盖待签收、待报价、待核销、待开票、待回寄、异常工单的测试数据，确认后台首页每组数量与进入工单页后的筛选 `total` 一致；无 token 或无效 token 时应跳转登录或显示错误，不应误报为 0。
5. 订阅消息：在微信开发者工具或真机完成授权、拒绝授权和模板发送失败三种路径验证；确认拒绝或发送失败不阻塞报修、报价确认、付款、后台状态更新等主流程，且 `cicada_subscription_logs` 有可追踪记录。

### 交互预留

前端还预留了这些能力，后端接入后可完善：

- 发票申请与列表
- 收货地址管理
- 投诉建议
- 产品列表
- 故障知识库
- 管理后台相关接口

## 后端补充建议

- 优先确认 `uniCloud-alipay/database/INDEXES.md` 里的索引是否已创建。
- 微信登录云对象需要在 uniCloud 环境变量中配置 `WX_APPID` 和 `WX_SECRET`，不要把 AppSecret 写进代码。
- `config/cicada-assets.js` 里的图片链接需要替换成可访问的 CDN 地址。
- 如果登录方式要统一，建议先确认前端登录页是否继续保留云对象方式。

## 相关文件

- `api/content.js`
- `api/auth.js`
- `api/repair.js`
- `pages/login/index.vue`
- `utils/cloud.js`
- `uniCloud-alipay/database/INDEXES.md`
- `后端对接任务清单.md`
