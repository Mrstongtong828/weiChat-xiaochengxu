const assert = require('node:assert/strict')
const test = require('node:test')

global.uniCloud = { database: () => ({}) }

const { isAllowedFeedbackImage } = require('./index.obj').__test__

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
