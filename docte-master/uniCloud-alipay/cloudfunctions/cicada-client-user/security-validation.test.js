const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

const insertedFeedbacks = []
const mockUser = { _id: 'user-1', token: 'valid-token', token_expire: Date.now() + 60_000 }
const query = (data = []) => ({
  where() { return this },
  limit() { return this },
  async get() { return { data } }
})
const mockDb = {
  command: {
    or: (conditions) => conditions,
    neq: (value) => value
  },
  collection(name) {
    if (name === 'cicada_users') return query([mockUser])
    if (name === 'cicada_orders') return query([])
    if (name === 'cicada_feedbacks') {
      return {
        async add(record) {
          insertedFeedbacks.push(record)
          return { id: `feedback-${insertedFeedbacks.length}` }
        }
      }
    }
    return query([])
  }
}

global.uniCloud = { database: () => mockDb }

const clientUser = require('./index.obj')
const { isAllowedFeedbackImage } = clientUser.__test__
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

test('反馈提交保留内容和图片校验且不限制账号提交频次', () => {
  const block = source.slice(source.indexOf('async submitFeedback'), source.indexOf('async getComplaintList'))
  assert.match(block, /if \(!\['投诉', '建议'\]\.includes\(feedbackType\)\)/)
  assert.match(block, /if \(!feedbackContent\)/)
  assert.match(block, /if \(feedbackContent\.length > 500\)/)
  assert.match(block, /normalizeFeedbackImages\(images\)/)
  assert.doesNotMatch(source, /feedback_submit|feedback_day/)
  assert.doesNotMatch(block, /checkRateLimit/)
})

test('无效的选填工单不阻断带图片和手机号的反馈入库', async () => {
  insertedFeedbacks.length = 0
  const result = await clientUser.submitFeedback({
    token: mockUser.token,
    type: '建议',
    content: '希望优化售后处理进度提醒',
    images: ['cloud://env/feedback/images/test.jpg'],
    contact_type: 'phone',
    contact_value: '19705573921',
    rel_order_no: '111111'
  })

  assert.equal(result.code, 0)
  assert.equal(insertedFeedbacks.length, 1)
  assert.equal(insertedFeedbacks[0].content, '希望优化售后处理进度提醒')
  assert.deepEqual(insertedFeedbacks[0].images, ['cloud://env/feedback/images/test.jpg'])
  assert.equal(insertedFeedbacks[0].contact_type, 'phone')
  assert.equal(insertedFeedbacks[0].contact_value, '19705573921')
  assert.equal(insertedFeedbacks[0].rel_order_no, '')
})
