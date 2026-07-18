import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

const checks = [
  {
    file: 'docte-master/pages/index/index.vue',
    forbidden: [
      { label: 'SMS login copy', pattern: /\u77ed\u4fe1\u9a8c\u8bc1\u7801\u767b\u5f55/ },
      { label: 'disabled phone login UI', pattern: /phone-login\s+disabled/ }
    ]
  },
  {
    file: 'docte-master/api/auth.js',
    forbidden: [
      { label: 'phone login API wrapper', pattern: /loginWithPhone/ }
    ]
  },
  {
    file: 'docte-master/store/auth.js',
    forbidden: [
      { label: 'SMS code action', pattern: /sendCode/ },
      { label: 'SMS cloud API call', pattern: /sendSmsCode/ },
      { label: 'code login cloud API call', pattern: /loginWithCode/ }
    ]
  }
]

const failures = []

for (const check of checks) {
  const source = readFileSync(resolve(root, check.file), 'utf8')
  for (const item of check.forbidden) {
    if (item.pattern.test(source)) {
      failures.push(`${check.file}: ${item.label}`)
    }
  }
}

if (failures.length) {
  console.error('Found removed SMS-login code:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('No SMS-login UI or wrappers found.')
