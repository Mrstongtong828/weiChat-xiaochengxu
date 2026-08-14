# 收货配件明细设计

## 目标

在 PC 后台工单详情中记录客户随设备寄入的配件，支持图片凭证与签收确认，并把同一份数据带入维修单打印预览。

## 数据与接口

- `cicada_orders.received_parts`: 数组，元素为 `{ name, quantity, remark }`。
- `cicada_orders.received_part_photos`: 云文件 ID 数组。
- `cicada_orders.received_parts_receipt`: `{ status, confirmed_at, confirmed_by, confirmed_by_name }`，`status` 为 `pending` 或 `confirmed`。
- `saveReceivedParts`: 校验并保存明细与图片，记录 `save_received_parts` 审计事件。
- `confirmReceivedParts`: 在明细已保存且工单允许操作时写入签收人、时间和确认状态，记录 `confirm_received_parts` 审计事件。

## 页面

概览页“设备与故障”之后展示收货配件编辑区。编辑权限沿用 `update_remarks`，图片沿用后台通用云文件上传接口。确认后展示操作人和时间，并禁止重复确认。

## 打印

维修单在设备/故障表格后展示收货配件明细、签收状态、操作人和时间；照片以可访问临时 URL 缩略图展示，无法访问时展示照片数量占位文案。

## 验证

运行 PC Admin 构建、打印模板检查和后端单元测试；启动本地 mock + Vite，通过浏览器验证增删行、上传照片、保存、签收和打印预览，并保存完整页面截图。
