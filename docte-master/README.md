# CICADA 微信小程序与 uniCloud 后端

`docte-master/` 是 CICADA 牙科设备检修系统的微信小程序运行版本，同时包含小程序与 PC 管理后台共用的 uniCloud（支付宝云）后端。

> 仓库根目录的 `App.vue`、`main.js`、`pages.json` 等文件属于不完整的历史副本。小程序开发、构建和云函数部署均以本目录为准。

## 技术栈

- uni-app + Vue 3
- 微信小程序
- uniCloud 云对象、云函数与云数据库
- 微信支付 API v3
- 微信订阅消息
- 外部物流查询与回调

## 主要功能

- 微信手机号登录、用户资料与收货地址
- 设备报修、图片 / 视频上传、设备 SN 绑定
- 维修进度、报价确认或拒绝、付款与回寄物流
- 质保状态判定、设备档案和历史工单
- 投诉建议、服务评价与回访闭环
- 对公转账凭证和结构化发票信息
- 保修政策、收费办法、故障知识库和操作指南
- 客服、公众号、CICADA 服务号及产品维护视频入口

## 目录结构

```text
api/                          小程序接口封装
components/                   通用组件
config/                       资源与业务配置
pages/                        主包页面
pages-sub/                    分包页面
store/                        客户端状态管理
utils/                        云函数调用、认证与通用工具
static/                       小程序静态资源
scripts/                      构建和安全检查脚本
uniCloud-alipay/
├─ cloudfunctions/            客户端、管理端和维护云函数
│  └─ common/                 状态机、权限、支付和物流等共享模块
└─ database/                  数据库 schema、初始化数据与索引说明
```

## 本地运行

环境要求：

- Node.js `>= 20.19.0`
- npm
- 微信开发者工具
- HBuilderX 或 uni-app CLI

安装依赖并构建开发版：

```bash
npm install
npm run dev:mp-weixin
```

开发构建输出到 `unpackage/dist/dev/mp-weixin/`，使用微信开发者工具打开该目录。

生产构建与本地验收：

```bash
npm run build:mp-weixin
npm run check
```

`npm run check` 会依次执行生产构建、构建产物检查、客户端密钥扫描和微信小程序主包体积检查；这是本项目的小程序本地验收门禁。

## 调用架构

小程序业务数据统一通过 uniCloud 云对象或云函数访问，不使用独立 HTTP 网关：

```text
页面 / 组件
  -> api/*.js
  -> utils/cloud.js 自动注入 token
  -> uniCloud 云对象 / 云函数
  -> cicada_* 数据集合
```

登录成功后的 token 保存于 `uni.getStorageSync('token')`。接口返回 `code: 401` 时，客户端会清理登录状态并跳转登录页。

## 云函数

客户端云函数：

- `cicada-client-user`：登录、用户资料、投诉建议
- `cicada-client-order`：报修工单、报价、质保、支付、物流与订阅消息
- `cicada-client-public`：政策、指南、故障知识库和公共配置

管理端云函数：

- `cicada-admin-sys`：后台登录、员工、设置和反馈闭环
- `cicada-admin-order`：工单、配件、库存、结算、物流、退款和发票
- `cicada-admin-kb`：故障知识库与分类
- `cicada-admin-customer`：CRM、设备台账、标签与合规日志

其他服务：

- `cicada-express-callback`：物流服务商回调
- `cicada-maintenance`：数据维护、清理与 SN 归一化回填
- `cloudfunctions/common/cicada-order-workflow`：订单状态机与 RBAC 唯一真相

管理端云函数由 `pc-admin/` 通过 URL 化 HTTPS 接口访问。新增或修改管理端方法后，需要在 uniCloud 控制台重新部署云函数，并确认 URL 化配置仍然有效。

## 核心业务约定

订单主状态流：

```text
已提交 -> 运输中 -> 已签收 -> 检测中 -> 维修中 -> 已回寄 -> 已完成
```

`quote_status`、`payment_status`、`warranty_status` 和 `charge_type` 是独立子状态，不应塞入主状态。状态转换和员工权限统一维护在 `common/cicada-order-workflow`。

设备 SN 会执行 `trim -> upperCase -> 删除空格和连字符` 的归一化。该规则在多个云函数中有意保留相同副本，修改时必须同步所有 `normalizeSn` 实现。

微信支付采用自建 API v3 流程。客户端 `uni.requestPayment` 成功仅表示收银台流程完成，实际付款状态必须由服务端回调验签或主动查单确认。微信支付订单不进入发票流程；只有已完成且已核销的对公转账订单可以申请并登记发票。

## 云环境配置

敏感配置必须写入 uniCloud 云函数环境变量，不得写入客户端代码或提交到 Git。主要配置包括：

- 微信登录：`WX_APPID`、`WX_SECRET`
- 微信支付：`WX_PAY_APPID`、`WX_PAY_MCH_ID`、`WX_PAY_SERIAL_NO`、`WX_PAY_NOTIFY_URL`
- 支付密钥：`WX_PAY_PRIVATE_KEY` 或 `WX_PAY_PRIVATE_KEY_BASE64`、`WX_PAY_API_V3_KEY`
- 微信支付公钥：`WX_PAY_PUBLIC_KEY_ID`、`WX_PAY_PUBLIC_KEY` 或 `WX_PAY_PUBLIC_KEY_BASE64`
- 订阅消息：`WX_SUBSCRIBE_TEMPLATE_*`
- 物流服务：`EXPRESS_PROVIDER`、`KUAIDI100_*`

完整变量归属和配置步骤见 [`上线配置清单.md`](上线配置清单.md) 与 [`uniCloud-alipay/微信支付与一键开票配置.md`](uniCloud-alipay/微信支付与一键开票配置.md)。

## 数据库与索引

数据库集合统一使用 `cicada_` 前缀，schema 位于 `uniCloud-alipay/database/`。索引不会随代码自动创建，必须在 uniCloud 控制台手动配置。

至少确认：

- `cicada_orders.order_no` 为唯一索引
- 用户工单查询使用 `user_id + create_time` 复合索引
- 后台状态筛选使用 `status + create_time` 复合索引
- `cicada_users.username` 索引为 sparse

完整清单见 [`uniCloud-alipay/database/INDEXES.md`](uniCloud-alipay/database/INDEXES.md)。

## 部署顺序

1. 在 uniCloud 控制台配置云函数环境变量。
2. 创建并核对数据库索引。
3. 上传并部署 `common/` 依赖和业务云函数。
4. 为管理端云函数开启 URL 化，更新 `pc-admin` 的接口地址。
5. 执行 `npm run check`，再用微信开发者工具进行真机预览。
6. 使用准生产数据验收报修、报价、付款、物流、发票、回访和订阅消息闭环。

## 相关文档

- [`../README.md`](../README.md)：项目总览与双端快速开始
- [`../CLAUDE.md`](../CLAUDE.md)：权威架构说明
- [`上线配置清单.md`](上线配置清单.md)：上线配置逐项清单
- [`uniCloud-alipay/database/INDEXES.md`](uniCloud-alipay/database/INDEXES.md)：数据库索引
- [`uniCloud-alipay/微信支付与一键开票配置.md`](uniCloud-alipay/微信支付与一键开票配置.md)：支付与发票配置
- [`../pc-admin/README.md`](../pc-admin/README.md)：PC 管理后台说明
