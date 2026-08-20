import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assertBuildBudget, assertNoEagerHeavyPreloads, cleanBuildOutput } from './build-output.mjs'

test('clean build removes stale assets but recreates an empty output directory', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cicada-admin-build-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const output = join(root, 'dist')
  await mkdir(join(output, 'assets'), { recursive: true })
  await writeFile(join(output, 'assets', 'WorkOrder-old.js'), 'old')

  await cleanBuildOutput(output)

  await assert.rejects(readFile(join(output, 'assets', 'WorkOrder-old.js')), /ENOENT/)
  await writeFile(join(output, '.ready'), 'ok')
  assert.equal(await readFile(join(output, '.ready'), 'utf8'), 'ok')
})

test('build budget rejects output that contains too many stale assets', () => {
  assert.throws(
    () => assertBuildBudget({ fileCount: 121, totalBytes: 1024 }, { maxFiles: 120, maxBytes: 12 * 1024 * 1024 }),
    /文件数量 121 超过上限 120/
  )
})

test('entry html does not preload editor, spreadsheet or PDF modules', () => {
  const html = '<link rel="modulepreload" href="/assets/vendor-editor-old.js">'
  assert.throws(() => assertNoEagerHeavyPreloads(html), /不应在首屏预加载.*vendor-editor/)
})
