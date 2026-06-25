# Database Index Checklist

Create these indexes in the uniCloud database console before production traffic.

## cicada_users

- `token`
- `openid`
- `username`
- `role`

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

## cicada_user_devices

- `user_id, create_time desc`
- `user_id, sn`
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

## cicada_order_events

- `order_id, create_time desc`
- `order_no, create_time desc`
- `action, create_time desc`
- `actor_id, create_time desc`

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
