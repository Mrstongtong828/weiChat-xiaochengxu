# 后台员工账号与自定义权限技术设计（待确认）

## 1. 设计结论

在现有角色体系上增加账号级权限，不另建一套登录系统：

- `role` 保留，负责角色名称和默认权限模板。
- `permissions` 保存账号经过管理员调整后的权限键数组。
- 账号没有 `permissions` 字段时，按最新角色模板计算默认权限。
- `admin` 与 `superadmin` 始终拥有全部权限；`admin_root` 首次登录自愈为 `superadmin` 的现有规则保持不变。
- 后端鉴权是最终安全边界；前端权限只负责菜单、区块和按钮展示。

## 2. 数据模型

在 `cicada_users` 员工记录中增加：

```js
{
  role: 'support',
  permissions: [
    'view_order',
    'confirm_inbound_arrival',
    'edit_received_parts',
    'confirm_received_parts',
    'edit_repair_record',
    'record_return_logistics'
  ],
  permission_version: 1
}
```

规则：

- `permissions` 不存在：使用角色模板，兼容现有账号并立即应用新模板。
- `permissions: []`：明确表示该账号没有业务权限，不能回退到角色模板。
- 保存时只接受权限目录中已注册的键，去重后写库。
- 修改角色时，前端重新载入新角色模板；管理员确认保存后才覆盖账号权限。
- 不把密码、密码哈希、Token 或会话数据放入权限接口响应。

无需新增数据库集合或索引，只更新 `cicada_users.schema.json`。

## 3. 单一权限源

扩展共享模块 `cicada-order-workflow`，让它继续作为仓库约定的 RBAC 单一来源，新增：

- `PERMISSION_DEFINITIONS`：权限键、中文名称、分组、说明和依赖关系。
- `ROLE_PERMISSION_TEMPLATES`：管理员、维修工程师、客服和财务的默认权限。
- `getEffectivePermissions(user)`：计算账号最终权限。
- `hasUserPermission(user, permission)`：判断单项权限。
- `assertUserPermission(user, permission)`：后端统一拒绝无权限请求。
- `sanitizePermissions(input)`：过滤非法、重复权限键。
- `getPermissionCatalogForManager()`：向用户管理页面返回安全的权限目录与角色模板。

保留旧的 `PERMISSIONS`、`hasRolePermission` 等导出作为迁移期兼容层，但所有被改造接口改用账号对象鉴权，不能只传 `role`。

## 4. 首期默认模板

### 管理员 / 超级管理员

全部权限。账号中即使存在不完整的 `permissions`，管理员和超级管理员仍按全权处理，防止管理入口被误锁死。

### 维修工程师

- 查看工单
- 填写维修记录、维修项目、说明、照片和实际使用配件
- 查看配件页面、配件资料和库存数量

默认不允许报价、物流导入、客户导出、库存修改、财务、账号管理和系统设置。

### 客服（现有 `support01` 的默认模板）

- 查看工单
- 确认设备签收入库
- 填写收件配件明细和照片
- 确认收件配件签收
- 填写维修项目
- 填写单笔回寄物流公司和单号
- 查看客户资料（手机号按现有规则脱敏）
- 查看和处理客户反馈

默认不允许报价、客户/工单导出、批量物流导入、付款、财务、账号管理和系统设置。

新增只读客服时，管理员选择客服模板后只保留 `view_order`、`view_customer` 和按需的 `view_feedback`。

### 财务

保持现有财务口径：查看工单、确认付款、发票、财务、结算、付款凭证和审计；不允许维修、库存、报价、客户导出或账号管理。

## 5. 需要拆分的权限点

现有部分接口共用过粗的权限键，必须拆分，否则无法实现客服与维修师傅的精确授权：

| 现有权限 | 当前混用操作 | 拆分后 |
| --- | --- | --- |
| `update_remarks` | 备注、维修记录、收件明细、工单产品 | `edit_order_remarks`、`edit_repair_record`、`edit_received_parts`、`edit_order_items` |
| `update_status` | 任意状态、签收入库、配件签收、恢复取消 | `update_order_status`、`confirm_inbound_arrival`、`confirm_received_parts`、`restore_cancelled_order` |
| `import_logistics` | 签收/回寄批量导入、单批发货 | `import_inbound_logistics`、`record_return_logistics`、`import_return_logistics` |
| `manage_inventory` | 查看、编辑、状态、导入、导出、流水、扣减 | `view_inventory`、`edit_inventory`、`stock_in_inventory`、`stock_out_inventory`、`adjust_inventory`、`import_inventory`、`export_inventory` |
| `manage_staff` | 员工管理、工程师指派、绩效 | `view_staff`、`create_staff`、`edit_staff`、`toggle_staff`、`reset_staff_password`、`assign_engineer`、`view_engineer_performance` |

`saveRepairRecord` 只保存维修作业快照，不自动开放报价或库存调整。维修记录选择配件时调用的 `listParts` 改为要求 `view_inventory`，成本价继续仅向管理员/财务等有成本权限的账号显示。

## 6. 后端改造

### `cicada-admin-order`

- `_before` 继续验证 Token 并取得完整员工记录。
- `requireAdminPermission` 改用 `hasUserPermission(currentAdminUser, key)`。
- `getWorkflowConfig` 返回账号最终权限，而不是仅按角色返回。
- 为签收入库、收件明细、维修记录、回寄物流和库存接口换成拆分后的权限键。
- 物流台账、工单列表和客户摘要继续执行手机号脱敏与付款凭证投影，不能因自定义权限旁路敏感字段。
- 同步更新文件内 `createWorkflowFallback()`，与共享模块保持一致。

### `cicada-admin-sys`

- 登录响应增加 `permissions`（最终权限）和 `permissionVersion`。
- 增加读取权限目录/模板的接口，供用户管理页渲染。
- `manageStaff` 的新增和编辑允许保存权限数组，并校验非法键和越权授予。
- 账号列表可返回角色与权限，但继续剔除密码、哈希、Token、会话等字段。
- 员工新增、权限变化、禁用和密码重置继续写审计日志。
- 非超级管理员不能创建或修改超级管理员；当前账号不能禁用自己。

### `cicada-admin-customer`

- 用共享的账号权限判断替换本地固定角色表。
- 客户查看、完整手机号、编辑、设备、导入、导出、注销分别使用独立权限键。
- 客服只有 `view_customer` 时只看到脱敏数据，不能导出。

### `cicada-admin-kb`

- 用 `manage_kb` 权限替换固定的管理员/工程师角色判断。

## 7. PC 管理端改造

### 界面设计规格

1. **用途**：让非技术管理员能快速创建员工账号、套用职责模板并清楚理解每项权限的影响。高风险权限必须显眼，但日常新增维修师傅或客服不应被复杂配置阻碍。
2. **视觉方向**：工业/工具型（Industrial/utilitarian），延续现有 Element Plus 管理后台，不另做一套视觉体系。
3. **色板**：主操作蓝 `#165DFF`、成功绿 `#00B42A`、警告橙 `#FF7D00`、危险红 `#F53F3F`、正文深灰 `#1D2129`。这些颜色沿用现有后台语义，避免用户重新学习。
4. **字体**：中文使用 `PingFang SC`，Windows 回退为 `Microsoft YaHei`；保持现有后台排版。因这是已有产品内的功能扩展，明确覆盖通用 UI 技能关于更换字体的建议，以免单页视觉割裂。
5. **布局**：桌面端采用左窄右宽的非对称布局——左侧显示账号身份、角色模板和权限数量摘要，右侧按业务域分组展示复选框；高风险权限独立置于右侧底部警示区。窄屏改为纵向堆叠，底部保存区固定可见。
6. **组件**：沿用 Element Plus 图标与表单组件，不使用 Emoji；权限组支持“本组全选/清空”，角色切换时明确提示将重置为模板默认值。

### 用户管理页

新增或编辑账号弹窗采用以下交互：

1. 选择角色模板。
2. 按“工单、配件库存、客户、财务、系统、账号管理”分组展示权限复选框。
3. 选择模板时填充默认权限；之后允许管理员逐项调整。
4. 列表增加“权限摘要”，例如“客服 · 6项权限”。
5. 保存前提示高风险权限，包括账号管理、客户导出、付款、退款和系统设置。

账号密码继续使用现有临时密码和首次修改机制，不在浏览器长期保存明文。

### 页面与按钮门禁

- `menuAccess.js` 从角色列表改为菜单所需权限键。
- 登录后将最终权限与 `adminUser` 一并存入本地会话；刷新时从后端重新获取，避免长期使用陈旧权限。
- 路由守卫、侧边菜单和页面内按钮统一调用 `hasPermission(key)`。
- `WorkOrder.vue` 不再用 `role === admin` 判断状态操作，全部改用具体权限。
- `InventoryManagement.vue` 将查看、编辑、导入和导出入口分别控制。
- `CustomerManagement.vue` 保留手机号脱敏，并分别控制编辑和导出。
- 收到后端“无权限”时提示权限已变化并刷新当前权限配置。

## 8. 现有账号上线行为

不在代码或文档保存用户提供的账号密码。上线后，现有账号在未保存自定义权限时按角色模板生效：

- `admin`：管理员全权。
- `admin_root`：按现有逻辑首次登录成为超级管理员，全权且继续受救援账号保护。
- `support01`：客服默认操作权限，可由管理员随后调整。
- `engineer01`：仅维修记录和配件查看。
- `finance01`：财务默认权限。

后续管理员在用户管理页新增 `support02`，取消全部写权限即可形成只读客服2。

## 9. 安全策略

- 后端每个接口按账号最终权限校验，不能信任前端传入的角色或权限。
- 管理员保存他人权限时，后端校验操作者拥有 `manage_staff`，且不能授予操作者自身不具备的权限；超级管理员除外。
- 管理员/超级管理员全权由服务端计算，防止前端篡改。
- 权限变化记录新增、删除的权限键，不记录密码、Token 或用户提供的凭据。
- 禁用或重置密码时继续清空该账号全部后台会话。
- 自定义权限不改变工单状态机、付款前置条件、物流单号校验等业务规则。

## 10. 测试策略

### 单元与契约测试

- 角色模板和自定义权限覆盖、空数组、非法键、管理员全权。
- 权限拆分后的每个关键云对象方法允许/拒绝测试。
- 维修工程师允许保存维修记录但拒绝报价、库存修改和导出。
- 客服允许签收、收件明细、维修项目和单笔回寄，拒绝报价与导出。
- 只读客服拒绝全部写接口。
- 财务权限不回归。
- 用户管理越权授予、自我禁用、超管保护和敏感字段过滤。

### 本地验收

- `docte-master/npm run check`
- `pc-admin/npm run build`
- 运行相关 Node 测试与 PC Admin 定向检查脚本。

### 线上验收（部署另行确认）

- 使用普通管理员验证新增账号和权限勾选。
- 分别用维修、客服和财务账号验证菜单、按钮及后端拒绝。
- `admin_root` 仅验证救援规则时使用，不参与日常回归。
- 测试使用专用工单，避免修改真实订单、付款、库存和客户数据。

## 11. 发布与回滚

发布顺序：共享权限模块与云对象后端 → 数据库 Schema → PC 管理端。

后端先兼容没有 `permissions` 的旧账号，因此发布期间旧前端仍能登录。若需要回滚，旧代码会忽略新增字段；不得删除现有账号或批量改写密码。线上部署、Schema 上传和真实账号修改均需在本地实现与测试通过后另行执行。
