import test from 'node:test'
import assert from 'node:assert/strict'
import { getPreferredStatusOption } from './orderStatus.js'

test('回寄可执行时默认选择已回寄，而不是检测中', () => {
  assert.equal(getPreferredStatusOption(['检测中', '处理中', '已回寄']), '已回寄')
})

test('没有已回寄选项时保留状态机首个选项', () => {
  assert.equal(getPreferredStatusOption(['检测中', '处理中']), '检测中')
  assert.equal(getPreferredStatusOption([]), '')
})
