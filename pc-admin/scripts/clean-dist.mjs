import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { cleanBuildOutput } from './build-output.mjs'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
await cleanBuildOutput(join(projectRoot, 'dist'))
console.log('[build] dist cleaned')

