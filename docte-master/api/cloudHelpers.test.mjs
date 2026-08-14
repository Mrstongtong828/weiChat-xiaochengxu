import assert from 'node:assert/strict'
import test from 'node:test'
import { uploadToCloud } from './cloudHelpers.js'

test('cloud upload forwards native progress updates', async () => {
	const previousUniCloud = globalThis.uniCloud
	let progressListener = null
	globalThis.uniCloud = {
		uploadFile(options) {
			const task = {
				onProgressUpdate(listener) {
					progressListener = listener
				}
			}
			queueMicrotask(() => {
				progressListener?.({ progress: 42, totalBytesSent: 420, totalBytesExpectedToSend: 1000 })
				options.success({ fileID: 'cloud://bucket/video.mp4' })
			})
			return task
		}
	}

	try {
		const updates = []
		const result = await uploadToCloud('wxfile://video.mp4', 'repair/videos', 'mp4', {
			onProgress: (event) => updates.push(event.progress)
		})
		assert.deepEqual(updates, [42])
		assert.equal(result.fileID, 'cloud://bucket/video.mp4')
	} finally {
		globalThis.uniCloud = previousUniCloud
	}
})
