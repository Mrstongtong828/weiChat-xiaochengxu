# 千人级访问部署与容量建议

本项目包含微信小程序用户端、PC 管理端和 `uniCloud-alipay` 云函数后端。这里的“千人级访问”按日活/阶段峰值约 1000 人理解，核心目标是避免后台全量扫描、限制单次请求数据量，并让数据库索引承接主要查询压力。

## 已调整的代码策略

- `cicada-admin-order.getAdminOrderList`：无关键字/设备型号筛选时改为数据库侧分页、计数和联表查询，不再每次全量拉取后分页。
- `cicada-admin-order.getTodoSummary`：待办统计优先走数据库 `count()`，减少把全部工单拉入云函数内存。
- 复杂搜索兜底限制扫描量：`ADMIN_ORDER_FILTER_SCAN_LIMIT` 默认 `2000`，可通过云函数环境变量调整。
- 数据库索引清单已补充工单 `create_time`、支付、报价、发票、物流单号等生产索引建议。

## 生产环境建议

1. 在 uniCloud 控制台创建 `uniCloud-alipay/database/INDEXES.md` 中列出的索引。
2. 云函数配置环境变量：`ADMIN_ORDER_FILTER_SCAN_LIMIT=2000`，数据量增长后建议做独立搜索索引或冗余 `search_text` 字段。
3. PC 管理端开启 CDN/静态托管缓存，接口 URL 指向 URL 化后的当前云空间。
4. 图片/视频上传走云存储或对象存储，不要把大文件转成 base64 长期写数据库。
5. 定期运行 `cicada-maintenance.run({ token, dryRun: true })`，清理过期限流记录和检查异常数据。

## 后续可以继续增强

- 为工单写入冗余字段：`primary_product_model`、`search_text`、`invoice_status`，复杂筛选就能完全走索引。
- 将运营汇总做成每日快照表，避免管理端大范围日期统计时扫描历史工单。
- 接入对象存储 CDN、自定义域名、WAF/限流策略，应对活动峰值访问。
