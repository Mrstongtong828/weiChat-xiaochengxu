# SN 序列号识别功能 — 自测用例

覆盖：微信小程序报修页（扫码 + 手动）、PC 后台工单处理、报价弹窗在保提示、工单列表在保筛选、SN 容错匹配、埋点。

## 前置数据
在后台「客户管理 → 客户资产/SN台账」绑定两台设备：
- 设备 A（在保）：SN `CBCT-20250908-0019`，分类「CBCT」，型号「X1」，采购日期取近 3 个月内（或质保到期设为未来）。
- 设备 B（过保）：SN `HP001`，采购日期 2 年前 + 质保 12 个月（到期已过）。

部署后先执行回填：`cicada-maintenance.backfillSnNormalized({ token, dryRun: true })` 查看条数 → 去掉 dryRun 正式回填，使存量 `sn_normalized` 写入。

---

## 一、小程序报修页 — 手动输入
1. 输入 `CBCT-20250908-0019` → 失焦后约 0.5s 自动查询：回填设备分类/型号/采购日期，显示绿色【在保】+「质保至 YYYY-MM-DD」。✅
2. 容错变体均应命中同一设备（规范化键）：
   - `cbct-20250908-0019`（小写）
   - ` CBCT 2025 0908 0019 `（含空格）
   - `cbct20250908 0019`（混合）✅
3. 输入设备 B 的 SN → 显示红色【已过保】。✅
4. 点击右侧【查询】按钮立即查询（不等防抖）。✅
5. 连续重复输入同一 SN 不重复请求接口（节流：同 SN 命中缓存）。✅

## 二、小程序报修页 — 扫码
6. 点【扫码】图标 → 模拟 `wx.scanCode` 成功返回 SN 文本：自动填入输入框并自动查询（无需二次点击）。✅
7. 扫码取消/失败 → 弹窗「未识别到有效设备 SN 码，请对准条码或手动输入序列号」。✅
8. 扫到空内容 → 同样弹失败提示。✅
9. 800ms 内连续点扫码 → 第二次被节流忽略。✅

## 三、未匹配兜底
10. 输入不存在的 SN（如 `NOPE-123`）→ 弹窗「未查询到该设备档案，请核对SN编号，或联系管理员录入设备台账」；确认后分类/型号/采购日期被清空，可手动填写并继续提交报修。✅

## 四、历史工单跳转
11. 对有历史维修记录的 SN，识别结果区出现「历史维修：N 单 ›」可点 → 弹操作列表 → 选择某工单进入其详情。✅

## 五、提交与在保快照
12. 提交报修后，工单 `warranty_status` 与 `in_warranty` 按 SN 判定写入（在保设备→in_warranty；过保→expired）。✅
13. 设备档案 `cicada_user_devices` 沉淀/更新，新增/更新记录含 `sn_normalized`。✅

## 六、报价弹窗在保提示（小程序）
14. 打开在保工单的「维修报价」→ 顶部绿色浅底提示「该设备处于原厂质保期，可享受质保减免政策」。✅
15. 打开过保工单 → 红色浅底「该设备已超出质保期，维修收取全额工时、上门及配件费用」。✅

## 七、PC 后台工单
16. 工单列表筛选栏「在保状态」选「在保」/「已过保」→ 列表按 `warranty_status` 过滤。✅
17. 列表「设备与故障」列显示在保/已过保彩色标签。✅
18. 打开工单处理抽屉 → 检测/报价页：SN 可编辑，点【查询】自动回填设备分类/型号/采购日期 + 在保标签 + 「查看该设备历史工单（N）」。✅
19. 历史工单入口 → 关闭抽屉并以该 SN 作为列表搜索关键词过滤。✅
20. 改 SN/点【保存设备信息】→ 工单项落库，工单在保快照按新 SN 重算；列表标签随之更新；写 `cicada_order_events`（action: update_order_items）。✅
21. 报价编辑区顶部按工单在保状态显示绿色/红色提示条。✅

## 八、埋点
22. 每次扫码/手动查询后，`cicada_sn_logs` 新增记录：含 `action`(sn_scan/sn_query)、`sn`、`sn_normalized`、`source`(client/admin)、`matched`、`warranty_status`、操作人。✅
23. 埋点接口异常不影响主流程（断网/报错时报修与查询仍可用）。✅

## 九、构建回归
- `cd docte-master && npm run check` 通过。✅
- `cd pc-admin && npm run build` 通过。✅

---

## 部署清单（人工，非代码）
1. 重新部署云函数：`cicada-client-order`、`cicada-admin-order`、`cicada-admin-customer`、`cicada-client-user`、`cicada-maintenance`。
2. 上传 schema：新增 `cicada_sn_logs`，更新 `cicada_user_devices`、`cicada_order_items`。
3. 控制台建索引（见 `database/INDEXES.md`）：`cicada_sn_logs` 三项、两表 `sn_normalized`。
4. 运行 `cicada-maintenance.backfillSnNormalized` 回填存量 `sn_normalized`。
5. `cicada-admin-customer` 新增 `lookupDeviceBySn`/`logSnAction` 为同函数方法，无需改 `API_BASE`（已启用 URL 化即可）。
