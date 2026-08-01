# Implementation Plan

- [x] 1. Add warranty alert query to the customer cloud function.
  - Classify missing, expiring-within-30-days, and expired device warranties from the existing calculated warranty fields.
  - Return paged rows with customer context and a next-action label under existing device view permissions.
  - _Requirement: 1, 2, 6_

- [x] 2. Add the warranty action list to Customer Management.
  - Add an action panel with alert filter, count, and a direct path to the existing device editor.
  - Preserve the existing device save endpoint as the only mutation path.
  - _Requirement: 1, 2, 6_

- [x] 3. Add a secure logistics trace endpoint to the order cloud function.
  - Resolve the shipment from stored order metadata, return cached trace data, and refresh through the existing Kuaidi100 provider when requested.
  - Persist successful normalized traces and write a redacted event without changing order status.
  - _Requirement: 3, 4, 5, 6, 7_

- [x] 4. Add logistics trace access to the ledger.
  - Add an outbound/return trace action, drawer, event timeline, availability state, and explicit manual refresh control.
  - _Requirement: 3, 4, 5, 6_

- [x] 5. Verify and document deployment.
  - Run syntax and Vite transformation checks, then record required cloud function deployment and Kuaidi100 environment settings.
  - _Requirement: 4, 5, 7_
