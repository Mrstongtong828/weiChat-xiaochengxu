import assert from 'node:assert/strict'
import test from 'node:test'

import { downloadCloudFileWithClient } from './cloudFile.js'

test('uses the cloud SDK download API when it is available', async () => {
	const calls = []
	const result = await downloadCloudFileWithClient({
		fileID: 'cloud://space/guides/repair.pdf',
		cloudClient: {
			downloadFile: async (options) => {
				calls.push(options)
				return { tempFilePath: 'wxfile://repair.pdf' }
			}
		},
		downloadFile: async () => assert.fail('HTTP fallback should not run')
	})

	assert.deepEqual(calls, [{ fileID: 'cloud://space/guides/repair.pdf' }])
	assert.equal(result.tempFilePath, 'wxfile://repair.pdf')
})

test('falls back to a temporary URL for Alipay uniCloud clients', async () => {
	const calls = []
	const result = await downloadCloudFileWithClient({
		fileID: 'cloud://space/guides/invoice.docx',
		cloudClient: {
			getTempFileURL: async (options) => {
				calls.push(['resolve', options])
				return { fileList: [{ tempFileURL: 'https://download.example/invoice.docx' }] }
			}
		},
		downloadFile: async (options) => {
			calls.push(['download', options])
			return { statusCode: 200, tempFilePath: 'wxfile://invoice.docx' }
		}
	})

	assert.deepEqual(calls, [
		['resolve', { fileList: ['cloud://space/guides/invoice.docx'] }],
		['download', { url: 'https://download.example/invoice.docx' }]
	])
	assert.equal(result.tempFilePath, 'wxfile://invoice.docx')
})

test('rejects a failed HTTP fallback response', async () => {
	await assert.rejects(() => downloadCloudFileWithClient({
		fileID: 'cloud://space/guides/repair.pdf',
		cloudClient: {
			getTempFileURL: async () => ({ fileList: [{ tempFileURL: 'https://download.example/repair.pdf' }] })
		},
		downloadFile: async () => ({ statusCode: 403 })
	}), /HTTP 403/)
})
