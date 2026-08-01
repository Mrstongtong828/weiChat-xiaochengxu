# Automation Notification Center Design

## Architecture

The notification center is a read-only aggregation layer. It does not persist reminder rows, create a new order status, or send external messages. Current source data remains authoritative.

```text
MainLayout notification bell
  -> cicada-admin-order.getNotificationSummary
  -> cicada-admin-customer.getWarrantyAlerts (existing endpoint)
  -> grouped reminder panel
  -> existing work order / customer / logistics / settlement / invoice pages
```

The frontend requests the two domain endpoints in parallel after the authenticated admin shell mounts and when the staff member selects refresh. A failed source is represented as unavailable within the panel and must not block the layout.

## Backend

### `cicada-admin-order.getNotificationSummary`

Add a read-only endpoint with existing `view_order` authentication. It returns only the order-domain groups visible to the current role:

| Key | Source rule | Roles | Severity |
| --- | --- | --- | --- |
| `quote` | existing `matchesTodoType(order, 'quote')` | admin, engineer, support | info |
| `payment` | existing `matchesTodoType(order, 'payment')` | admin, finance | warning |
| `invoice` | existing `matchesTodoType(order, 'invoice')` | admin, finance | warning |
| `logistics` | existing logistics exception calculation | admin, engineer, support | critical/warning from exception type |
| `sla_warning` | `getSlaInfo(order).level === 'warning'` | admin, engineer, support | warning |
| `sla_critical` | `getSlaInfo(order).level === 'critical'` | admin, engineer, support | critical |

The endpoint must extract the current logistics exception implementation into a shared internal helper so that `getLogisticsExceptions` and notification summary use identical rules. Its response shape is:

```js
{
  total: 12,
  groups: [{
    key: 'sla_critical',
    title: 'SLA 已超时',
    severity: 'critical',
    count: 3,
    route: { path: '/workorder', query: { sla: 'critical' } },
    samples: [{ id: 'order-id', title: '工单 SO2026...', desc: '检测阶段已停留 26 小时' }]
  }],
  unavailable: []
}
```

Each group returns at most five samples. Samples contain an order identifier, title, description, and route metadata only. The endpoint does not return phone numbers, addresses, payment proofs, carrier credentials, or raw provider payloads.

### Warranty Source

`cicada-admin-customer.getWarrantyAlerts` already produces the needed categories and counts. `MainLayout` calls it only for `admin` and `support`, which are the existing roles allowed to open Customer Management, then turns its counts into `warranty_missing`, `warranty_expiring`, and `warranty_expired` groups. It uses its existing role check and returns no phone number.

The frontend requests the first five rows for a selected/all category and combines the response with the returned category counts. Clicking a warranty group routes to `CustomerManagement` with `alert=<category>` so the existing warranty panel opens on that category.

## Permission Boundary

- The order endpoint filters its own groups on the server using the authenticated admin role, not a frontend role flag.
- The customer endpoint retains its existing server permission check. The frontend does not request warranty data for finance staff because that role has no related processing destination in the UI.
- The panel is an additional presentation layer. Existing destination APIs continue to enforce their own permissions after navigation.

## Frontend

### Header Interaction

Add a bell icon button in `MainLayout` before the mini-program button. It contains an Element Plus badge with total visible reminders, including `99+` capping. Opening the popover loads no new data unless the user chooses refresh; closing it does not mutate any reminder state.

The popover is 440px on desktop and full-width below 768px:

1. Header: `提醒中心`, total visible count, refresh icon button.
2. Unavailable source notice: compact warning line, without a blocking modal.
3. Group rows: severity marker, group title, count, up to five representative items, and `查看全部` command.
4. Empty state: zero count and an explicit no-pending-reminders message.

No sidebar entry, new route, unread flag, read acknowledgement, or snackbar history is added.

### Destination Routing

| Reminder | Route |
| --- | --- |
| Warranty category | `/customers?alert=missing|expiring|expired` |
| Logistics exception | `/logistics?tab=exception` |
| Pending quote | `/workorder?todo=quote` |
| Pending payment verification | `/workorder?todo=payment` |
| Pending invoice | `/invoices?status=pending` |
| SLA warning / critical | `/workorder?sla=warning|critical` |

Destination views will initialize or react to these query parameters, then use their existing filters. No reminder-specific editor is added.

## Error Handling And Performance

- The order endpoint scans only the same bounded order data already used by existing todo and logistics summaries. It avoids N+1 lookups and returns samples after grouping.
- The header uses a 30-second in-memory cooldown to avoid duplicate requests when a user rapidly opens and closes the popover. Explicit refresh bypasses it.
- An unavailable source returns a partial successful response. The bell still displays the count of healthy sources.
- The system recalculates on the next shell load, explicit refresh, or destination return; no scheduler is needed for this in-app phase.

## Testing

1. Backend role tests cover group visibility for admin, engineer, finance, and support.
2. Backend response test confirms sample data excludes phone, payment proof, and provider credential fields.
3. UI test covers zero state, unavailable source, 99+ badge, group navigation, and existing route filters.
4. Regression checks cover the existing order todo summary, logistics exception list, warranty alert list, and production Vite build.

## Deployment

Deploy `cicada-admin-order` and `cicada-admin-customer` through HBuilderX after the frontend is deployed. No database collection, index, scheduled trigger, or external environment variable is introduced by this phase.
