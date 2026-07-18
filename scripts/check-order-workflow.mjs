import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const require = createRequire(import.meta.url)

const files = {
  workflow: 'docte-master/uniCloud-alipay/cloudfunctions/common/cicada-order-workflow/index.js',
  eventsSchema: 'docte-master/uniCloud-alipay/database/cicada_order_events.schema.json',
  userSchema: 'docte-master/uniCloud-alipay/database/cicada_users.schema.json',
  adminOrder: 'docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-order/index.obj.js',
  clientOrder: 'docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js',
  adminSys: 'docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-sys/index.obj.js',
  pcOrderApi: 'pc-admin/src/api/order.js',
  pcUsers: 'pc-admin/src/views/Users.vue',
  pcWorkOrder: 'pc-admin/src/views/WorkOrder.vue',
  indexes: 'docte-master/uniCloud-alipay/database/INDEXES.md'
}

const failures = []

for (const [label, file] of Object.entries(files)) {
  if (!existsSync(resolve(root, file))) failures.push(`${label}: missing ${file}`)
}

const expect = (condition, label) => {
  if (!condition) failures.push(label)
}

if (!failures.some(item => item.includes('workflow'))) {
  const source = read(files.workflow)
  expect(/ORDER_STATUS_TRANSITIONS/.test(source), 'workflow: missing transition table')
  expect(/assertOrderStatusTransition/.test(source), 'workflow: missing transition assertion')
  expect(/PERMISSIONS/.test(source), 'workflow: missing permission matrix')
  expect(/finance/.test(source) && /support/.test(source), 'workflow: missing finance/support roles')
  const workflow = require(resolve(root, files.workflow))
  const allowedTransitions = [
    ['pending', 'sent'],
    ['pending', 'received'],
    ['pending', 'cancelled'],
    ['sent', 'received'],
    ['sent', 'cancelled'],
    ['received', 'inspecting'],
    ['received', 'fixing'],
    ['received', 'cancelled'],
    ['inspecting', 'fixing'],
    ['inspecting', 'shipped'],
    ['inspecting', 'cancelled'],
    ['fixing', 'shipped'],
    ['fixing', 'completed'],
    ['fixing', 'cancelled'],
    ['shipped', 'completed']
  ]
  for (const [from, to] of allowedTransitions) {
    expect(workflow.canTransitionOrderStatus(from, to), `workflow: missing allowed transition ${from}->${to}`)
  }
  for (const [from, to] of [['completed', 'fixing'], ['cancelled', 'received'], ['received', 'shipped']]) {
    expect(!workflow.canTransitionOrderStatus(from, to), `workflow: illegal transition allowed ${from}->${to}`)
  }
  try {
    workflow.assertOrderStatusTransition('completed', 'fixing')
    failures.push('workflow: completed->fixing did not throw')
  } catch (e) {
    expect(String(e.message || e).includes('已完成工单不能改为处理中'), 'workflow: illegal transition error is not explicit')
  }
}

if (!failures.some(item => item.includes('eventsSchema'))) {
  const schema = read(files.eventsSchema)
  for (const field of ['order_id', 'order_no', 'source', 'action', 'actor_id', 'actor_role', 'before', 'after', 'create_time']) {
    expect(schema.includes(`"${field}"`), `events schema: missing ${field}`)
  }
  for (const action of ['create_order', 'update_status', 'issue_quote', 'confirm_quote', 'upload_payment_proof', 'confirm_payment', 'apply_invoice', 'update_invoice', 'ship_return', 'cancel_order']) {
    expect(schema.includes(`"${action}"`), `events schema: missing action enum ${action}`)
  }
}

if (!failures.some(item => item.includes('userSchema'))) {
  const schema = read(files.userSchema)
  expect(schema.includes('"finance"') && schema.includes('"support"'), 'user schema: missing finance/support role enum')
}

if (!failures.some(item => item.includes('adminOrder'))) {
  const source = read(files.adminOrder)
  for (const symbol of ['assertOrderStatusTransition', 'assertRolePermission', 'logOrderEvent', 'getWorkflowConfig']) {
    expect(source.includes(symbol), `admin order: missing ${symbol}`)
  }
  for (const action of ['update_status', 'issue_quote', 'confirm_payment', 'update_invoice', 'ship_return', 'update_remarks', 'add_timeline']) {
    expect(source.includes(`'${action}'`), `admin order: missing event action ${action}`)
  }
  expect(source.includes('cicada_subscription_logs') && source.includes("status: 'sent'") && source.includes("status: 'skipped'") && source.includes("status: 'failed'"), 'admin order: subscription log statuses missing')
}

if (!failures.some(item => item.includes('clientOrder'))) {
  const source = read(files.clientOrder)
  expect(source.includes('assertOrderStatusTransition'), 'client order: missing shared transition assertion')
  expect(source.includes('assertOrderPayable') && source.includes('已取消工单不可付款'), 'client order: missing cancelled payment guard')
  for (const action of ['create_order', 'confirm_quote', 'upload_payment_proof', 'apply_invoice', 'cancel_order', 'wechat_pay_confirmed']) {
    expect(source.includes(`'${action}'`), `client order: missing event action ${action}`)
  }
}

if (!failures.some(item => item.includes('adminSys'))) {
  const source = read(files.adminSys)
  expect(source.includes("'finance'") && source.includes("'support'"), 'admin sys: STAFF_ROLES missing finance/support')
}

if (!failures.some(item => item.includes('pcOrderApi'))) {
  expect(read(files.pcOrderApi).includes('getWorkflowConfig'), 'pc order api: missing getWorkflowConfig')
}

if (!failures.some(item => item.includes('pcUsers'))) {
  const source = read(files.pcUsers)
  expect(source.includes('财务') && source.includes('客服'), 'pc users: missing finance/support role options')
}

if (!failures.some(item => item.includes('pcWorkOrder'))) {
  const source = read(files.pcWorkOrder)
  for (const symbol of ['workflowConfig', 'canPerformOrderAction', 'getAllowedStatusOptions']) {
    expect(source.includes(symbol), `pc workorder: missing ${symbol}`)
  }
  expect(source.includes('buildBatchConfirmMessage') && source.includes('跳过'), 'pc workorder: missing batch success/skip confirmation')
}

if (!failures.some(item => item.includes('indexes'))) {
  expect(read(files.indexes).includes('cicada_order_events'), 'indexes: missing cicada_order_events indexes')
}

if (failures.length) {
  console.error('Workflow closure checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Workflow closure checks passed.')
