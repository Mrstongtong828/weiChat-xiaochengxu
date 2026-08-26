import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectDir = resolve(scriptDir, '..')
const repoDir = resolve(projectDir, '..')

const [view, layout, api, adminFunction, clientFunction, clientOrderFunction, feedbackSchema, eventSchema] = await Promise.all([
  readFile(resolve(projectDir, 'src/views/Feedback.vue'), 'utf8'),
  readFile(resolve(projectDir, 'src/components/Layout/MainLayout.vue'), 'utf8'),
  readFile(resolve(projectDir, 'src/api/admin.js'), 'utf8'),
  readFile(resolve(repoDir, 'docte-master/uniCloud-alipay/cloudfunctions/cicada-admin-sys/index.obj.js'), 'utf8'),
  readFile(resolve(repoDir, 'docte-master/uniCloud-alipay/cloudfunctions/cicada-client-user/index.obj.js'), 'utf8'),
  readFile(resolve(repoDir, 'docte-master/uniCloud-alipay/cloudfunctions/cicada-client-order/index.obj.js'), 'utf8'),
  readFile(resolve(repoDir, 'docte-master/uniCloud-alipay/database/cicada_feedbacks.schema.json'), 'utf8'),
  readFile(resolve(repoDir, 'docte-master/uniCloud-alipay/database/cicada_order_events.schema.json'), 'utf8')
])

assert.match(clientFunction, /status:\s*'待处理',[\s\S]*?is_read:\s*false/)
assert.match(clientOrderFunction, /type:\s*'投诉',[\s\S]*?status:\s*'待处理',[\s\S]*?is_read:\s*false/)
assert.match(adminFunction, /where\(\{\s*is_read:\s*false\s*\}\)\.count\(\)/)
assert.match(adminFunction, /async markFeedbackRead\(params\)[\s\S]*?PERMISSIONS\.view_feedback[\s\S]*?is_read:\s*true/)
assert.match(adminFunction, /async deleteFeedbacks\(params\)[\s\S]*?PERMISSIONS\.handle_feedback[\s\S]*?feedback_delete/)
assert.match(api, /adminSys}\/markFeedbackRead/)
assert.match(api, /adminSys}\/deleteFeedbacks/)
assert.match(view, /type="selection"/)
assert.match(view, /canDeleteFeedback[\s\S]*?superadmin[\s\S]*?admin[\s\S]*?support/)
assert.match(view, /ElMessageBox\.confirm\([\s\S]*?永久删除/)
assert.match(view, /feedback-unread-changed/)
assert.match(layout, /feedbackUnreadCount/)
assert.match(layout, /setInterval\(loadFeedbackUnread,\s*30000\)/)
assert.equal(JSON.parse(feedbackSchema).properties.is_read.bsonType, 'bool')
assert.ok(JSON.parse(eventSchema).properties.action.enum.includes('feedback_delete'))

console.log('[pass] feedback batch deletion and unread badge contracts are wired end-to-end')
