# 微信业务节点通知设计

## 目标

在不阻断报价、物流和快递回调主流程的前提下，为同一维修工单自动发送以下微信小程序订阅消息：

1. 后台首次发布维修报价后，提醒客户查看并确认报价。
2. 后台首次录入有效回寄快递单号后，提醒客户查看回寄物流。
3. 客户寄入快递首次进入签收状态后，提醒客户设备已到达维修中心。

用户只在小程序的自然业务操作中完成微信订阅授权，不需要逐条手工创建或申请消息。

## 现状与问题

- `cicada-admin-order` 已在报价发布、人工确认入库和回寄物流录入后调用订阅消息发送逻辑。
- `cicada-express-callback` 会接收快递100轨迹回调并更新签收缓存，但不会发送微信通知。
- `cicada-admin-order` 与 `cicada-client-order` 各自维护一份微信 access token、发送、用户查询和日志逻辑，继续复制到回调函数会形成第三份实现。
- 小程序当前只请求一次前三个模板，并使用永久本地标记阻止再次申请。微信一次性订阅被消费后，后续业务节点可能没有可发送额度。
- 人工确认入库和快递自动签收可能先后发生。如果两条路径都直接发送，会产生重复消息。

## 方案选择

采用共享通知器方案：保留 `cicada-subscription-message` 负责场景与模板字段映射，新增一个公共通知发送模块，统一负责配置读取、用户 OpenID 查询、微信 API 调用、幂等检查和发送日志。

未采用的方案：

- 在物流回调中复制发送代码：改动较少，但三份实现会持续漂移，错误修复也必须同步三处。
- 新建通知队列和定时消费者：重试能力更强，但需要新集合、调度任务和运维监控，超出本次三个节点的范围。

## 架构

### 共享场景映射

现有 `cicada-subscription-message` 继续作为模板字段的单一来源：

- `quote_issued` 使用 `PAYMENT_QUOTE`。
- `order_shipped` 使用 `DEVICE_RECEIVE_SHIP`。
- `order_received` 使用 `DEVICE_RECEIVE_SHIP`。

该模块补充生成稳定通知键所需的纯函数，但不访问数据库或网络。

### 共享通知器

新增 `cloudfunctions/common/cicada-subscription-notifier`，通过显式依赖创建通知器，避免隐藏测试依赖：

```js
const notifier = createSubscriptionNotifier({
  db,
  httpclient: uniCloud.httpclient,
  getEnvValue
})

await notifier.sendOrderSubscription(order, scene, remark, { dedupeKey })
```

通知器负责：

- 按场景读取模板 ID。
- 查询工单用户及 OpenID。
- 必要时补充首台设备资料。
- 获取并缓存微信 access token。
- 调用微信订阅消息接口。
- 在 `cicada_subscription_logs` 中记录 `sent`、`failed` 或 `skipped`。
- 在发送前检查相同 `dedupe_key` 是否已有 `sent` 日志。
- 捕获所有通知异常并返回结果，不向业务调用方抛出发送失败。

`cicada-admin-order`、`cicada-client-order` 和 `cicada-express-callback` 使用同一公共通知器。现有发送入口的业务语义保持不变。

## 触发与幂等

### 报价发布

- 触发条件：报价状态从非 `issued` 首次变为 `issued`。
- 场景：`quote_issued`。
- 幂等键：`quote_issued:<order_id>`。
- 点击消息后进入该工单报价详情。
- 保存报价草稿、重复保存已发布报价不发送。

### 回寄单号

- 触发条件：后台成功保存一个有效的回寄运单号。
- 场景：`order_shipped`。
- 幂等键：`order_shipped:<order_id>:<normalized_tracking_no>`。
- 点击消息后进入该工单物流详情。
- 相同运单号重复保存、重复导入不发送；更换为新的有效运单号时允许发送一次新消息。

### 寄入快递签收

- 触发条件：快递100对寄入段 `out` 的有效回调首次将物流状态推进为已签收。
- 场景：`order_received`。
- 幂等键：`order_received:<order_id>:<normalized_tracking_no>`。
- 点击消息后进入该工单进度或物流详情。
- 过期回调、完全重复回调、回寄段签收不触发此消息。
- 后续人工确认入库继续更新业务状态，但与自动签收共用相同幂等键，因此不会再次发送。
- 如果未配置快递100或未收到有效签收回调，人工确认入库仍可作为备用触发路径发送一次。

## 小程序授权策略

删除当前永久性的 `cicada_subscription_prompted_v1` 一次询问限制，改为按用户主动操作映射模板：

| 用户操作 | 请求模板 |
| --- | --- |
| 提交报修 | `REPAIR_SUBMIT`、`DEVICE_RECEIVE_SHIP`、`PAYMENT_QUOTE` |
| 补录寄出运单号 | `DEVICE_RECEIVE_SHIP` |
| 微信支付或上传付款凭证 | `PAYMENT_QUOTE`、`DEVICE_RECEIVE_SHIP` |
| 确认零元质保维修 | `DEVICE_RECEIVE_SHIP` |
| 拒绝维修报价 | `DEVICE_RECEIVE_SHIP` |

同一用户操作只发起一次授权请求，并使用进行中的 Promise 防止连点重复弹窗。不同业务操作可以再次请求同一个一次性模板，从而为后续节点补充可发送额度。

授权允许、拒绝、关闭或接口异常都不改变原业务请求结果。模板配置在页面加载阶段预取；若预取失败，用户操作时允许重试加载。

## 数据与兼容性

`cicada_subscription_logs` 新增可选字段 `dedupe_key`。旧日志没有该字段，不影响读取。发送幂等只针对新写入的稳定键，不回填历史记录。

模板 ID、模板关键词和现有五套模板保持不变，不新增微信公众平台模板。生产环境继续使用：

- `WX_SUBSCRIBE_TEMPLATE_PAYMENT_QUOTE`
- `WX_SUBSCRIBE_TEMPLATE_DEVICE_RECEIVE_SHIP`

快递回调云函数增加公共通知模块依赖，并继续保证快递100要求的响应结构。

## 失败处理

- 模板未配置：写 `skipped` 日志，业务成功。
- 工单没有用户或用户没有 OpenID：写 `skipped` 日志，业务成功。
- 微信 access token 或发送接口失败：写 `failed` 日志，业务成功。
- 日志写入失败：记录云函数错误日志，不反向破坏业务结果。
- 快递回调中的通知失败：仍向快递100返回成功，避免第三方因非物流错误反复重推。
- 已存在相同 `dedupe_key` 的成功日志：写入可省略，直接返回 `duplicate` 结果。

本次不增加自动重试队列。失败消息通过 `cicada_subscription_logs` 和云函数日志排查，避免引入新的调度基础设施。

## 测试与验收

### 自动测试

- 场景映射和消息字段测试继续通过。
- 幂等键对报价、回寄和寄入签收生成稳定且区分新运单号的结果。
- 公共通知器覆盖成功、模板缺失、OpenID 缺失、微信接口失败和重复键跳过。
- 物流生命周期覆盖首次签收触发、重复或过期回调不触发、回寄段不触发。
- 小程序授权映射覆盖五类用户操作，并验证不再受永久本地标记阻止。

### 本地检查

- 运行公共模块和物流回调的 Node 测试。
- 运行 `pc-admin` 的 `npm run check:subscription`。
- 在 `docte-master` 运行 `npm run check`。

### 真机验收

1. 用户提交报修并允许设备签收、报价模板。
2. 后台发布报价，用户收到报价通知并可进入对应工单。
3. 快递100首次推送寄入签收，用户收到签收通知；随后后台人工确认入库不再重复发送。
4. 用户在支付、确认质保或拒绝报价时允许回寄模板。
5. 后台录入回寄单号，用户收到回寄通知并可查看物流。
6. 分别验证拒绝授权和模板缺失，三个业务操作仍然成功且日志状态正确。

## 非目标

- 不接入公众号模板消息、客服消息或短信兜底。
- 不新增微信订阅模板或调整现有模板关键词。
- 不建立通知队列、定时重试或后台通知运营页面。
- 不改变工单状态机、报价金额规则或快递100签收后的人工入库确认流程。
