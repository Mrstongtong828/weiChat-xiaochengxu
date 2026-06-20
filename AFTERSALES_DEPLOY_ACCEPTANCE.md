# 售后报价 / 库存 / 结算上线验收清单

本文档用于把本次后台改造从“本地构建通过”推进到“云端 URL 化接口可验收”。

## 1. 必须部署的云函数

在 HBuilderX 中打开 `E:\小程序开发\docte\docte-master`，确认已关联 `uniCloud-alipay` 云空间后，右键上传并部署：

- `uniCloud-alipay/cloudfunctions/cicada-admin-order`
- `uniCloud-alipay/cloudfunctions/cicada-client-order`

说明：

- `cicada-admin-order` 包含三段式报价、配件库存、库存流水、结算列表、付款核销出库逻辑。
- `cicada-client-order` 包含小程序端结构化报价 `quoteDetail` 暴露逻辑。
- 当前远端 `cicada-admin-order` 仍报 `Cannot find module '../common/cicada-order-workflow'`，部署本地新版后再执行 URL 检查。

## 2. 必须创建 / 上传的数据库集合

在 uniCloud 数据库中上传 schema 或手动创建集合：

- `cicada_parts`
- `cicada_inventory_flows`

建议导入初始化样例：

- `uniCloud-alipay/database/cicada_parts.init_data.json`

## 3. 必须创建的索引

按 `docte-master/uniCloud-alipay/database/INDEXES.md` 创建新增索引：

- `cicada_parts.part_code` unique
- `cicada_parts.part_name`
- `cicada_parts.enabled + create_time desc`
- `cicada_parts.stock + warning_threshold`
- `cicada_inventory_flows.part_id + create_time desc`
- `cicada_inventory_flows.order_id + create_time desc`
- `cicada_inventory_flows.order_no + create_time desc`
- `cicada_inventory_flows.flow_type + create_time desc`

## 4. 本地检查命令

在项目根目录执行：

```bash
node scripts/check-aftersales-goal-local.mjs
```

在小程序目录执行：

```bash
cd docte-master
npm run check
```

在后台目录执行：

```bash
cd pc-admin
npm run build
npm run check:errors
npm run check:urls
```

`check:urls` 必须在云函数部署后重新执行。

## 5. 人工验收流程

1. 后台进入“配件库存管理”，新增或确认一个启用配件，库存大于 0。
2. 后台选择一个待报价工单，打开“维修报价”。
3. 点击“添加配件”，选择库存配件，确认带出编码、名称、型号、库存、销售单价。
4. 新增服务费用和其他费用，确认三类小计、自动合计、最终报价正确。
5. 保存草稿后刷新页面，确认报价仍能读回。
6. 发布报价，确认 `quote_status=issued`、`payment_status=pending`。
7. 小程序打开该工单，确认看到配件、服务、其他费用三组明细。
8. 客户确认报价后，确认 `quote_status=confirmed`、`authorization_status=confirmed`。
9. 上传付款凭证或走支付后，后台“结算管理”能看到待核销记录。
10. 核销付款，若报价配件绑定库存，确认生成 `cicada_inventory_flows` 出库流水，库存减少，工单标记 `inventory_deducted=true`。
11. 打印工单，确认包含配件小计、服务小计、其他小计、最终报价、报价备注。
12. 导出工单，确认导出字段包含报价明细和三类费用。

## 6. 未覆盖风险

- 微信支付和订阅消息最终送达依赖生产商户号、回调地址、模板 ID、openid 和用户授权。
- 库存扣减当前按工单幂等标记防重复，若未来高并发多人同时出库，需要进一步引入事务或锁。
- 企业微信会话存档、真实税控开票、第三方物流轨迹仍不在本次 goal 范围。
