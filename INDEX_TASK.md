# uniCloud 索引创建指南

在 uniCloud Web 控制台 → 云数据库 → 对应集合 → 索引管理 中手动创建以下索引。

> **复合索引说明**：在同一个索引面板内，点击多次"添加字段"将多个字段加入同一条索引，然后统一保存。

---

## cicada_addresses

| 索引名称 | 字段名 | 索引类型 | 唯一 (Unique) | 备注 |
|---|---|---|---|---|
| idx_user_id | user_id | 1 | 否 | 单字段 |

---

## cicada_fault_kb

| 索引名称 | 字段名 | 索引类型 | 唯一 (Unique) | 备注 |
|---|---|---|---|---|
| idx_category_id | category_id | 1 | 否 | 单字段 |

---

## cicada_feedbacks

| 索引名称 | 字段名 | 索引类型 | 唯一 (Unique) | 备注 |
|---|---|---|---|---|
| idx_user_create | user_id | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | create_time | -1 | | |
| idx_status_create | status | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | create_time | -1 | | |

---

## cicada_order_items

| 索引名称 | 字段名 | 索引类型 | 唯一 (Unique) | 备注 |
|---|---|---|---|---|
| idx_order_id | order_id | 1 | 否 | 单字段 |

---

## cicada_orders

| 索引名称 | 字段名 | 索引类型 | 唯一 (Unique) | 备注 |
|---|---|---|---|---|
| idx_order_no | order_no | 1 | **是** | 单字段，必须勾选 Unique |
| idx_user_create | user_id | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | create_time | -1 | | |
| idx_customer_create | customer_id | 1 | 否 | 复合索引，后台 CRM 客户详情查历史工单 |
| | create_time | -1 | | |
| idx_status_create | status | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | create_time | -1 | | |
| idx_engineer_create | engineer_id | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | create_time | -1 | | |
| idx_payment_create | payment_status | 1 | 否 | 复合索引，按支付状态筛选/统计工单 |
| | create_time | -1 | | |
| idx_quote_create | quote_status | 1 | 否 | 复合索引，按报价状态筛选/统计工单 |
| | create_time | -1 | | |
| idx_refund_create | refund_status | 1 | 否 | 复合索引，按退款状态排查处理中/已退款订单 |
| | create_time | -1 | | |
| idx_inventory_status_create | inventory_status | 1 | 否 | 复合索引，按库存出库状态排查失败/处理中订单 |
| | create_time | -1 | | |
| idx_invoice_status_create | invoice_info.need_invoice | 1 | 否 | 复合索引，按发票需求/开票状态筛选 |
| | invoice_info.status | 1 | | |
| | create_time | -1 | | |
| idx_ship_out_logistics_no | ship_out_info.logistics_no | 1 | 否 | 单字段索引，按寄出物流单号查询 |
| idx_ship_back_logistics_no | ship_back_info.logistics_no | 1 | 否 | 单字段索引，按寄回物流单号查询 |

---

## cicada_product_categories

| 索引名称 | 字段名 | 索引类型 | 唯一 (Unique) | 备注 |
|---|---|---|---|---|
| idx_status_sort | status | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | sort | 1 | | |

---

## cicada_user_devices

| 索引名称 | 字段名 | 索引类型 | 唯一 (Unique) | 备注 |
|---|---|---|---|---|
| idx_user_create | user_id | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | create_time | -1 | | |
| idx_customer_create | customer_id | 1 | 否 | 复合索引，后台 CRM 客户详情查历史设备 |
| | create_time | -1 | | |
| idx_user_sn | user_id | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | sn | 1 | | |
| idx_sn_unique | sn | 1 | **是** | 全局 SN 唯一。创建前先清理存量重复/空 SN |

---

## cicada_subscription_logs

| 索引名称 | 字段名 | 索引类型 | 唯一 (Unique) | 备注 |
|---|---|---|---|---|
| idx_order_create | order_id | 1 | 否 | 复合索引，按工单查订阅发送记录 |
| | create_time | -1 | | |
| idx_user_create | user_id | 1 | 否 | 复合索引，按用户查订阅发送记录 |
| | create_time | -1 | | |
| idx_scene_create | scene | 1 | 否 | 复合索引，按订阅场景统计/排查 |
| | create_time | -1 | | |
| idx_status_create | status | 1 | 否 | 复合索引，按发送状态统计/排查 |
| | create_time | -1 | | |

---

## cicada_users

| 索引名称 | 字段名 | 索引类型 | 唯一 (Unique) | 备注 |
|---|---|---|---|---|
| idx_token | token | 1 | 否 | 单字段 |
| idx_openid | openid | 1 | 否 | 单字段 |
| idx_username | username | 1 | 否 | 单字段 |
| idx_role | role | 1 | 否 | 单字段 |

---

## 注意事项

- `cicada_orders.order_no` 的唯一索引是防止重复工单号的最后一道保障，**必须勾选 Unique**。
- 所有 `create_time` 字段均为降序（-1），确保按时间倒序查询时走索引。
- `cicada_rate_limits` 集合未在本任务范围内，但同样需要为 `key`（Unique）和 `reset_time` 创建索引。
