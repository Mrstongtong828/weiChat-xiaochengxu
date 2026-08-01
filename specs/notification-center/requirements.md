# Automation Notification Center Requirements

## Scope

Add an in-app notification center for PC admin staff. It aggregates existing operational signals into actionable reminders without changing the order workflow or duplicating the source data.

The center covers:

1. Missing or expiring warranty information.
2. Logistics exceptions: no pickup, stalled shipment, or carrier-reported exception.
3. Pending quote confirmation, payment proof verification, and invoice processing.
4. SLA warning and SLA overdue orders.

## User Stories

- As a customer service operator, I want to see warranty and logistics risks as soon as I enter the admin system so that I can resolve customer-impacting issues promptly.
- As an engineer, I want to see logistics risks and orders approaching or exceeding SLA, plus quote work assigned to the service process, so that I can prioritize my work.
- As a finance operator, I want to see payment verification and invoice processing reminders without seeing unrelated customer contact data.
- As an administrator, I want one total count and grouped reminders that take staff directly to the existing processing screen.

## Reminder Categories And Ownership

| Category | Source | Visible Roles | Destination |
| --- | --- | --- | --- |
| Warranty missing / expiring / expired | Customer device warranty calculation | admin, support | Customer Management warranty action list |
| Logistics exception | Existing logistics exception query | admin, engineer, support | Logistics Monitor exception tab |
| Pending quote | Existing order todo rule | admin, engineer, support | Work Order filtered to pending quote |
| Payment verification | Existing order todo rule | admin, finance | Settlement / Work Order pending payment view |
| Pending invoice | Existing invoice application rule | admin, finance | Invoice Management pending view |
| SLA warning / overdue | Existing SLA calculation | admin, engineer, support | Work Order filtered by SLA level |

## Acceptance Criteria

1. When an authorized staff member signs in or refreshes the admin shell, the system shall show a single in-app reminder count and grouped reminder list containing only categories visible to that role.
2. When a reminder group is selected, the system shall navigate to the existing processing page with the matching filter, rather than creating a second editing workflow.
3. When a source item is resolved, the system shall remove it from the next reminder query according to the existing source-domain rules.
4. When a user has no applicable reminders, the system shall show an explicit empty state and a zero count.
5. When the reminder source query is unavailable, the system shall show a non-blocking unavailable state and must not prevent normal use of the admin dashboard.
6. When a reminder query is generated, the system shall return only the minimum metadata needed for the count, category, severity, and navigation; it shall not expose customer phone numbers, payment proofs, provider credentials, or new sensitive data.
7. The system shall reuse the existing role permissions for customer devices, orders, logistics, settlement, and invoices. Frontend visibility must not be the only authorization boundary.
8. While reminders are in scope, the system shall not send SMS, email, or WeChat subscription messages, create a new order status, or change the sidebar.

## Business Rules

- "In-app push" means an authenticated PC-admin notification badge and expandable reminder panel. It is refreshed on shell load and by an explicit refresh action; this phase does not require browser push or external messaging.
- The center does not store a second copy of reminders. Counts and group samples are calculated from current source data to prevent stale reminders.
- Severity is derived from the source: SLA overdue and carrier exceptions are critical; SLA warning, stalled logistics, and payment/invoice pending are warnings; warranty data completion and quote pending are informational unless their existing source marks them as urgent.
- The panel returns at most five representative entries per group and the total count. Full resolution remains on the owning page.

## Non-Goals

- Per-user read, dismiss, snooze, assignment, or notification-history persistence.
- SMS, email, WeChat template messages, browser push, or third-party notification services.
- A new sidebar menu item or duplicate order/customer editor.
- Changing existing SLA thresholds, payment deadlines, order state transitions, or carrier exception rules.
