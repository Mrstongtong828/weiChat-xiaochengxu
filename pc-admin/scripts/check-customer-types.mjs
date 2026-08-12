import fs from 'node:fs'
import path from 'node:path'
import {
  CUSTOMER_TYPE_OPTIONS,
  customerTypeLabel,
  customerTypeOptionsWithCurrent,
  normalizeCustomerTypeValue,
  resolveCustomerTypeValue
} from '../src/config/customerTypes.js'

const projectRoot = process.cwd()
const expectedOptions = [
  { value: 'clinic', label: '门诊/医院' },
  { value: 'dealer', label: '代理商/经销商' }
]

const fail = (message) => {
  console.error(`[fail] ${message}`)
  process.exitCode = 1
}

const actualOptions = CUSTOMER_TYPE_OPTIONS.map(({ value, label }) => ({ value, label }))
if (JSON.stringify(actualOptions) !== JSON.stringify(expectedOptions)) {
  fail(`后台预设客户类型不正确: ${JSON.stringify(actualOptions)}`)
}

const miniConfigPath = path.resolve(projectRoot, '../docte-master/pages/index/composables/moduleConfig.js')
const miniConfigSource = fs.readFileSync(miniConfigPath, 'utf8')
const miniBlock = miniConfigSource.match(/export const customerTypeOptions\s*=\s*\[([\s\S]*?)\]/)
const miniOptions = miniBlock
  ? [...miniBlock[1].matchAll(/value:\s*['"]([^'"]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]/g)]
    .map(([, value, label]) => ({ value, label }))
  : []

if (JSON.stringify(miniOptions) !== JSON.stringify(expectedOptions)) {
  fail(`小程序预设客户类型与后台不一致: ${JSON.stringify(miniOptions)}`)
}

if (normalizeCustomerTypeValue('  连锁门诊  ') !== '连锁门诊') {
  fail('自定义客户类型没有正确去除首尾空格')
}
if (customerTypeLabel('连锁门诊') !== '连锁门诊') {
  fail('自定义客户类型没有原样显示')
}
if (customerTypeLabel('individual') !== '个人') {
  fail('历史 individual 类型没有兼容显示')
}
if (resolveCustomerTypeValue('个人') !== 'individual') {
  fail('历史“个人”筛选没有映射到 individual')
}
if (!customerTypeOptionsWithCurrent('连锁门诊').some(option => option.value === '连锁门诊')) {
  fail('当前自定义客户类型没有进入编辑下拉')
}

for (const schemaName of ['cicada_customers.schema.json', 'cicada_orders.schema.json']) {
  const schemaPath = path.resolve(projectRoot, '../docte-master/uniCloud-alipay/database', schemaName)
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  const customerType = schema.properties && schema.properties.customer_type
  if (!customerType || customerType.bsonType !== 'string' || customerType.minLength !== 1 || customerType.maxLength !== 40) {
    fail(`${schemaName} 的 customer_type 必须是 1 到 40 字符的字符串`)
  }
  if (Array.isArray(customerType.enum)) {
    fail(`${schemaName} 的 customer_type 不应再使用固定枚举`)
  }
}

const adminOrderPath = path.resolve(projectRoot, '../docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js')
const adminOrderSource = fs.readFileSync(adminOrderPath, 'utf8')
if (/fallbackMatchCond\.customer_type\s*=/.test(adminOrderSource) || /directMatchCond\.customer_type\s*=/.test(adminOrderSource)) {
  fail('工单类型筛选不能在 CRM 回填前下推 customer_type')
}
if (/updateData\.customer_type\s*=\s*customerType/.test(adminOrderSource)) {
  fail('手工建单不能静默覆盖已有 CRM 客户类型')
}

const adminCustomerPath = path.resolve(projectRoot, '../docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-customer/index.obj.js')
const adminCustomerSource = fs.readFileSync(adminCustomerPath, 'utf8')
if (!/customerType\s*=\s*\(cr\.data[\s\S]*?customer_type/.test(adminCustomerSource)) {
  fail('SN 识别结果必须回填关联客户类型')
}

if (!process.exitCode) {
  console.log('[ok] 客户类型预设与小程序一致，自定义和历史类型兼容正常')
}
