# AGENTS.md

Multi-platform dental equipment repair management system (牙医仪器检修). Two frontends share one uniCloud (Alipay Cloud) serverless backend.

## CRITICAL: 已上线小程序保护规则

微信小程序已上线。除非用户在当前任务中明确授权具体文件和逻辑，否则任何任务均只允许修改 `pc-admin/`；禁止修改小程序前端、客户端云函数、共享业务逻辑、数据库结构以及任何可能改变线上小程序行为的代码。

### 执行前范围确认

开始任何开发任务前，必须先向用户确认：

> 本次默认只修改 PC 管理后台。不会修改小程序前端、客户端云函数、共享业务逻辑、数据库结构或线上小程序行为；如发现必须跨范围修改，我会先停止并说明影响，获得明确授权后再继续。

未完成范围确认前，不应开始修改代码。

### 默认允许修改的范围

仅允许处理 PC 管理后台：

- `pc-admin/src/`
- `pc-admin/public/`
- `pc-admin/scripts/`
- `pc-admin/package.json`
- `pc-admin/vite.config.js`
- PC 后台专属的测试文件、构建、部署和配置文档
- `pc-admin/dist/` 构建产物（是否提交 Git 以项目现有规则为准）

修改时必须确认调用的接口、权限字段和数据格式与线上后端兼容。

### 禁止修改的小程序范围

以下目录及内容默认全部禁止修改：

- `docte-master/pages/`、`components/`、`subpackages/`、`static/`、`utils/`、`store/`
- `docte-master/App.vue`、`main.js`、`main.ts`、`pages.json`、`manifest.json`、`uni.scss`
- 小程序登录、授权、手机号、短信验证码相关代码
- 小程序订单、报修、报价、付款、物流、签收、维修进度相关代码
- 小程序页面样式、文案、路由、分享、订阅消息相关代码
- 小程序构建、分包和发布配置
- 仓库根目录中的小程序旧副本

### 禁止修改的相关业务逻辑

“不要动小程序”包括禁止修改可能改变小程序行为的后端和共享逻辑：

- `docte-master/uniCloud-alipay/cloudfunctions/` 下所有客户端云函数（`cicada-client-user`、`cicada-client-order`、`cicada-client-public`、`cicada-maintenance` 等）
- `cicada-order-workflow` 等前后台共享模块
- 订单状态机及状态转换规则
- 小程序用户鉴权和 token 逻辑、微信登录、手机号登录、短信验证码
- 报修、报价、付款、退款、签收、维修、回寄流程
- 微信支付、订阅消息、物流回调相关逻辑
- SN 编码标准化逻辑
- 小程序调用的数据库字段、集合及索引
- 小程序依赖的接口响应结构、字段名称和错误码
- 小程序用户权限和数据可见范围

即使只修改云函数，只要该云函数可能被小程序调用，也视为修改小程序相关逻辑。

### 数据库保护规则

默认禁止删除或重命名现有字段、改变字段类型、改变订单状态值、改变状态流转条件、改变接口返回结构、改变错误码含义、收紧小程序合法权限、修改已有数据、批量迁移线上数据、删除集合或索引。

如需新增数据，优先使用向后兼容方式：只新增可选字段；旧数据缺少字段时仍能正常运行；保留原接口和原字段；新功能默认不改变小程序行为；新字段不得成为小程序旧流程的必填条件。

涉及数据库、云函数或共享模块时，必须先停止实施并向用户说明影响，获得明确授权后才能修改。

### 后台功能实现原则

新增或修改 PC 后台功能应优先在 `pc-admin/` 内完成。如必须依赖后端修改：

1. 先确认能否复用现有后台接口。
2. 确认目标接口是否仅供 PC 后台使用。
3. 确认修改不会影响小程序调用。
4. 列出计划修改的云函数、方法和字段。
5. 说明对线上小程序的潜在影响。
6. 得到用户明确同意前，不得修改或部署云函数。

不得擅自通过修改客户端云函数或共享状态机来简化 PC 后台实现。

### 发现跨端依赖时的处理方式

如果任务无法在 `pc-admin/` 内独立完成，必须暂停并报告：当前需求；为什么只改 PC 后台无法完成；需要修改哪个后端或共享模块；哪些小程序页面或流程可能受影响；是否存在不影响小程序的替代方案；推荐方案及原因。

只有用户明确回复“允许修改这些具体文件或逻辑”后才能继续。授权仅对当前任务明确列出的范围有效。

### Git 提交与合并规则

每次提交前执行：

```bash
git status --short
git diff --name-only
git diff --cached --name-only
```

确认没有小程序前端文件、客户端云函数、未经授权的共享模块、数据库 schema 或索引变更、小程序构建产物、账号密码 token 或生产密钥、无关的 Word/PDF/截图或临时文件。发现禁改文件立即停止，不得提交、合并或推送。

提交信息须明确范围，如 `feat(admin): ...`、`fix(admin): ...`、`refactor(admin): ...`。

### 验证要求

只修改 PC 后台时至少执行：

```bash
cd pc-admin
npm test
npm run build
```

根据任务范围继续执行 `npm run check:errors`、`npm run check:security`、`npm run check:urls`、`npm run check:staff`、`npm run check:print` 等。不得因检查失败而擅自修改小程序或客户端云函数。完成后再次执行 `git diff --name-only` 和 `git diff --cached --name-only` 确认变更范围。

### 部署规则

- PC 后台：仅在用户明确要求时构建或上传。
- 云函数：仅在用户明确要求上传某个具体云函数时才允许部署。
- 小程序：禁止上传、预览、提交审核或发布。
- 数据库：禁止修改线上数据、schema 和索引。
- Git：仅在用户明确指定仓库和分支后才允许推送。

“帮我部署”不能自动解释为允许部署小程序。

### 敏感信息保护

不得在代码、提交记录、日志或回复中泄露管理员账号密码、云函数密钥、微信 AppSecret、支付密钥、短信服务密钥、数据库凭证、生产 token、`.env.local` 中的敏感配置。不得使用生产账号进行自动化测试，除非用户明确授权。

### 任务完成后的固定汇报格式

每次完成修改后必须汇报：

1. 修改了哪些功能。
2. 修改了哪些文件或目录。
3. 是否修改小程序前端（“否”或列出授权文件）。
4. 是否修改小程序相关逻辑（“否”或详细说明）。
5. 是否修改或部署云函数。
6. 是否修改数据库。
7. 执行了哪些测试及结果。
8. 构建产物在哪里。
9. 是否提交和推送（提交号、仓库和分支）。
10. 当前仍存在的风险或未完成事项。

## Repository layout — read this first

- **`docte-master/`** — active mini-program AND backend. It is protected by the CRITICAL rules above and must not be edited without explicit, task-specific authorization.
- **`pc-admin/`** — PC Admin dashboard (subdirectory, not sibling).
- Root has a **partial/stale copy** of the mini program (no `pages/` or backend). Treat `docte-master/` as canonical.
- `root CLAUDE.md` is the authoritative architecture doc. `docte-master/CLAUDE.md` is a stale duplicate.

## Build & Run

```bash
# Mini Program (inside docte-master/)
npm run dev:mp-weixin     # builds to unpackage/dist/dev/mp-weixin
npm run check             # build:mp-weixin + check:client-secrets + check:package-size (local acceptance gate)

# PC Admin (inside pc-admin/)
npm install
Copy-Item .env.example .env.local
npm run dev               # Vite at http://localhost:5173
npm run build             # outputs to dist/
```

Node >=20.19.0. `.npmrc` sets cache to `.npm-cache/`.

PC Admin has targeted check scripts: `npm run check:urls`, `check:staff`, `check:subscription`, `check:errors`, `check:security`.

## Architecture — high-signal facts

- **Cloud functions** (`docte-master/uniCloud-alipay/cloudfunctions/`): `index.obj.js` cloud-object style (`module.exports = { async methodName(data){...} }`).
- **Client-facing**: `cicada-client-user` (auth, feedback), `cicada-client-order` (orders, warranty, payment), `cicada-client-public` (guides, fault KB).
- **Admin (URL化, called by pc-admin over HTTP)**: `cicada-admin-sys` (login, staff, settings, feedback closed-loop), `cicada-admin-order` (orders + parts + inventory + settlement + refund), `cicada-admin-kb` (KB + categories), `cicada-admin-customer` (CRM: profiles, devices, history, tags, import/export). Match API by `API_BASE` key in `pc-admin/src/config/api.js`, not by view name.
- **Express logistics callback**: `cicada-express-callback` (webhook receiver for external tracking updates).
- **Shared modules** (`cloudfunctions/common/`):
  - `cicada-order-workflow` — single source of truth for order state machine (`ORDER_STATUS_TRANSITIONS`) and RBAC (`PERMISSIONS`). Admin functions have `createWorkflowFallback()` — update both if you change the shared module.
  - `cicada-express-provider` — express logistics provider abstraction.
- **Staff roles** (in `PERMISSIONS`): `admin`, `engineer`, `finance`, `support`, `maintenance`, plus `superadmin`. Mini-program users are `client`. Frontend menu gating in `pc-admin/src/config/menuAccess.js`.
- **SN normalization**: Identical `normalizeSn(v)` (trim → upperCase → `/\s-+/g` → '') duplicated across `cicada-client-order`, `cicada-admin-customer`, `cicada-admin-order`, `cicada-client-user`, `cicada-maintenance`. Change the rule in all copies.

## Git remotes

Three remotes: `origin` → `huaxie602/docte` (issues/PRDs), `weichat` → `Mrstongtong828/weiChat-xiaochengxu`, `data-guard` → `Mrstongtong828/data-guard`. Feature branches track `weichat` — `git push` goes there, not `origin`.

## Auth & tokens

- **Mini program**: `uni.getStorageSync('token')`, auto-injected by `utils/cloud.js`. Login: phone → SMS code.
- **PC Admin**: `localStorage` (`adminToken`), injected by axios interceptor in `src/utils/request.js`. Login: username/password.
- Error codes: `code: 0` = success, `code: 401` = unauthorized (triggers session clear + redirect).

## Database

All collections use `cicada_` prefix. Schemas in `docte-master/uniCloud-alipay/database/*.schema.json`. **Indexes must be created manually** in uniCloud web console — see `INDEX_TASK.md` and `docte-master/uniCloud-alipay/database/INDEXES.md`. `cicada_orders.order_no` requires a UNIQUE index. `username` index on `cicada_users` must be **sparse**.

## PC Admin URL config

`pc-admin/src/config/api.js` builds endpoint URLs from `.env.local` env vars. When adding an admin function, enable URL化 in console and add a key to `API_BASE`. See `pc-admin/配置指南.md`.

## Reference docs

`CLAUDE.md` (most authoritative), `goal.md` / `DEPLOY_GOAL.md`, `SCALING_GUIDE.md`, `AFTERSALES_*.md`, `docs/agents/domain.md`.
