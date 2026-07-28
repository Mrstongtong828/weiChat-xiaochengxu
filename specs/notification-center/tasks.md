# Implementation Plan

- [x] 1. Add role-filtered order reminder aggregation.
  - Add `getNotificationSummary` to `cicada-admin-order` using current todo, logistics exception, and SLA calculation rules.
  - Extract shared logistics exception collection so the notification summary and logistics monitor cannot drift.
  - Return counts and no more than five redacted samples per group.
  - _Requirement: 1, 3, 5, 6, 7_

- [x] 2. Make warranty reminder data available to the shared shell.
  - Reuse `getWarrantyAlerts` category counts and rows for authorized customer-service roles.
  - Ensure the response and reminder mapping continue to exclude customer phone data.
  - _Requirement: 1, 3, 6, 7_

- [x] 3. Implement the in-app reminder panel in the admin layout.
  - Add the top-header bell, total badge, role-safe grouped popover, empty state, partial-unavailable state, and explicit refresh control.
  - Use the existing Element Plus icon and component conventions without changing the sidebar.
  - _Requirement: 1, 4, 5, 6, 8_

- [x] 4. Add destination filter routing.
  - Support reminder query parameters in Customer Management, Work Order, Logistics Monitor, and Invoice Management.
  - Route each group to its existing processing surface without duplicating edit workflows.
  - _Requirement: 2, 3, 8_

- [x] 5. Verify and document deployment.
  - Run cloud-function syntax checks, Vite template/build validation, and existing reminder-source regression checks.
  - Record deployment of the changed cloud functions and the fact that no new collection, index, scheduler, or environment variable is needed.
  - _Requirement: 1, 4, 5, 6, 7_
