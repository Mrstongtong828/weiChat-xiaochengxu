# Maintenance Runbook

Use the `cicada-maintenance` cloud object after deploying the latest cloud functions.

## Dry run first

Call:

```js
uniCloud.importObject('cicada-maintenance').run({
  token: '<admin-token>',
  dryRun: true
})
```

This reports:

- legacy devices found in `cicada_devices` that can be copied to `cicada_user_devices`
- feedback records missing `status` or `create_time`
- staff accounts still storing plaintext `password`
- orders that have no `cicada_order_items`

## Apply data fixes

After reviewing the dry-run result:

```js
uniCloud.importObject('cicada-maintenance').run({
  token: '<admin-token>',
  dryRun: false
})
```

## Manual follow-up

- Broken orders are only reported, not deleted. Review them before fixing or removing them.
- The migration scans up to 500 records per run. Run it again if the result shows the scanned count is 500.
- Create the indexes listed in `INDEXES.md` before opening traffic.
