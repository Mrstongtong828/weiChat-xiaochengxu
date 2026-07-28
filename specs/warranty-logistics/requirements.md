# Warranty And Logistics Requirements

## Scope

The PC admin serves customer service, engineers, and finance staff who need to resolve missing warranty data before quoting and inspect an order's shipping progress without leaving the admin system.

This change adds two operational workflows:

1. A warranty action list for incomplete, expiring, and expired device warranties.
2. An on-demand logistics trace view backed by the existing Kuaidi100 provider and its callback cache.

## User Stories

- As a service operator, I want to see devices whose warranty information is incomplete or about to expire so that I can correct the record before deciding whether a repair is chargeable.
- As an engineer, I want a consistent warranty result after editing a device so that the same conclusion is reused in future work orders.
- As an operator, I want to manually refresh and inspect outbound or return shipping events so that I can resolve delivery exceptions from the ledger.

## Acceptance Criteria

1. When an administrator opens the warranty action list, the system shall show devices with missing warranty data, warranties expiring within 30 days, and expired warranties, including the calculated expiry date and suggested action.
2. When an authorized staff member saves a device purchase date, warranty months, or explicit expiry date, the system shall recalculate its warranty state and use that result for later device and order lookups.
3. When a staff member selects an outbound or return tracking number from the logistics ledger, the system shall display the latest cached delivery events and allow a manual refresh.
4. When a manual logistics refresh succeeds, the system shall update the order's segment cache and return the normalized events, current status, provider, and refresh time.
5. When Kuaidi100 credentials are unavailable or the carrier cannot be recognized, the system shall explain that live tracking is unavailable while preserving previously cached events.
6. Only roles already allowed to view orders may view tracking details; only roles allowed to maintain customer devices may edit warranty fields.
7. The system shall record warranty device changes and manual logistics refreshes in the existing audit/event trail without storing carrier credentials or customer phone numbers in logs.

## Non-Goals

- Sending reminder SMS, WeChat template messages, or email notifications.
- Supporting a second logistics provider in this change.
- Changing the existing order state machine or automatically confirming warehouse receipt solely from a manual refresh.
