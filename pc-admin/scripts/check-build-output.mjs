import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { assertBuildBudget, assertNoEagerHeavyPreloads, collectBuildStats } from './build-output.mjs'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const outputPath = join(projectRoot, 'dist')
const stats = assertBuildBudget(await collectBuildStats(outputPath))
assertNoEagerHeavyPreloads(await readFile(join(outputPath, 'index.html'), 'utf8'))
console.log(`[build] output verified: ${stats.fileCount} files, ${(stats.totalBytes / 1024 / 1024).toFixed(2)}MB`)
