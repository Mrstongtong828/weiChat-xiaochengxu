#!/usr/bin/env node
/**
 * Compare database schema property keys to git HEAD and ensure permission locks.
 * Usage: node docte-master/scripts/check-schema-permissions.mjs
 * Exit 1 if any collection lost properties or is missing permission:false locks.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const dbCandidates = [
  path.resolve(cwd, 'docte-master/uniCloud-alipay/database'),
  path.resolve(cwd, 'uniCloud-alipay/database')
]
const dbDir = dbCandidates.find((dir) => fs.existsSync(dir))
if (!dbDir) {
  console.error('Cannot find uniCloud-alipay/database from', cwd)
  process.exit(1)
}
// Repo root keeps schemas under docte-master/; when cwd is already docte-master,
// git paths still need the docte-master/ prefix if that is how they are tracked.
let gitPrefix = 'uniCloud-alipay/database'
try {
  execSync('git show HEAD:docte-master/uniCloud-alipay/database/cicada_orders.schema.json', {
    stdio: ['ignore', 'ignore', 'ignore']
  })
  gitPrefix = 'docte-master/uniCloud-alipay/database'
} catch {
  // fall back to non-prefixed path for alternate layouts
}
const files = fs.readdirSync(dbDir).filter((f) => f.endsWith('.schema.json')).sort()
let failed = false

for (const file of files) {
  const rel = `${gitPrefix}/${file}`
  const current = JSON.parse(fs.readFileSync(path.join(dbDir, file), 'utf8'))
  let previous = null
  try {
    const raw = execSync(`git show HEAD:${rel}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    previous = JSON.parse(raw)
  } catch {
    previous = null
  }
  const curKeys = new Set(Object.keys(current.properties || {}))
  const prevKeys = new Set(Object.keys((previous && previous.properties) || {}))
  const lost = [...prevKeys].filter((k) => !curKeys.has(k)).sort()
  const gained = [...curKeys].filter((k) => !prevKeys.has(k)).sort()
  const perm = current.permission || {}
  const locked = ['read', 'create', 'update', 'delete'].every((k) => perm[k] === false)
  if (!locked || lost.length) {
    failed = true
    console.error(`[fail] ${file}: locked=${locked} lost=${JSON.stringify(lost)} gained=${JSON.stringify(gained)} perm=${JSON.stringify(perm)}`)
  } else {
    console.log(`[ok] ${file} props=${curKeys.size}${gained.length ? ` gained=${gained.join(',')}` : ''}`)
  }
}

if (failed) {
  console.error('Schema permission/property check failed.')
  process.exitCode = 1
} else {
  console.log('Schema permission/property check passed.')
}
