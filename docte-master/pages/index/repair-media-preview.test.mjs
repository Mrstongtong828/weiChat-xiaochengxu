import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('报修附件缩略项点击进入统一预览处理', () => {
	assert.match(
		source,
		/v-for="media in product\.media"[^>]*class="media-thumb tap"[^>]*@click="previewRepairMedia\(index, media\)"/
	)
	assert.match(source, /@click\.stop="removeRepairMedia\(index, media\.id\)"/)
})

test('报修附件图片和视频分别调用微信预览能力', () => {
	const previewBlock = source.slice(
		source.indexOf('const previewRepairMedia ='),
		source.indexOf('const addRepairMedia =')
	)

	assert.match(previewBlock, /media\.type === 'image'[\s\S]*?uni\.previewImage\(\{ current: url, urls \}\)/)
	assert.match(previewBlock, /media\.type === 'video' && uni\.previewMedia[\s\S]*?uni\.previewMedia\(\{/)
	assert.match(previewBlock, /sources: \[\{ url, type: 'video' \}\]/)
	assert.match(previewBlock, /视频播放失败，请稍后重试/)
})
