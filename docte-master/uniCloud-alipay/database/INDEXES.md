# Database Index Checklist

Create these indexes in the uniCloud database console before production traffic.

## cicada_users

- `token`
- `openid`
- `username`
- `role`

## cicada_orders

- `order_no` unique
- `user_id, create_time desc`
- `status, create_time desc`
- `engineer_id, create_time desc`

## cicada_order_items

- `order_id`

## cicada_user_devices

- `user_id, create_time desc`
- `user_id, sn`

## cicada_addresses

- `user_id`

## cicada_feedbacks

- `user_id, create_time desc`
- `status, create_time desc`

## cicada_fault_kb

- `category_id`

## cicada_product_categories

- `status, sort asc`

## cicada_rate_limits

- `key` unique
- `reset_time`

## cicada_subscription_logs

- `order_id, create_time desc`
- `user_id, create_time desc`
- `scene, create_time desc`
- `status, create_time desc`

## Notes

- Keep `order_no` unique. The code now uses a time prefix plus 32 bits of random suffix, but the unique index is still the final guard.
- Clean old `cicada_rate_limits` records periodically by deleting rows whose `reset_time` is older than the current timestamp.
- Run `cicada-maintenance.run({ token, dryRun: true })` before changing production data.
