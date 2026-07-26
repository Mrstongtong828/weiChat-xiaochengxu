# AGENTS.md

Multi-platform dental equipment repair management system (牙医仪器检修). Two frontends share one uniCloud (Alipay Cloud) serverless backend.

## Repository layout — read this first

- **`docte-master/`** — active mini-program AND backend. Almost all edits happen here.
- **`pc-admin/`** — PC Admin dashboard (subdirectory, not sibling).
- Root has a **partial/stale copy** of the mini program (no `pages/` or backend). Treat `docte-master/` as canonical.
- `root CLAUDE.md` is the authoritative architecture doc. `docte-master/CLAUDE.md` is a stale duplicate.

## Build & Run

```bash
# Mini Program (inside docte-master/)
npm run dev:mp-weixin     # builds to unpackage/dist/dev/mp-weixin
npm run check             # alias for build:mp-weixin — the only sanity check (no lint/tests)

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
- **Staff roles** (in `PERMISSIONS`): `admin`, `engineer`, `finance`, `support`, plus `superadmin`. Mini-program users are `client`. Frontend menu gating in `pc-admin/src/config/menuAccess.js`.
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
