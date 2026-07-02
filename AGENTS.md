# AGENTS.md

This is a multi-platform dental equipment repair management system (牙医仪器检修). Two frontends share one uniCloud (Alipay Cloud) serverless backend.

## Repository layout — read this first

The folder tree is non-obvious and the old docs had it wrong:

- **`docte-master/`** — the **active mini-program AND the backend**. The shared `uniCloud-alipay/` backend lives here. Almost all edits happen in this directory.
- **`pc-admin/`** — PC Admin dashboard (a subdirectory, not a sibling).
- The repository root **also contains a partial/stale copy** of the mini program (`pages.json`, `App.vue`, `main.js`, etc.) with no `pages/` or backend. Treat `docte-master/` as canonical; do not assume root files are live.
- Root `CLAUDE.md` is the most authoritative architecture doc. Nested `docte-master/CLAUDE.md` is a stale duplicate.

## Build & Run

```bash
# Mini Program (inside docte-master/)
npm install
npm run dev:mp-weixin     # builds to unpackage/dist/dev/mp-weixin
npm run check             # alias for build:mp-weixin — the only "sanity check" (no lint/tests)

# PC Admin (inside pc-admin/)
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev                   # Vite dev server at http://localhost:5173
npm run build                 # outputs to dist/
```

Node >=20.19.0. No lint or unit-test scripts.

## Architecture — high-signal facts

- **Cloud functions** live in `docte-master/uniCloud-alipay/cloudfunctions/`. Uses `index.obj.js` (cloud object style: `module.exports = { async methodName(data) {...} }`).
- **Client-facing**: `cicada-client-user` (auth, feedback submit), `cicada-client-order` (orders, warranty, payment), `cicada-client-public` (guides, fault KB).
- **Admin (URL化, called by pc-admin over HTTP)**: `cicada-admin-sys` (login, staff, settings, feedback closed-loop), `cicada-admin-order` (orders **+ parts + inventory + settlement + refund**), `cicada-admin-kb` (KB + categories), **`cicada-admin-customer`** (CRM: profiles, devices, history, tags, import/export, compliance). Match API by `API_BASE` key (see `pc-admin/src/config/api.js`), not by view name.
- **Shared module** at `common/cicada-order-workflow` is the single source of truth for the order state machine (`ORDER_STATUS_TRANSITIONS`) and RBAC (`PERMISSIONS`). Edit there, don't hardcode in individual functions. The admin functions also contain a local `createWorkflowFallback()` — if you change the shared module, check whether the inline fallback needs updating too.
- **Staff roles** (in `permissions` map): `admin`, `engineer`, `finance`, `support`, plus `superadmin`. Mini-program users are role `client`.
- **SN normalization**: Every cloud function that touches SNs has an identical `normalizeSn(v)` helper (trim → upperCase → remove `/\s-+/g`). It is **intentionally duplicated** (no shared module). When you change the rule, update all copies: `cicada-client-order`, `cicada-admin-customer`, `cicada-admin-order`, `cicada-client-user`, `cicada-maintenance`.

## Git remotes

Three remotes: `origin` → `huaxie602/docte` (issues/PRDs), `weichat` → `Mrstongtong828/weiChat-xiaochengxu`, `data-guard` → `Mrstongtong828/data-guard`. Feature branches track `weichat` — a bare `git push` goes there, not `origin`. Check upstream before pushing.

## Auth & tokens

- **Mini program**: Token stored as `uni.getStorageSync('token')`, auto-injected by `utils/cloud.js`. Login via phone → SMS code.
- **PC Admin**: Token stored in `localStorage` (key `adminToken`), injected by axios interceptor in `src/utils/request.js`. Login via username/password.
- Error codes: `code: 0` = success, `code: 401` = unauthorized (triggers session clear + redirect).

## Database

All collections use `cicada_` prefix. Schemas in `docte-master/uniCloud-alipay/database/*.schema.json`. **Indexes must be created manually** in uniCloud web console — see `INDEX_TASK.md` and `docte-master/uniCloud-alipay/database/INDEXES.md`. `cicada_orders.order_no` requires a **UNIQUE** index. The `username` index on `cicada_users` must be **sparse** (client users don't have usernames).

## PC Admin URL config

`pc-admin/src/config/api.js` builds endpoint URLs from `.env.local` env vars (`VITE_UNICLOUD_BASE_URL` or per-function `VITE_ADMIN_*_URL`). When adding an admin function, enable URL化 in console and add a key to `API_BASE`. See `pc-admin/配置指南.md`.

## Reference docs

`root CLAUDE.md` (most authoritative), `goal.md` / `DEPLOY_GOAL.md`, `SCALING_GUIDE.md`, `AFTERSALES_*.md`. Agent workflow docs: `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`.
