# Five Subscription Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge repair-order subscription notifications onto the five existing WeChat templates, remove retired notification branches, and document the exact production configuration still required.

**Architecture:** Keep business events (`repair_submitted`, `quote_issued`, and so on) distinct for logs while mapping them to five template configuration keys. The public cloud function returns the five configured template IDs to the mini program; the two order cloud functions share equivalent event-to-template and keyword-building behavior. Invoice issuance remains an order data operation and no longer emits a standalone subscription message.

**Tech Stack:** uni-app, Vue 3, uniCloud cloud objects, Node.js, WeChat Mini Program subscription messages.

## Global Constraints

- The canonical application and backend are under `docte-master/`.
- Reuse exactly five existing templates; do not add quote or invoice templates.
- `inspection_completed`, `repair_started`, and `review_invite` must not emit subscription messages.
- Preserve `payment_rejected` as a distinct business/log scene while reusing the payment/quote template.
- Do not hard-code incomplete or redacted template IDs.
- Preserve unrelated user changes in the working tree.

---

### Task 1: Audit the existing convergence changes

**Files:**
- Inspect: `docte-master/pages/index/index.vue`
- Inspect: `docte-master/uniCloud-alipay/cloudfunctions/cicada-client-public/index.obj.js`
- Inspect: `docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js`
- Inspect: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- Inspect: `docte-master/上线配置清单.md`

**Interfaces:**
- Consumes: business notification scenes and service-space environment variables.
- Produces: an exact gap list against the five-template specification.

- [ ] **Step 1: Compare commits `ae06140` and `60bd10c` with the requested mapping**

Run: `git show --stat ae06140 60bd10c`
Expected: the mini-program page, three cloud functions, and launch checklist are covered.

- [ ] **Step 2: Locate every retired scene and standalone invoice send**

Run: `rg -n "inspection_completed|repair_started|review_invite|invoice_issued|sendOrderSubscription" docte-master`
Expected: no live send branch remains for the four retired/merged scenes.

### Task 2: Finalize event mapping and payload behavior

**Files:**
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js`
- Modify: `docte-master/uniCloud-alipay/cloudfunctions/cicada-client-public/index.obj.js`

**Interfaces:**
- Consumes: order records and business scene names.
- Produces: `getSubscriptionTemplateId(scene)` and `buildSubscriptionData(order, scene, remark)` behavior aligned to the five templates.

- [ ] **Step 1: Keep one explicit map from business scenes to five environment keys**

The effective keys are `REPAIR_SUBMIT`, `DEVICE_RECEIVE_SHIP`, `PAYMENT_QUOTE`, `PROCESS_TIP`, and `ORDER_FINISH_INVOICE`.

- [ ] **Step 2: Keep payment rejection distinct in logs**

For `payment_rejected`, use `PAYMENT_QUOTE`, retain scene `payment_rejected`, and log that the pending-payment template is reused.

- [ ] **Step 3: Remove standalone invoice notification calls**

Invoice state updates continue to persist and audit normally. Only `order_completed` sends the completion template, with the electronic-invoice sentence appended to the repair-result value.

- [ ] **Step 4: Match payload keyword identifiers to the five real templates**

Use the keyword identifiers shown in WeChat Public Platform for each template. This step cannot be completed from redacted IDs alone; collect the full ID and keyword identifier/type list for all five templates before deployment.

### Task 3: Finalize mini-program subscription request

**Files:**
- Modify: `docte-master/pages/index/index.vue`

**Interfaces:**
- Consumes: `getSubscriptionTemplates()` result from `cicada-client-public`.
- Produces: a de-duplicated template-ID request without legacy IDs.

- [ ] **Step 1: Filter, de-duplicate, and request only configured IDs**

Build the ID list with `new Set`, excluding empty values.

- [ ] **Step 2: Enforce the platform's per-call template limit**

Do not assume five IDs can be accepted in one call. Verify the active WeChat base-library limit and split authorization across user gestures if the production limit is below five.

### Task 4: Document production configuration

**Files:**
- Modify: `docte-master/上线配置清单.md`
- Modify: `docte-master/README.md`

**Interfaces:**
- Consumes: the five complete WeChat template IDs and keyword definitions.
- Produces: copyable environment-variable and keyword mapping instructions.

- [ ] **Step 1: List the five environment variables and reused business scenes**

Document the five keys and state explicitly that quote is merged into pending-payment and invoice is merged into completion.

- [ ] **Step 2: Record the missing deployment inputs without inventing values**

Require the full template ID and each template's keyword identifier/type list from WeChat Public Platform.

### Task 5: Verify and review

**Files:**
- Check: all modified files.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: syntax/build/diff evidence and a standards/spec review.

- [ ] **Step 1: Check cloud-function syntax**

Run: `node --check` for `cicada-client-order`, `cicada-admin-order`, and `cicada-client-public`.
Expected: all commands exit 0.

- [ ] **Step 2: Build the mini program**

Run: `npm run check` from `docte-master/`.
Expected: production mp-weixin build succeeds.

- [ ] **Step 3: Check patch whitespace**

Run: `git diff --check`
Expected: no output and exit 0.

- [ ] **Step 4: Review against repository standards and this specification**

Inspect the final diff for unrelated edits, missing scenes, stale environment keys, payload-key mismatches, duplicate sends, and undocumented deployment inputs.
