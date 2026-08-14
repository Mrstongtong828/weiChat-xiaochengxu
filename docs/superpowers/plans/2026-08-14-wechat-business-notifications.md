# WeChat Business Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically notify mini-program users when a quote is published, a return tracking number is recorded, or an inbound parcel is first signed for.

**Architecture:** A shared uniCloud notifier owns WeChat API access, OpenID lookup, message logs, and deduplication. Existing admin/client triggers and the express callback call that notifier, while a small client utility maps user actions to the one-time subscription templates they need.

**Tech Stack:** Node.js cloud objects, uniCloud database/httpclient, Vue 3 + uni-app, WeChat subscription messages, Node test runner

## Global Constraints

- Keep the five existing production WeChat templates and keyword shapes unchanged.
- Notification failure must never fail quote, logistics, payment, or express callback business operations.
- Automatic express notification applies only to inbound segment `out` on the first transition to state `3`.
- Preserve existing user changes and the untracked `pc-admin/invoice-preview.png`.
- Index files document desired indexes; indexes still require manual creation in the uniCloud console.

---

### Task 1: Shared subscription notifier

**Files:**
- Create: `docte-master/uniCloud-alipay/cloudfunctions/common/cicada-subscription-notifier/index.js`
- Create: `docte-master/uniCloud-alipay/cloudfunctions/common/cicada-subscription-notifier/index.test.js`
- Create: `docte-master/uniCloud-alipay/cloudfunctions/common/cicada-subscription-notifier/package.json`

**Interfaces:**
- Consumes: `cicada-subscription-message.getSubscriptionTemplateKey()` and `buildSubscriptionData()`.
- Produces: `createSubscriptionNotifier({ db, httpclient, getEnvValue, logger?, now? })` and `buildSubscriptionDedupeKey(order, scene)`.

- [ ] **Step 1: Write failing notifier tests**

```js
test('builds stable business dedupe keys', () => {
  assert.equal(buildSubscriptionDedupeKey({ _id: 'o1' }, 'quote_issued'), 'quote_issued:o1')
  assert.equal(buildSubscriptionDedupeKey({ _id: 'o1', ship_back_info: { logistics_no: ' sf 1 ' } }, 'order_shipped'), 'order_shipped:o1:SF1')
})

test('skips an already sent dedupe key', async () => {
  const result = await notifier.sendOrderSubscription(order, 'quote_issued', '', { dedupeKey: 'quote_issued:o1' })
  assert.equal(result.status, 'duplicate')
  assert.equal(httpRequests.length, 0)
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test docte-master/uniCloud-alipay/cloudfunctions/common/cicada-subscription-notifier/index.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the notifier**

```js
function buildSubscriptionDedupeKey(order = {}, scene = '') {
  const orderId = normalizeText(order._id || order.order_id || order.order_no)
  if (!orderId) return ''
  if (scene === 'quote_issued') return `quote_issued:${orderId}`
  if (scene === 'order_received') return `order_received:${orderId}:${normalizeTrackingNo(order.ship_out_info) || 'NO_TRACKING'}`
  if (scene === 'order_shipped') return `order_shipped:${orderId}:${normalizeTrackingNo(order.ship_back_info) || 'NO_TRACKING'}`
  return ''
}

function createSubscriptionNotifier({ db, httpclient, getEnvValue, logger = console, now = Date.now }) {
  return {
    getTemplateId,
    async sendOrderSubscription(order, scene, remark = '', options = {}) {
      const templateId = getTemplateId(scene)
      const dedupeKey = options.dedupeKey || buildSubscriptionDedupeKey(order, scene)
      if (!templateId) return logResult('skipped', '未配置订阅消息模板ID')
      if (dedupeKey && await hasSentDedupeKey(dedupeKey)) return { status: 'duplicate', dedupeKey }
      const user = await getOrderUser(order.user_id)
      if (!user || !user.openid) return logResult('skipped', '用户缺少openid')
      const messageOrder = await enrichOrder(order)
      try {
        await sendWechatMessage(user.openid, templateId, messageOrder, scene, remark)
        return logResult('sent', '', user.openid)
      } catch (error) {
        return logResult('failed', error.message || String(error))
      }
    }
  }
}
```

- [ ] **Step 4: Run notifier tests**

Run: `node --test docte-master/uniCloud-alipay/cloudfunctions/common/cicada-subscription-notifier/index.test.js`

Expected: PASS for success, duplicate, template missing, OpenID missing, and WeChat failure cases.

### Task 2: Replace duplicated admin/client senders

**Files:**
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/package.json`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/package.json`
- Modify: `docte-master/uniCloud-alipay/database/cicada_subscription_logs.schema.json`
- Modify: `docte-master/uniCloud-alipay/database/cicada_subscription_logs.index.json`
- Modify: `docte-master/uniCloud-alipay/database/INDEXES.md`

**Interfaces:**
- Consumes: Task 1 `createSubscriptionNotifier()`.
- Produces: existing local `sendOrderSubscription(order, scene, remark, options?)` behavior backed by the shared module.

- [ ] **Step 1: Load the shared notifier with package/local fallback**

```js
function loadSubscriptionNotifierModule() {
  try { return require('cicada-subscription-notifier') }
  catch (packageError) { return require('../common/cicada-subscription-notifier') }
}
```

- [ ] **Step 2: Replace duplicated token/send/log functions**

```js
let subscriptionNotifier
function getSubscriptionNotifier() {
  if (!subscriptionNotifier) {
    subscriptionNotifier = createSubscriptionNotifier({ db, httpclient: uniCloud.httpclient, getEnvValue })
  }
  return subscriptionNotifier
}

function sendOrderSubscription(order = {}, scene = '', remark = '', options = {}) {
  return getSubscriptionNotifier().sendOrderSubscription(order, scene, remark, options)
}
```

- [ ] **Step 3: Add schema and index metadata**

Add optional string property `dedupe_key` and a non-unique `dedupe_key, status` lookup index. Extend the scene enum with existing `payment_rejected` and `process_tip` values so current log writes remain valid.

- [ ] **Step 4: Run existing subscription mapping tests**

Run: `node --test docte-master/uniCloud-alipay/cloudfunctions/common/cicada-subscription-message/index.test.js`

Expected: PASS.

### Task 3: Notify on first inbound delivery callback

**Files:**
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/logistics-lifecycle.js`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/logistics-lifecycle.test.js`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/index.obj.js`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/package.json`

**Interfaces:**
- Consumes: Task 1 `createSubscriptionNotifier()`.
- Produces: `shouldNotifyInboundDelivery(segment, existingCache, nextCache): boolean`.

- [ ] **Step 1: Add failing lifecycle tests**

```js
test('only first inbound delivery transition requests a notification', () => {
  assert.equal(shouldNotifyInboundDelivery('out', { state: '1' }, { state: '3' }), true)
  assert.equal(shouldNotifyInboundDelivery('out', { state: '3' }, { state: '3' }), false)
  assert.equal(shouldNotifyInboundDelivery('back', { state: '1' }, { state: '3' }), false)
})
```

- [ ] **Step 2: Run callback test and verify failure**

Run: `node --test docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/logistics-lifecycle.test.js`

Expected: FAIL because `shouldNotifyInboundDelivery` is missing.

- [ ] **Step 3: Implement and call the transition helper**

```js
function shouldNotifyInboundDelivery(segment, existing = {}, next = {}) {
  return segment === 'out' && String(existing.state || '') !== '3' && String(next.state || '') === '3'
}

await db.collection('cicada_orders').doc(found.order._id).update(updateData)
if (shouldNotifyInboundDelivery(found.segment, existingCache, reconciled.cache)) {
  await subscriptionNotifier.sendOrderSubscription(
    { ...found.order, ...updateData },
    'order_received',
    '寄修设备已签收'
  )
}
```

- [ ] **Step 4: Run lifecycle tests**

Run: `node --test docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/logistics-lifecycle.test.js`

Expected: PASS, including stale and duplicate callbacks.

### Task 4: Contextual mini-program authorization

**Files:**
- Create: `docte-master/utils/subscription-prompt.js`
- Create: `docte-master/utils/subscription-prompt.test.mjs`
- Modify: `docte-master/pages/index/index.vue`

**Interfaces:**
- Produces: `getSubscriptionScenesForAction(action): string[]`.
- Consumes: `getSubscriptionConfig()` items shaped as `{ scene, templateId }`.

- [ ] **Step 1: Write failing action-map tests**

```js
test('repair submission requests inbound and quote allowances', () => {
  assert.deepEqual(getSubscriptionScenesForAction('repair_submit'), [
    'repair_submit', 'device_receive_ship', 'payment_quote'
  ])
})

test('quote decisions request a return-shipment allowance', () => {
  assert.deepEqual(getSubscriptionScenesForAction('quote_reject'), ['device_receive_ship'])
  assert.deepEqual(getSubscriptionScenesForAction('warranty_confirm'), ['device_receive_ship'])
})
```

- [ ] **Step 2: Run utility test and verify failure**

Run: `node --test docte-master/utils/subscription-prompt.test.mjs`

Expected: FAIL because the utility does not exist.

- [ ] **Step 3: Implement action mapping and scene-aware prompt**

```js
export const SUBSCRIPTION_ACTION_SCENES = Object.freeze({
  repair_submit: ['repair_submit', 'device_receive_ship', 'payment_quote'],
  track_view: ['device_receive_ship'],
  wechat_pay: ['payment_quote', 'device_receive_ship'],
  payment_proof: ['payment_quote', 'device_receive_ship'],
  warranty_confirm: ['device_receive_ship'],
  quote_reject: ['device_receive_ship']
})
```

Remove `cicada_subscription_prompted_v1`. Keep a per-action in-flight Promise map, select only configured templates for the action, and limit the request to five IDs. Do not suppress later completed business actions with the same action name because each may need a fresh one-time allowance.

- [ ] **Step 4: Wire free-warranty and rejection actions**

Call `requestStatusSubscription('warranty_confirm')` before confirming free warranty and `requestStatusSubscription('quote_reject')` before rejecting a quote. Remove the obsolete invoice application prompt.

- [ ] **Step 5: Run utility tests and mini-program build**

Run: `node --test docte-master/utils/subscription-prompt.test.mjs`

Expected: PASS.

Run: `npm run build:mp-weixin` from `docte-master`.

Expected: successful WeChat mini-program build.

### Task 5: Full verification and delivery

**Files:**
- Review: all files listed in Tasks 1-4.

**Interfaces:**
- Consumes all prior task outputs.
- Produces a verified branch commit.

- [ ] **Step 1: Run targeted Node tests**

Run:

```powershell
node --test uniCloud-alipay/cloudfunctions/common/cicada-subscription-message/index.test.js
node --test uniCloud-alipay/cloudfunctions/common/cicada-subscription-notifier/index.test.js
node --test uniCloud-alipay/cloudfunctions/cicada-express-callback/logistics-lifecycle.test.js
node --test utils/subscription-prompt.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Check deployed subscription configuration**

Run: `npm run check:subscription` from `pc-admin`.

Expected: all five templates report `[ok]`.

- [ ] **Step 3: Run local acceptance gate**

Run: `npm run check` from `docte-master`.

Expected: build, client secret check, and package size check all pass.

- [ ] **Step 4: Review and commit only implementation files**

```powershell
git diff --check
git status --short
git add -- docte-master/uniCloud-alipay/cloudfunctions/common/cicada-subscription-notifier docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/package.json docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/package.json docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/index.obj.js docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/package.json docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/logistics-lifecycle.js docte-master/uniCloud-alipay/cloudfunctions/cicada-express-callback/logistics-lifecycle.test.js docte-master/uniCloud-alipay/database/cicada_subscription_logs.schema.json docte-master/uniCloud-alipay/database/cicada_subscription_logs.index.json docte-master/uniCloud-alipay/database/INDEXES.md docte-master/utils/subscription-prompt.js docte-master/utils/subscription-prompt.test.mjs docte-master/pages/index/index.vue docs/superpowers/plans/2026-08-14-wechat-business-notifications.md
git commit -m "feat: add automatic wechat business notifications"
```

Do not stage `.superpowers/`, `output/`, `.playwright-cli/`, or `pc-admin/invoice-preview.png`.
