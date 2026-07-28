# Warranty And Logistics Design

## Existing Foundations

- `cicada_admin_customer` already calculates `effective_expire` and `warranty_state` from device records.
- `cicada_admin_order` already owns order permissions, two-way shipment metadata, `track_cache`, and logistics exception detection.
- `cicada-express-provider` already normalizes Kuaidi100 carrier aliases, events, state, cache records, and configuration availability.
- `cicada-express-callback` writes provider push events into `cicada_orders.track_cache`.

## Warranty Action List

### API

Add `getWarrantyAlerts` to `cicada-admin-customer`.

- Inputs: `status` (`missing`, `expiring`, `expired`, or empty), `page`, `pageSize`.
- Role: reuse the existing customer/device view permission.
- Source: `cicada_user_devices`.
- Response: normalized device and customer identity, purchase date, warranty months, calculated expiry, warranty state, alert type, and suggested action.
- Rules:
  - `missing`: no explicit expiry and either purchase date or warranty months is absent.
  - `expiring`: an effective expiry is between now and 30 days from now.
  - `expired`: effective expiry is before today.

The existing `saveCustomerDevice` remains the only mutation path. It recalculates the warranty result and logs the device change, so the list does not introduce another write model.

### UI

Add a compact action panel to the Customer Management device tab. It has filter pills, counts, and a table. Selecting a row loads the customer detail and opens the existing device editor. This reuses current forms and avoids a duplicate warranty edit dialog.

## Live Logistics Trace

### API

Add `getLogisticsTrack` to `cicada-admin-order`.

- Inputs: `orderId`, `segment` (`out` or `back`), `refresh` (boolean).
- Role: reuse `view_order` permission.
- Source: `cicada_orders.ship_out_info` or `ship_back_info` plus `track_cache`.
- Behavior:
  1. Read normalized shipment information via the existing `getOrderShipInfo` helper.
  2. Return cached events when the cache is fresh and `refresh` is false.
  3. Otherwise call `expressProvider.query`.
  4. On a successful query, save the normalized cache at `track_cache[segment]` and set `logistics_track_update_time`.
  5. On an unavailable configuration or query failure, return the cache with an availability/error state rather than dropping prior events.

The method must not change `order.status`; warehouse receipt remains a separately confirmed action. A successful manual refresh writes an existing order event with no phone number or provider credentials.

### UI

Add a "查看轨迹" action to each populated outbound or return shipment in Logistics Monitor. The action opens one drawer containing carrier, tracking number, cache/refresh time, current state, and a chronological event timeline. The refresh button calls the API with `refresh: true`.

## Security And Data Handling

- Do not return carrier configuration or phone values.
- Validate `segment` against the two supported values.
- Derive company and tracking number from the stored order only; do not accept them as client inputs.
- Continue using existing role checks and audit/event writers.

## Verification

1. Unit-level syntax checks for changed cloud functions.
2. Vite transformation check for changed admin views.
3. Existing URL health checks remain green.
4. Manual acceptance: device with incomplete data appears in the warranty list; device edit changes its category; a configured tracking number opens cached events and a manual refresh updates its timestamp.

## Deployment

Deploy `cicada-admin-customer` and `cicada-admin-order` after the frontend build. Live tracking requires `EXPRESS_PROVIDER=kuaidi100`, `KUAIDI100_KEY`, and `KUAIDI100_CUSTOMER` in the cloud function environment. Push updates additionally require the existing callback settings.
