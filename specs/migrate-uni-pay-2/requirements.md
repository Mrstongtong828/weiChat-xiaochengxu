# uni-pay 2 Migration Requirements

## Problem

The mini program uses a custom WeChat Pay V3 implementation inside
`cicada-client-order`. The payment infrastructure needs to move to uni-pay 2
while preserving the repair-order workflow and its existing order records.

## Scope

- Add uni-pay 2 as the payment-provider integration.
- Keep `cicada_orders` as the repair business order and fulfillment source.
- Create a one-to-one mapping from a repair order to a uni-pay payment order.
- Move payment initiation, payment confirmation, query, and refund integration
  behind the uni-pay 2 provider.
- Preserve the current mini-program payment entry and the offline-transfer
  payment alternative.

## Non-goals

- Do not migrate historical repair orders into uni-pay tables.
- Do not store merchant private keys, APIv3 keys, or certificates in source
  control.
- Do not deploy cloud functions, alter merchant-platform settings, or change
  production database data as part of local implementation.
- Do not replace the repair-order state machine with uni-pay's generic order
  workflow.

## User Stories

1. As a repair customer, I can pay an approved repair quote through WeChat Pay
   and receive a clear success or cancellation result.
2. As an operations user, I can trust a repair order's paid status only after
   uni-pay confirms it through an authenticated callback or server-side query.
3. As a finance user, I can refund an eligible payment without breaking the
   repair-order audit trail.

## Acceptance Criteria

1. When a customer starts payment for an eligible quoted repair order, the
   system shall create or reuse one pending uni-pay order whose amount equals
   the repair quote in fen.
2. When WeChat Pay reports a successful payment, the system shall verify the
   provider result, amount, AppID, and merchant identifier before marking the
   linked `cicada_orders` record as paid.
3. When a payment callback is delivered more than once, the system shall keep
   the repair order and payment audit state idempotent.
4. When payment is cancelled or pending, the system shall leave the repair
   order unpaid and allow a later retry without creating conflicting payment
   records.
5. When a customer chooses offline transfer, the system shall retain the
   existing proof-upload and manual-reconciliation flow.
6. When uni-pay credentials or callback configuration are missing, the system
   shall return an actionable configuration error without exposing secrets.
7. The migration shall not require editing existing historical repair orders.

## Constraints

- Target runtime is the existing `uniCloud-alipay` service space.
- The current payment merchant uses WeChat Pay V3 and the WeChat Pay public-key
  verification model.
- Production credentials and certificates are configured outside version
  control.
- Deployment requires a separate, explicit approval after local verification.
