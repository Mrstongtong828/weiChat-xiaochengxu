import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, 'cloud.js'), 'utf8')

test('cloud object calls opt out of SDK-managed loading UI', () => {
	assert.match(
		source,
		/importObject\(name,\s*\{\s*customUI:\s*true\s*\}\)/,
		'cloud object SDK UI must stay disabled so timeout errors cannot leave a global loading mask'
	)
})
