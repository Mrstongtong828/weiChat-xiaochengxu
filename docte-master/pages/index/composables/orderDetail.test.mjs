import assert from 'node:assert/strict'
import test from 'node:test'

import { createOrderDetailView } from './orderDetail.js'

test('工单详情完整回显多产品、寄修信息和真实时间线', () => {
	const detail = createOrderDetailView({
		items: [
			{
				_id: 'item-1',
				product_name: '牙科光固化机',
				product_category: '光固化设备',
				product_model: 'G8',
				sn: 'SN-001',
				buy_date: '2026-07-01',
				fault_desc: '按键无响应，偶发黑屏',
				voucher_urls: ['cloud://voucher-1'],
				image_urls: ['cloud://fault-1'],
				video_urls: ['cloud://fault-video-1']
			},
			{
				_id: 'item-2',
				product_name: '牙科种植机',
				product_model: 'Surgic Pro',
				sn: 'SN-002',
				fault_desc: '转速不稳定'
			}
		],
		shipOutInfo: {
			name: '王医生',
			phone: '13800138000',
			detail: '广东省佛山市测试路 1 号',
			logistics_company: '顺丰快递',
			logistics_no: 'SF123456'
		},
		shipBackInfo: {
			name: '李护士',
			phone: '13900139000',
			unit: '测试口腔诊所',
			detail: '广东省广州市回寄路 2 号'
		},
		timeline: [
			{ title: '提交报修单', desc: '您的报修申请已提交', time: 1785456000000, done: true },
			{ title: '工程师检测', description: '正在检测设备', createTime: '2026-07-31 10:30' }
		]
	})

	assert.equal(detail.items.length, 2)
	assert.deepEqual(detail.items[0], {
		id: 'item-1',
		name: '牙科光固化机',
		category: '光固化设备',
		model: 'G8',
		sn: 'SN-001',
		buyDate: '2026-07-01',
		faultDesc: '按键无响应，偶发黑屏',
		vouchers: [{ id: 'voucher-0', type: 'image', url: 'cloud://voucher-1' }],
		images: [{ id: 'image-0', type: 'image', url: 'cloud://fault-1' }],
		videos: [{ id: 'video-0', type: 'video', url: 'cloud://fault-video-1' }]
	})
	assert.equal(detail.items[1].faultDesc, '转速不稳定')
	assert.equal(detail.shipOut.name, '王医生')
	assert.equal(detail.shipOut.logisticsNo, 'SF123456')
	assert.equal(detail.shipBack.unit, '测试口腔诊所')
	assert.deepEqual(detail.timeline.map((item) => [item.title, item.desc, item.time]), [
		['提交报修单', '您的报修申请已提交', '2026-07-31 08:00'],
		['工程师检测', '正在检测设备', '2026-07-31 10:30']
	])
})

test('旧工单缺失字段时提供稳定的详情回显占位', () => {
	const detail = createOrderDetailView({ items: [{}], timeline: [] })

	assert.equal(detail.items[0].name, '设备信息待同步')
	assert.equal(detail.items[0].model, '待同步')
	assert.equal(detail.items[0].sn, '待同步')
	assert.equal(detail.items[0].buyDate, '未填写')
	assert.equal(detail.items[0].faultDesc, '未填写')
	assert.equal(detail.shipOut.name, '待同步')
	assert.equal(detail.shipBack.address, '待同步')
	assert.deepEqual(detail.timeline, [])
})

test('旧工单通用附件字段按图片和视频回显且不重复', () => {
	const detail = createOrderDetailView({
		items: [{
			image_urls: ['cloud://legacy-image.jpg'],
			media_urls: [
				'cloud://legacy-image.jpg',
				{ url: 'cloud://legacy-video.mp4', type: 'video' },
				{ fileID: 'cloud://legacy-photo.png', type: 'image' }
			]
		}]
	})

	assert.deepEqual(detail.items[0].images.map((item) => item.url), [
		'cloud://legacy-image.jpg',
		'cloud://legacy-photo.png'
	])
	assert.deepEqual(detail.items[0].videos.map((item) => item.url), ['cloud://legacy-video.mp4'])
})
