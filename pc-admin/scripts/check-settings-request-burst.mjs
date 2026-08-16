import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectDir = resolve(scriptDir, '..')
const source = await readFile(resolve(projectDir, 'src/views/Settings.vue'), 'utf8')

const getGuidesCalls = source.match(/await getGuides\(token\)/g) || []
assert.equal(
  getGuidesCalls.length,
  1,
  'Settings must fetch guides once and share the result between documents and videos'
)

const mountedBody = source.match(/onMounted\(async \(\) => \{([\s\S]*?)\n\}\)/)?.[1] || ''
assert.match(mountedBody, /await loadSettings\(\)/, 'Settings must finish its initial request before starting optional work')
assert.doesNotMatch(mountedBody, /loadGuides|loadMaintenanceVideos|loadSurveyRecords/, 'inactive tabs must not load on mount')

assert.match(source, /@tab-change="handleContentTabChange"/, 'inactive tab data must load when the tab is opened')
assert.match(source, /if \(tabName === 'guides'\)[\s\S]*loadGuideContent\(\)/)
assert.match(source, /if \(tabName === 'survey'[^)]*\)[\s\S]*loadSurveyRecords\(\)/)

console.log('[pass] settings avoids duplicate and eager cloud-function requests')
