# Database Index Checklist

Create these indexes before production traffic.

> **Alipay Cloud warning:** Do not deploy indexes containing `long`, `int`,
> `bool`, `double`, or `array` fields with the current HBuilderX CLI. In the
> production space, `cloud functions --initdatabase true` silently created
> those fields as `varchar` even though the `.index.json` files specified the
> correct types. Use the web console for non-`varchar` indexes and verify the
> rendered type after creation. The CLI is currently safe only for indexes
> whose fields are all `varchar`.

## Production deployment status (2026-07-20)

Cloud space: `env-00jy6g4qwi94` (`cicada-aftersales`).

- The CLI reported 58 of 70 checklist indexes as created or confirmed, but a
  console audit later found 43 non-`varchar` index definitions were rendered as
  `varchar`. These indexes are not accepted as correctly deployed.
- The following 12 indexes were rejected and must be inspected in the web console
  and/or have their existing data cleaned before retrying:
  - `cicada_users.idx_username`
  - `cicada_orders.idx_order_no`
  - `cicada_orders.idx_payment_create`
  - `cicada_orders.idx_inventory_status_create`
  - `cicada_orders.idx_invoice_status_create`
  - `cicada_orders.idx_ship_out_logistics_no`
  - `cicada_orders.idx_ship_back_logistics_no`
  - `cicada_user_devices.idx_sn`
  - `cicada_customers.idx_phone`
  - `cicada_customer_tags.idx_name`
  - `cicada_rate_limits.idx_key`
  - `cicada_parts.idx_part_code`
- Do not weaken unique indexes to make deployment pass. Export and inspect the
  affected collection first. For optional unique fields, use a sparse unique
  index in the web console when supported.

### Read-only diagnostic findings

On 2026-07-20, a local-only cloud-object probe connected to this space without
uploading a diagnostic function. It scanned the current collections and found:

- `cicada_orders.order_no`: 3 records, all non-empty strings, no duplicates.
- `cicada_user_devices.sn`: 3 records, all non-empty strings, no duplicates.
- `cicada_rate_limits.key`: 49 records, all non-empty strings, no duplicates.
- `cicada_users.username`: 5 of 10 records omit `username`; use sparse unique if
  username uniqueness is required.
- `cicada_customers.phone`: 3 empty strings and one duplicated test number; this
  is not a unique-index candidate.
- Missing order fields (`inventory_status`, some invoice/logistics fields) are
  optional legacy fields, not type conflicts.

Retrying the rejected ordinary indexes and unique indexes with fresh names also
returned `BIZ_EXCEPTION`. This indicates an equivalent field-pattern index may
already exist under another name, or the Alipay index API rejects duplicate
patterns; HBuilderX CLI provides no index-list command. Before any cleanup,
open each affected collection's **索引管理** tab and record the actual index
name, fields, direction, and Unique/Sparse flags. The critical acceptance check
is that `cicada_orders.order_no` is genuinely Unique.

The CLI invocation used for an isolated project bound to this cloud space was:

```powershell
& "E:\HBuilderX.5.07.2026041006\HBuilderX\cli.exe" cloud functions `
  --initdatabase true --prj docte-index-deploy --provider alipay
```

## cicada_users

- `token` — 登录态校验 `where({ token })` 全靠它（verifyUserToken / verifyAdminToken）。**务必保持健康**：若客户端登录后用刚写入的 token 调接口报"鉴权失败"、而记录在库里确实存在且 token 一致，说明该索引未收录新写入项——**删除后重建** `idx_token` 即可恢复。
- `openid`
- `username` — **若建唯一索引，必须勾选「稀疏 sparse」**。客户端用户（role=user / 微信登录）不写 `username`，非稀疏的唯一索引会把多条"空 username"判为重复，导致**所有新用户注册失败**（报 `document is already exists`）。员工账号才有 username，稀疏唯一即可同时保证员工用户名唯一、又放行无 username 的客户。
- `email` — 后台员工找回密码使用，建立 **Unique + Sparse** 索引；小程序客户不写该字段。
- `role`

## cicada_password_resets

- `email_hash, create_time desc`
- `expires_at` — 请求找回密码时会顺带清理过期超过 24 小时的记录；仍建议在控制台配置 TTL。该集合只保存邮箱和验证码的 HMAC，不保存明文。

## cicada_orders

- `order_no` unique
- `create_time desc`
- `user_id, create_time desc`
- `customer_id, create_time desc`   # 身份桥：后台按 CRM 客户查历史工单（listCustomerOrders）
- `status, create_time desc`
- `engineer_id, create_time desc`
- `payment_status, create_time desc`
- `quote_status, create_time desc`
- `refund_status, create_time desc`
- `inventory_status, create_time desc`
- `invoice_info.need_invoice, invoice_info.status, create_time desc`
- `ship_out_info.logistics_no`
- `ship_back_info.logistics_no`

## cicada_order_items

- `order_id`
- `sn_normalized` — SN 容错检索键（lookupDeviceBySn 按 SN 跨工单查历史；回填见 cicada-maintenance.backfillSnNormalized）

## cicada_user_devices

- `user_id, create_time desc`
- `user_id, sn`
- `user_id, sn_normalized` — 按规范化键检索本人设备（lookupDeviceBySn / 设备沉淀去重）
- `sn_normalized` — SN 容错检索键（大写、去空格/横杠）；全局查重与后台 lookupDeviceBySn 使用
- `customer_id, create_time desc`
- `sn` — **UNIQUE**（同一物理设备序列号全局唯一，防止跨账号重复绑定；建唯一索引前需先清洗存量重复 SN）

## cicada_customers

- `status, create_time desc`
- `customer_type, status`
- `phone`  （手机号重复校验）
- `user_id`
- `openid`
- `dealer_id`
- `tags`  （多键索引，按标签筛选）

## cicada_customer_tags

- `name` unique
- `sort, create_time`

## cicada_customer_logs

- `target_id, create_time desc`
- `create_time desc`

## cicada_addresses

- `user_id`

## cicada_feedbacks

- `user_id, create_time desc`
- `status, create_time desc`
- `type, create_time desc`        # 后台按反馈类型筛选
- `urgency, create_time desc`     # 后台按紧急等级筛选（高危预警/排序）

> 后台 `cicada-admin-sys.getFeedbackList` 已改为 DB 端分页 + 状态/类型/紧急度筛选；关键词（内容/工单号/联系方式）走正则 `$or`，量大时建议另配文本索引或限制扫描范围。
> 投诉处理流转（分配/回复/回访/结案/升级）复用 `cicada_order_events`，`action` 取 `feedback_*`，`order_no` 为关联工单号或 `FB-<id>`。

## cicada_fault_kb

- `category_id`

## cicada_product_categories

- `status, sort asc`

## cicada_rate_limits

- `key` unique
- `reset_time`

## cicada_subscription_logs

- `order_id, create_time desc`
- `user_id, create_time desc`
- `scene, create_time desc`
- `status, create_time desc`
- `dedupe_key, status` — 自动业务通知发送前检查是否已有成功记录；需在控制台手工创建普通索引。

## cicada_order_events

- `order_id, create_time desc`
- `order_no, create_time desc`
- `action, create_time desc`
- `actor_id, create_time desc`

## cicada_sn_logs

- `create_time desc`                 # 全局 SN 扫码/查询埋点日志，按时间倒序查看
- `sn_normalized, create_time desc`  # 按设备 SN 聚合操作轨迹
- `source, action, create_time desc` # 按来源端/操作类型筛选

## cicada_parts

- `part_code` unique
- `part_name`
- `enabled, create_time desc`
- `stock, warning_threshold`

## cicada_inventory_flows

- `part_id, create_time desc`
- `order_id, create_time desc`
- `order_no, create_time desc`
- `flow_type, create_time desc`

## cicada_surveys

- `create_time desc`
- `status, create_time desc`
- `contact`
- `order_no`

## cicada_guides

- `type`
- `sort`

## Notes

- Keep `order_no` unique. The code now uses a time prefix plus 32 bits of random suffix, but the unique index is still the final guard.
- Clean old `cicada_rate_limits` records periodically by deleting rows whose `reset_time` is older than the current timestamp.
- Run `cicada-maintenance.run({ token, dryRun: true })` before changing production data.
