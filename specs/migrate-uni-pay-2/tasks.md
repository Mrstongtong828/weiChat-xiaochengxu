# Implementation Plan

- [ ] 1. Add the official uni-pay 2 module and secret-safe configuration layout
  - Import the official module without committing certificates or merchant
    credentials.
  - Add ignored local certificate and configuration paths plus a checked-in
    configuration example.
  - _Requirements: 6_

- [ ] 2. Add repair-to-payment link persistence
  - Add the `cicada_payment_links` schema and index declarations.
  - Add local validation helpers for amount, reference, and allowed status
    transitions.
  - _Requirements: 1, 3, 4, 7_

- [ ] 3. Implement the uni-pay repair payment adapter
  - Keep `createWechatPayPayment` and `syncWechatPayPayment` as the client API.
  - Delegate provider payment creation and query to uni-pay 2 while preserving
    ownership, quote, and amount checks.
  - _Requirements: 1, 2, 4, 6_

- [ ] 4. Add the verified callback bridge
  - Extend the uni-pay notification hook to find its payment link and update
    the repair order idempotently.
  - Preserve order events, timeline updates, and subscription notification.
  - _Requirements: 2, 3_

- [ ] 5. Integrate refund and preserve offline transfer
  - Route eligible admin refunds through the payment provider bridge.
  - Confirm that offline transfer proof upload and manual reconciliation are
    unchanged.
  - _Requirements: 3, 5_

- [ ] 6. Add focused regression coverage and build verification
  - Test payment-link state transitions and duplicate callback behavior.
  - Run cloud-function syntax checks, existing payment crypto tests, and
    `npm run check`.
  - _Requirements: 1, 2, 3, 4, 5, 6_

- [ ] 7. Prepare but do not execute production deployment
  - Document required console steps: upload public modules, configure
    certificates and credentials, create indexes, URLize `uni-pay-co`, and run
    a low-value device payment.
  - _Requirements: 1, 2, 6_
