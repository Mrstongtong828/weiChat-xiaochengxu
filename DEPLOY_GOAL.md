# Goal Deployment Checklist

This checklist is for deploying and verifying the work described in `goal.md`.

## 1. Local Preflight

Run from repository root:

```bash
node scripts/check-goal-local.mjs
```

Run frontend/admin checks:

```bash
cd docte-master
npm run check
npm audit --omit=dev

cd ../pc-admin
npm run build
npm run check:errors
npm audit --omit=dev
```

Expected:

- All local goal checks print `[ok]`.
- Both audits print `found 0 vulnerabilities`.
- Builds complete successfully. Existing Vite chunk-size and uni-app plugin timing warnings are non-blocking.

## 2. Deploy uniCloud Functions

Deploy these cloud functions from `docte-master/uniCloud-alipay/cloudfunctions/`:

- `cicada-client-public`
- `cicada-client-order`
- `cicada-admin-order`

Each of these function folders should contain:

- `index.obj.js`
- `package.json`

Deploy with HBuilderX:

1. Open `docte-master` in HBuilderX.
2. Associate the project with the target uniCloud space.
3. Right-click each function folder.
4. Choose upload/deploy.

If a valid uniCloud CLI is available in the deployment environment, deploy the same functions with that CLI. This workstation currently does not have a working `unicloud-cli`.

## 3. Database Schema And Indexes

Create or update these collections:

- `cicada_orders`
- `cicada_subscription_logs`

Confirm `cicada_orders.status` includes:

- `pending`
- `sent`
- `received`
- `inspecting`
- `fixing`
- `shipped`
- `completed`
- `cancelled`

Create indexes listed in:

- `docte-master/uniCloud-alipay/database/INDEXES.md`

New subscription log indexes:

- `cicada_subscription_logs: order_id, create_time desc`
- `cicada_subscription_logs: user_id, create_time desc`
- `cicada_subscription_logs: scene, create_time desc`
- `cicada_subscription_logs: status, create_time desc`

## 4. Environment Variables

Configure these on the relevant uniCloud functions.

General WeChat:

- `WX_APPID`
- `WX_SECRET`

Subscription templates:

- `WX_SUBSCRIBE_TEMPLATE_REPAIR_SUBMITTED`
- `WX_SUBSCRIBE_TEMPLATE_ORDER_RECEIVED`
- `WX_SUBSCRIBE_TEMPLATE_QUOTE_ISSUED`
- `WX_SUBSCRIBE_TEMPLATE_PAYMENT_CONFIRMED`
- `WX_SUBSCRIBE_TEMPLATE_ORDER_SHIPPED`
- `WX_SUBSCRIBE_TEMPLATE_ORDER_COMPLETED`

`WECHAT_SUBSCRIBE_TEMPLATE_*` is also supported as a template ID prefix.

WeChat Pay, if validating paid invoice/payment flows:

- `WX_PAY_APPID`
- `WX_PAY_MCH_ID`
- `WX_PAY_SERIAL_NO`
- `WX_PAY_NOTIFY_URL`
- `WX_PAY_PRIVATE_KEY` or `WX_PAY_PRIVATE_KEY_BASE64`
- `WX_PAY_API_V3_KEY`

## 5. PC Admin URL Configuration

In `pc-admin/.env.local`, set the target cloud space:

```bash
VITE_UNICLOUD_BASE_URL=https://your-env-id.example.com
```

Or set each function URL independently:

```bash
VITE_ADMIN_SYS_URL=https://your-env-id.example.com/cicada-admin-sys
VITE_ADMIN_KB_URL=https://your-env-id.example.com/cicada-admin-kb
VITE_ADMIN_ORDER_URL=https://your-env-id.example.com/cicada-admin-order
VITE_CLIENT_PUBLIC_URL=https://your-env-id.example.com/cicada-client-public
```

`VITE_CLIENT_PUBLIC_URL` is optional. If it is not set, `npm run check:urls` validates subscription config reachability through the read-only `cicada-admin-order/getSubscriptionConfig` endpoint. Set it explicitly when `cicada-client-public` has URL 化 enabled.

After deploying `cicada-admin-order`, run:

```bash
cd pc-admin
npm run check:urls
npm run check:subscription
```

Expected:

- `getAdminOrderList invalid token` returns an auth failure.
- `getTodoSummary invalid token` returns an auth failure.
- `getSubscriptionConfig reachable` returns `code=0` and a `templates` array.
- `check:subscription` prints every subscription scene as configured.

If `getTodoSummary` reports `Method[getTodoSummary] was not found`, the remote `cicada-admin-order` is still old and must be redeployed.

If `check:subscription` reports any scene as missing, configure the matching `WX_SUBSCRIBE_TEMPLATE_*` or `WECHAT_SUBSCRIBE_TEMPLATE_*` environment variable on the target uniCloud functions before subscription-message acceptance.

## 6. Manual Acceptance

Run these checks with test or production-like data.

### Invoice Flow

1. Create or select an order that is paid, completed, or shipped.
2. Submit invoice application in the mini program.
3. Confirm `cicada_orders.invoice_info` has `need_invoice=true`, `status=待开票`, title, tax number, email, remark, and timestamps.
4. Confirm PC admin work order drawer shows invoice status, title, tax number, and remark.
5. Change invoice status to `已开具` in PC admin.
6. Refresh mini program and confirm the new invoice status is visible.

### Server Pagination And Export

1. Prepare more than 100 work orders.
2. Confirm page 101+ records are visible through PC admin pagination.
3. Confirm status, keyword, device model, invoice status, and todo filters use backend `total`.
4. Export selected orders and current filtered orders.
5. Confirm success toast count matches exported file rows.

### Todo Center

1. Prepare orders covering inbound, quote, payment, invoice, return, and exception todo groups.
2. Confirm Home todo counts are displayed.
3. Click every todo card.
4. Confirm WorkOrder opens with the matching `todo` filter and the list total equals the Home count.
5. Validate invalid/no token behavior redirects or shows a clear error instead of silently reporting 0.

### Subscription Messages

1. Open mini program in WeChat DevTools or a real device.
2. Grant subscription permission during repair submit, progress view, quote confirm, or payment proof upload.
3. Trigger status changes from PC admin: received, quote issued, payment confirmed, shipped, completed.
4. Confirm the user receives the expected subscription message.
5. Reject subscription permission and confirm main flows still succeed.
6. Simulate missing template ID or missing openid and confirm `cicada_subscription_logs` records `skipped` or `failed` without blocking the main workflow.

## 7. Final Gate

Do not mark the goal complete until:

- Local preflight passes.
- Cloud functions are deployed.
- `npm run check:urls` passes against the target environment.
- Database schema and indexes are confirmed.
- Invoice, pagination/export, todo center, and subscription message manual acceptance all pass.
