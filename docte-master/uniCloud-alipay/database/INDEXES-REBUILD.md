# 索引类型修复清单（阿里云 uniCloud）

> 背景：HBuilderX CLI `--initdatabase` 把 `long/int/bool/double/array` 字段
> 静默建成了 `varchar`。受影响共 **15 个集合、43 条索引**。
> 修复方式：在 Web 控制台各集合「索引管理」tab 先**删除**类型错误的索引，
> 再按下表**手动重建**（CLI 对非 varchar 索引不可用）。删除后系统仍可运行，
> 相关查询暂时变慢，比留错类型导致写入失败安全。

## 数量核对
- cicada_orders：10 条（本清单不含，按你的控制台审计，其余留存索引均为纯 varchar）
- 以下 14 个集合：33 条需重建 + 若干纯 varchar 保留
- 10 + 33 = 43 ✓

## 类型规则
`create_time` / `reset_time` → **long**；`sort` → **int**；布尔字段 → **bool**；
`stock` / `warning_threshold` → **double**；`tags` → **array**；ID/状态/单号等 → **varchar**。

---

## A. 删除并重建（33 条）

每条：先按索引名删除 → 再按「字段(方向) 类型」重建，Unique 一律 false。

### cicada_order_events（4）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_order_create | order_id(1) varchar, create_time(-1) **long** |
| idx_order_no_create | order_no(1) varchar, create_time(-1) **long** |
| idx_action_create | action(1) varchar, create_time(-1) **long** |
| idx_actor_create | actor_id(1) varchar, create_time(-1) **long** |

### cicada_inventory_flows（4）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_part_create | part_id(1) varchar, create_time(-1) **long** |
| idx_order_create | order_id(1) varchar, create_time(-1) **long** |
| idx_order_no_create | order_no(1) varchar, create_time(-1) **long** |
| idx_flow_type_create | flow_type(1) varchar, create_time(-1) **long** |

### cicada_customer_logs（2）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_target_create | target_id(1) varchar, create_time(-1) **long** |
| idx_create_time | create_time(-1) **long** |

### cicada_customer_tags（1；注意 create_time 是升序）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_sort_create | sort(1) **int**, create_time(**1**) **long** |

### cicada_customers（2）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_status_create | status(1) varchar, create_time(-1) **long** |
| idx_tags | tags(1) **array**（多键索引） |

### cicada_feedbacks（4）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_user_create | user_id(1) varchar, create_time(-1) **long** |
| idx_status_create | status(1) varchar, create_time(-1) **long** |
| idx_type_create | type(1) varchar, create_time(-1) **long** |
| idx_urgency_create | urgency(1) varchar, create_time(-1) **long** |

### cicada_guides（1）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_sort | sort(1) **int** |

### cicada_parts（2）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_enabled_create | enabled(1) **bool**, create_time(-1) **long** |
| idx_stock_warning | stock(1) **double**, warning_threshold(1) **double** |

### cicada_product_categories（1）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_status_sort | status(1) varchar, sort(1) **int** |

### cicada_rate_limits（1）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_reset_time | reset_time(1) **long** |

### cicada_sn_logs（3）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_create_time | create_time(-1) **long** |
| idx_sn_create | sn_normalized(1) varchar, create_time(-1) **long** |
| idx_source_action_create | source(1) varchar, action(1) varchar, create_time(-1) **long** |

### cicada_subscription_logs（4）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_order_create | order_id(1) varchar, create_time(-1) **long** |
| idx_user_create | user_id(1) varchar, create_time(-1) **long** |
| idx_scene_create | scene(1) varchar, create_time(-1) **long** |
| idx_status_create | status(1) varchar, create_time(-1) **long** |

### cicada_surveys（2）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_create_time | create_time(-1) **long** |
| idx_status_create | status(1) varchar, create_time(-1) **long** |

### cicada_user_devices（2）
| 索引名 | 字段(方向) 类型 |
|---|---|
| idx_user_create | user_id(1) varchar, create_time(-1) **long** |
| idx_customer_create | customer_id(1) varchar, create_time(-1) **long** |

---

## B. 纯 varchar，类型正确 —— 保留不动
- cicada_customers：idx_customer_type_status、idx_phone、idx_user_id、idx_openid、idx_dealer_id
- cicada_guides：idx_type
- cicada_parts：idx_part_name
- cicada_sn_logs：（无纯 varchar 单列；上表 3 条均含 long）
- cicada_surveys：idx_contact、idx_order_no
- cicada_user_devices：idx_user_sn、idx_user_sn_normalized、idx_sn_normalized

## C. 唯一索引 —— 类型是 varchar（对的），但进 tab 核对 Unique/Sparse 标志
| 集合 | 索引 | 要求 |
|---|---|---|
| cicada_customer_tags | idx_name | Unique |
| cicada_parts | idx_part_code | Unique |
| cicada_rate_limits | idx_key | Unique |
| cicada_user_devices | idx_sn | Unique（重建前清洗存量重复 SN） |
| cicada_users | idx_username | **Unique + Sparse**（客户端用户无 username，非稀疏会致新用户注册全失败） |
| cicada_orders | idx_order_no | Unique（保持不动，勿动） |

> cicada_customers.idx_phone 保持**非唯一**（phone 有空串与重复，非唯一候选）。
