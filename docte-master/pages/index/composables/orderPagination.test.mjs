import assert from 'node:assert/strict'
import test from 'node:test'

import {
	appendOrderPage,
	createOrderPaginationState,
	normalizeOrderPage
} from './orderPagination.js'

test('归一化数组和带分页信息的工单列表响应', () => {
	assert.deepEqual(normalizeOrderPage([{ id: 'R1' }], 30), {
		list: [{ id: 'R1' }],
		total: null,
		hasMore: false
	})
	assert.deepEqual(normalizeOrderPage({ list: [{ id: 'R1' }, { id: 'R2' }], total: 5 }, 2), {
		list: [{ id: 'R1' }, { id: 'R2' }],
		total: 5,
		hasMore: true
	})
})

test('追加下一页时按工单 ID 去重并保留服务端顺序', () => {
	assert.deepEqual(appendOrderPage(
		[{ id: 'R3' }, { id: 'R2', status: '旧状态' }],
		[{ id: 'R2', status: '新状态' }, { id: 'R1' }]
	), [
		{ id: 'R3' },
		{ id: 'R2', status: '新状态' },
		{ id: 'R1' }
	])
})

test('无总数时以返回条数判断是否还有下一页', () => {
	const fullPage = Array.from({ length: 30 }, (_, index) => ({ id: `R${index}` }))
	assert.equal(normalizeOrderPage(fullPage, 30).hasMore, true)
	assert.equal(normalizeOrderPage(fullPage.slice(0, 12), 30).hasMore, false)
})

test('刷新或账号变化时恢复第一页分页状态', () => {
	assert.deepEqual(createOrderPaginationState(30), {
		page: 1,
		pageSize: 30,
		hasMore: true,
		loadingMore: false
	})
})
