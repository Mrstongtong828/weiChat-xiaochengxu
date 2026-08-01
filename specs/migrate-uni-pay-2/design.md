# uni-pay 2 Migration Design

## Architecture

`cicada_orders` remains the repair-domain aggregate. `uni-pay` owns a provider
payment order and payment-provider protocol details. The two records are linked
by a stable repair order ID and an application-generated payment reference.

```text
Repair quote
  -> cicada-client-order payment adapter
  -> uni-pay-co create payment order
  -> WeChat Pay cashier
  -> uni-pay-co verified callback / query
  -> repair-payment bridge
  -> cicada_orders payment_status = paid
```

## Module Boundaries

### uni-pay 2 module

- Add the official `uni-pay` uni-module under `docte-master/uni_modules`.
- Deploy its `uni-pay-co`, `uni-pay`, and `uni-config-center` modules only in a
  separately approved deployment step.
- Keep merchant credentials and certificate files in ignored local paths or
  service-space configuration. They must not be committed.

### Repair payment adapter

`cicada-client-order` remains the client-facing cloud object. Its existing
`createWechatPayPayment` and `syncWechatPayPayment` methods retain their public
contract for the mini program. Internally they delegate creation, verification,
and refund operations to a narrow uni-pay adapter.

This prevents payment-provider changes from altering the repair UI or the
offline-transfer flow.

### Callback bridge

The uni-pay callback handler is the provider-verification boundary. Once it
accepts a successful provider notification, it calls a repair-payment bridge
that:

1. finds the linked repair order;
2. verifies the expected amount, app ID, and merchant ID;
3. atomically marks the repair order paid if it is not already paid;
4. appends exactly one payment event and timeline item;
5. leaves duplicate callbacks as successful no-ops.

The provider callback must not trust a client-side success result.

## Data Model

Add a `cicada_payment_links` collection instead of changing historical repair
orders or treating `uni-pay-orders` as the repair aggregate.

Required fields:

- `repair_order_id`: `cicada_orders._id`.
- `out_trade_no`: unique merchant payment reference.
- `uni_pay_order_no`: provider-layer order number.
- `amount_fen`: immutable quoted amount in fen.
- `provider`: `wxpay`.
- `status`: `pending`, `paid`, `closed`, `refunded`, or `failed`.
- `transaction_id`, `paid_at`, `refund_id`, and audit timestamps.

Indexes:

- unique `out_trade_no`;
- unique `repair_order_id` + active-payment discriminator where supported;
- query index on `status`, `create_time`.

The source schema and index files are local artifacts. Creating indexes in the
production console is a separate deployment operation.

## Configuration

The uni-pay config has one entry for `env-00jy6g4qwi94`, a URLized `uni-pay-co`
callback, and WeChat Pay V3 mini-program settings. It uses local certificate
paths for `apiclient_cert.pem`, `apiclient_key.pem`, and `pub_key.pem`.

No certificate content, AppSecret, APIv3 key, merchant private key, or service
space credential is committed. A checked-in example lists only required names
and paths.

## Compatibility

- The mini program continues calling `createRepairWechatPay` and
  `syncRepairWechatPay`.
- Existing paid repair orders remain paid; no backfill runs during migration.
- Existing pending orders can use the legacy pending payment record only until
  a user initiates a new payment attempt; new attempts create a uni-pay link.
- Offline transfer remains outside uni-pay.

## Verification

1. Unit-test idempotent payment-link transition behavior with duplicate
   provider callbacks.
2. Run the existing crypto test suite and syntax checks for changed cloud
   objects.
3. Build the mini program and assert the frontend payment API contract remains
   unchanged.
4. Before production deployment, use a low-value real-device payment to verify
   cashier launch, callback receipt, amount verification, and order state.

## Trade-offs

uni-pay 2 adds its own order table and deployment surface, but it replaces
custom signing, callback parsing, and provider API handling. Keeping a repair
payment link is intentionally more work than directly using `uni-pay-orders`,
but it preserves the existing repair workflow, admin contracts, and audit data.
