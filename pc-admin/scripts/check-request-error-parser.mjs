import { parseCloudErrorDetail } from '../src/utils/errorMessage.js'

const cases = [
  {
    name: 'auth failure',
    input: '{"code":"400","message":"error: 鉴权失败：非管理人员禁止访问该接口. stack: Error: 鉴权失败"}',
    expected: '鉴权失败：非管理人员禁止访问该接口'
  },
  {
    name: 'method missing',
    input: '{"code":"400","message":"error: Method[getTodoSummary] was not found in index.obj.js. stack: Error: Method[getTodoSummary] was not found"}',
    expected: 'Method[getTodoSummary] was not found in index.obj.js'
  }
]

for (const item of cases) {
  const actual = parseCloudErrorDetail(item.input)
  if (actual !== item.expected) {
    console.error(`[fail] ${item.name}: expected "${item.expected}", got "${actual}"`)
    process.exitCode = 1
  } else {
    console.log(`[ok] ${item.name}`)
  }
}
