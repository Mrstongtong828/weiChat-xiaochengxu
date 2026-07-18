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
| idx_status_create | status | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | create_time | -1 | | |
| idx_engineer_create | engineer_id | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | create_time | -1 | | |

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
| idx_user_sn | user_id | 1 | 否 | 复合索引，同一面板添加两个字段 |
| | sn | 1 | | |

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
