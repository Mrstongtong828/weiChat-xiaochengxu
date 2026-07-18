# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-platform dental equipment repair management system ("牙医仪器检修"). Two frontends share one uniCloud (Alipay Cloud) serverless backend:

1. **Mini Program (client-facing)** — uni-app + Vue 3, primarily WeChat Mini Program. Customers submit repair orders and track progress. Calls cloud functions directly via `uniCloud.callFunction()`.
2. **PC Admin Dashboard** (`pc-admin/`) — Vue 3 + Vite + Element Plus + Pinia. Staff (admin/engineer/finance/support) manage orders, customers, knowledge base, and settings. Calls cloud functions over HTTP (云函数 URL 化) via axios.

## Repository Layout — read this first

The folder tree is non-obvious and the legacy docs had it wrong:

- `docte-master/` — **the active mini-program AND the backend**. The shared `uniCloud-alipay/` backend lives here (`docte-master/uniCloud-alipay/`). Almost all backend/mini-program edits happen under this directory.
- `pc-admin/` — PC Admin dashboard (a subdirectory, not a sibling).
- The repository root (`E:\小程序开发\docte\`) also contains a **partial/stale copy** of the mini program (`pages.json`, `App.vue`, `main.js`, etc.) with no `pages/` or backend. Treat `docte-master/` as canonical; do not assume root files are live.

There are nested doc files (`docte-master/CLAUDE.md`, `AGENTS.md`) — this root CLAUDE.md is the authoritative one.

## Build & Run

**Mini Program** (run inside `docte-master/`):
```bash
npm run dev:mp-weixin     # build to unpackage/dist/dev/mp-weixin, then open in WeChat DevTools
npm run build:mp-weixin   # production build
npm run check             # alias for build:mp-weixin (use as the build sanity check)
```
There is no lint or unit-test script; `npm run check` (a full mp-weixin build) is the closest thing to CI. Node `>=20.19.0`.

**PC Admin** (run inside `pc-admin/`):
```bash
npm install   # first time
npm run dev   # Vite dev server (default http://localhost:5173)
npm run build # outputs to dist/
```

## Backend Architecture (uniCloud)

Cloud functions live in `docte-master/uniCloud-alipay/cloudfunctions/`, organized by domain. They use the `index.obj.js` "cloud object" style (`module.exports = { async methodName(data) {...} }`).

**Client-facing**: `cicada-client-user` (auth/profile; also `submitFeedback` — the mini-program 投诉/建议 entry, writes `cicada_feedbacks`), `cicada-client-order` (order create/track), `cicada-client-public` (guides, fault KB).

**Admin** (URL 化, called by pc-admin over HTTP): `cicada-admin-sys`, `cicada-admin-order`, `cicada-admin-kb`, `cicada-admin-customer`. **Important: these functions have grown well beyond their names — match the PC Admin api file to the cloud function by its `API_BASE` key, not by the view name:**
- `cicada-admin-sys` (`adminSys`): login, staff management, settings, **and the feedback (投诉/建议) closed-loop**: `getFeedbackStats`/`getFeedbackList` (DB-side paginated + status/type/urgency/keyword filters, resolves customer name/phone) plus `assignFeedback`/`setFeedbackUrgency`/`replyFeedback`/`recordFeedbackVisit`/`closeFeedback`/`upgradeFeedback`. `closeFeedback` requires a recorded 回访. Each processing action writes an audit entry to `cicada_order_events` (`action: feedback_*`). RBAC via `PERMISSIONS.view_feedback`/`handle_feedback` (in `cicada-order-workflow`). Backs `pc-admin/src/api/admin.js`. The mini program submits via `cicada-client-user.submitFeedback` and reads status/reply via `getComplaintList` (status mapped to the page's `submitted/processing/replied/closed` keys).
- `cicada-admin-order` (`adminOrder`): order list/assign/status **plus parts, inventory, and settlement** — `listParts`/`savePart`/`updatePartStatus`/`listInventoryFlows`/`useOrderParts`/`getSettlementList`. Backs `order.js`, `inventory.js`, and `settlement.js`. There is **no** separate inventory/settlement cloud function.
- `cicada-admin-kb` (`adminKb`): fault KB + categories. Backs `kb.js`.
- `cicada-admin-customer` (`adminCustomer`): customer CRM (profiles, devices, history, tags, import/export, compliance logs). Backs `customer.js`, `audit.js`, `performance.js`.

**Maintenance**: `cicada-maintenance` (background cleanup; call `run({ token, dryRun: true })`).

### Shared logic: `cloudfunctions/common/cicada-order-workflow`

A shared module (required by admin functions) that is the **single source of truth** for the order state machine and RBAC. It exports `ORDER_STATUS`, `ORDER_STATUS_LABELS`, `ORDER_STATUS_TRANSITIONS`, `ROLE_LABELS`, `ALL_ROLES`, and the `PERMISSIONS` map. When changing statuses, transitions, roles, or who-can-do-what, edit this module — do not hardcode these in individual functions.

**Order status machine** (`ORDER_STATUS_TRANSITIONS`):
`pending → sent/received/cancelled`, `sent → received/cancelled`, `received → inspecting/fixing/cancelled`, `inspecting → fixing/shipped/cancelled`, `fixing → shipped/completed/cancelled`, `shipped → completed`, `completed`/`cancelled` are terminal.

### RBAC model (this is `feat/rbac-enhancements`'s focus)

Two distinct role spaces:
- **Mini-program users**: `client` (customers). Stored in `cicada_users`.
- **Staff** (`ALL_ROLES`): `admin` (管理员), `engineer` (工程师), `finance` (财务), `support` (客服). PC Admin only.

Permissions are gated by the `PERMISSIONS` map in `cicada-order-workflow`, e.g. `confirm_payment`/`update_invoice`/`view_payment_proof` → `admin`+`finance`; `update_status`/`issue_quote`/`manage_kb` → `admin`+`engineer`; `manage_staff`/`manage_settings` → `admin` only; `update_remarks`/`add_timeline` → `admin`+`engineer`+`support`. Admin functions authorize via `verifyAdminToken(token, allowedRoles)`. The frontend mirrors this gating (login returns role flags `isAdmin/isEngineer/isFinance/isSupport`); keep both sides in sync.

### Database collections (all prefixed `cicada_`)

Core: `cicada_users` (client + staff, `role` field), `cicada_orders`, `cicada_order_items`, `cicada_order_events` (order timeline/audit), `cicada_user_devices`, `cicada_addresses`.
CRM: `cicada_customers`, `cicada_customer_logs` (compliance/access log), `cicada_customer_tags`.
Inventory/billing: `cicada_parts` (parts/配件 catalog), `cicada_inventory_flows` (stock movement log).
Content/system: `cicada_fault_kb`, `cicada_product_categories`, `cicada_guides`, `cicada_feedbacks` (投诉/建议: `type` enum `投诉`/`建议`, `status` enum `待处理`/`已处理`, optional `rel_order_no` linking to an order), `cicada_settings`, `cicada_subscription_logs`, `cicada_rate_limits` (API rate limiting).

Schemas: `docte-master/uniCloud-alipay/database/*.schema.json`. Init/test data: `*.init_data.json`, `test-*.json` (import per `导入测试数据说明.md`).

**Indexes are manual.** They must be created in the uniCloud web console before production — see `docte-master/uniCloud-alipay/database/INDEXES.md` (and `INDEX_TASK.md`). `cicada_orders.order_no` is a **UNIQUE** index. Composite indexes back the main list/filter queries; the admin order list does DB-side pagination/count rather than full scans (see `SCALING_GUIDE.md`).

## Auth Flow

**Mini Program**: phone → `sendSmsCode`; SMS code → `login` returns token stored in `uni.getStorageSync('token')`; injected automatically by `utils/cloud.js` into every call. `code: 401` clears token and redirects to login.

**PC Admin**: username/password → `cicada-admin-sys` login returns token + role flags, stored in `localStorage` (`adminToken`); injected by the axios interceptor in `src/utils/request.js`. `401` clears the session (`utils/adminSession.js`) and routes to `/login` (guard in `src/router/index.js`).

## API Configuration (PC Admin)

`pc-admin/src/config/api.js` builds endpoint URLs from env vars with a default cloud base. Configure URLs via `.env.local` (`VITE_UNICLOUD_BASE_URL`, or per-function `VITE_ADMIN_SYS_URL`/`VITE_ADMIN_KB_URL`/`VITE_ADMIN_ORDER_URL`/`VITE_ADMIN_CUSTOMER_URL`). When you add an admin function, enable 云函数 URL 化 in the console and add a key to `API_BASE`. See `pc-admin/配置指南.md`.

## Conventions & Patterns

- **Error codes**: `code: 0` (or `code: 0`/`code: -1` per function) = success/failure convention; `code: 401` = unauthorized.
- **Mini-program navigation**: all pages use `navigationStyle: "custom"`.
- **Mini-program API layer** (`api/*.js`): wraps cloud calls; `USE_CLOUD` toggle switches between `callCloudFunction()` and HTTP fallback.
- **WeChat AppID**: `wx25289fbe4a3bf011` (manifest.json). uniCloud provider: Alipay Cloud (`uniCloud-alipay`).

### Adding things

- **Mini-program page**: create `docte-master/pages/<cat>/<name>.vue`, register in `docte-master/pages.json` with `navigationStyle: "custom"`.
- **PC Admin page**: create `pc-admin/src/views/<Name>.vue`, add a child route under `MainLayout` in `pc-admin/src/router/index.js`, wire API in `pc-admin/src/api/`.
- **Cloud function**: create `docte-master/uniCloud-alipay/cloudfunctions/<name>/index.obj.js`; if it touches orders/roles, require `../common/cicada-order-workflow` rather than duplicating constants; deploy via HBuilderX "Upload and deploy".
- **DB collection**: add `<name>.schema.json`, document required indexes in `INDEXES.md`, optionally add init data.

## Reference Docs

`goal.md` / `DEPLOY_GOAL.md` (product/deploy goals), `SCALING_GUIDE.md` (~1000-user capacity tuning), `后端对接任务清单.md` (backend integration checklist), `docte-master/uniCloud-alipay/database/MAINTENANCE.md`.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues on `origin` (`huaxie602/docte`), via the `gh` CLI. External PRs are **not** a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults — `needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
