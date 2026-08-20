import test from 'node:test'
import assert from 'node:assert/strict'

import { createLatestTask } from './latestTask.js'

test('only the latest overlapping request may commit its result', async () => {
  const task = createLatestTask()
  let resolveFirst
  const firstResult = new Promise(resolve => { resolveFirst = resolve })

  const first = task.run(() => firstResult)
  const second = task.run(async () => 'new filters')
  assert.deepEqual(await second, { accepted: true, value: 'new filters' })

  resolveFirst('old filters')
  assert.deepEqual(await first, { accepted: false, value: 'old filters' })
})

test('a stale request error is returned as ignored instead of rejecting the active view', async () => {
  const task = createLatestTask()
  let rejectFirst
  const firstResult = new Promise((resolve, reject) => { rejectFirst = reject })
  const first = task.run(() => firstResult)
  await task.run(async () => 'current')

  rejectFirst(new Error('old request failed'))
  const result = await first
  assert.equal(result.accepted, false)
  assert.match(result.error.message, /old request failed/)
})
