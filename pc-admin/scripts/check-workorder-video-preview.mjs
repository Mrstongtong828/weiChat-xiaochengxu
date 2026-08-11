import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectDir = resolve(scriptDir, '..')
const workOrderSource = await readFile(resolve(projectDir, 'src/views/WorkOrder.vue'), 'utf8')

assert.match(workOrderSource, /@click\.prevent="openOrderVideo\(video\)"/)
assert.match(workOrderSource, /<video[\s\S]*?:src="activeOrderVideoUrl"[\s\S]*?controls/)
assert.match(workOrderSource, /视频无法播放时可下载原文件/)

const { transformOrder } = await import('../src/utils/orderTransform.js')
const transformed = transformOrder({
  _id: 'order-video-contract',
  itemsList: [{
    video_urls: [
      { fileID: 'cloud://video-file-id' },
      { url: 'https://cdn.example.com/video.mp4' }
    ]
  }]
})

assert.deepEqual(transformed.itemsList[0].video_urls, [
  'cloud://video-file-id',
  'https://cdn.example.com/video.mp4'
])

console.log('[pass] work order videos use an in-app player and normalize media URL objects')
