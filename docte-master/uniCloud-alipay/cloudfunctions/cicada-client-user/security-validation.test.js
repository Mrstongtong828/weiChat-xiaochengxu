const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

global.uniCloud = { database: () => ({}) }

const { isAllowedFeedbackImage } = require('./index.obj').__test__
const source = readFileSync(require.resolve('./index.obj'), 'utf8')

test('反馈图片只允许 cloud 文件 ID 或可信 HTTPS 主机', () => {
  assert.equal(isAllowedFeedbackImage('cloud://env/path/image.jpg'), true)
  assert.equal(isAllowedFeedbackImage('https://bucket.oss-cn-hangzhou.aliyuncs.com/image.jpg'), true)
  assert.equal(isAllowedFeedbackImage('https://env-abc.tcb.qcloud.la/image.jpg'), true)
})

test('反馈图片拒绝欺骗域名、明文 HTTP 和带认证信息的 URL', () => {
  assert.equal(isAllowedFeedbackImage('https://aliyuncs.com.evil.example/image.jpg'), false)
  assert.equal(isAllowedFeedbackImage('https://evil.example/path/cloudbase/image.jpg'), false)
  assert.equal(isAllowedFeedbackImage('http://bucket.aliyuncs.com/image.jpg'), false)
  assert.equal(isAllowedFeedbackImage('https://user:pass@bucket.aliyuncs.com/image.jpg'), false)
})

test('反馈提交先校验内容再进入新版限流桶', () => {
  const block = source.slice(source.indexOf('async submitFeedback'), source.indexOf('async getComplaintList'))
  assert.match(source, /feedback_submit: \{ windowMs: 60 \* 1000, max: 20 \}/)
  assert.match(source, /feedback_day: \{ windowMs: 24 \* 60 \* 60 \* 1000, max: 100 \}/)
  assert.ok(block.indexOf("if (!feedbackContent)") < block.indexOf("checkRateLimit('feedback_submit'"))
  assert.doesNotMatch(block, /checkRateLimit\('feedback',/)
})
