import assert from 'node:assert/strict'
import test from 'node:test'
import {
	canRejectRepairQuote,
	canUploadPaymentProofForOrder,
	compressVideoForUpload,
  getCloudFileId,
  getPreviewUrl,
  isCloudFileId
} from './uploadUtils.js'

test('quote rejection is blocked while a transfer proof is awaiting reconciliation', () => {
	const baseOrder = { id: 'order-1', quoteStatus: 'issued', paymentStatus: 'pending', paymentProofs: [] }
	assert.equal(canRejectRepairQuote(baseOrder), true)
	assert.equal(canRejectRepairQuote({ ...baseOrder, paymentStatus: 'uploaded' }), false)
	assert.equal(canRejectRepairQuote({ ...baseOrder, paymentProofs: [{ fileID: 'cloud://proof.jpg' }] }), false)
	assert.equal(canRejectRepairQuote({ ...baseOrder, paymentStatus: 'paid' }), false)
})

test('allows proof upload only for active payable orders pending verification', () => {
	const baseOrder = { id: 'order-1', statusKey: 'fixing', quoteStatus: 'issued' }
	assert.equal(canUploadPaymentProofForOrder({ ...baseOrder, paymentStatus: 'pending' }, 100), true)
	assert.equal(canUploadPaymentProofForOrder({ ...baseOrder, quoteStatus: 'confirmed', paymentStatus: 'rejected' }, 100), true)
	assert.equal(canUploadPaymentProofForOrder({ ...baseOrder, quoteStatus: 'draft', paymentStatus: 'pending' }, 100), false)
	assert.equal(canUploadPaymentProofForOrder({ ...baseOrder, paymentStatus: 'uploaded' }, 100), false)
	assert.equal(canUploadPaymentProofForOrder({ ...baseOrder, statusKey: 'completed', paymentStatus: 'pending' }, 100), false)
})

test('extracts only durable cloud file IDs from uploaded items', () => {
  assert.equal(getCloudFileId({ fileID: 'cloud://env.bucket/proof.jpg' }), 'cloud://env.bucket/proof.jpg')
  assert.equal(getCloudFileId({ url: 'https://example.com/proof.jpg' }), '')
  assert.equal(getCloudFileId({ path: 'wxfile://tmp/proof.jpg' }), '')
})

test('prefers a runtime resolved URL for cloud-backed previews', () => {
  assert.equal(getPreviewUrl({
    fileID: 'cloud://env.bucket/proof.jpg',
    resolvedUrl: 'https://temp.example.com/proof.jpg',
    path: 'wxfile://expired/proof.jpg'
  }), 'https://temp.example.com/proof.jpg')
})

test('recognizes only non-empty cloud file IDs', () => {
  assert.equal(isCloudFileId('cloud://env.bucket/proof.jpg'), true)
  assert.equal(isCloudFileId('cloud://'), false)
  assert.equal(isCloudFileId('wxfile://tmp/proof.jpg'), false)
})

test('compresses a large repair video before cloud upload', async () => {
	const previousUni = globalThis.uni
	let receivedOptions = null
	globalThis.uni = {
		compressVideo: async (options) => {
			receivedOptions = options
			return { tempFilePath: 'wxfile://compressed.mp4', size: 8 * 1024 * 1024 }
		}
	}
	try {
		const result = await compressVideoForUpload({
			tempFilePath: 'wxfile://original.mp4',
			size: 30 * 1024 * 1024
		})
		assert.equal(result.path, 'wxfile://compressed.mp4')
		assert.equal(result.size, 8 * 1024 * 1024)
		assert.deepEqual(receivedOptions, { src: 'wxfile://original.mp4', quality: 'medium' })
	} finally {
		globalThis.uni = previousUni
	}
})

test('skips extra compression for an already small repair video', async () => {
	const previousUni = globalThis.uni
	let compressionCalls = 0
	globalThis.uni = {
		compressVideo: async () => {
			compressionCalls += 1
			return { tempFilePath: 'wxfile://compressed.mp4' }
		}
	}
	try {
		const result = await compressVideoForUpload({
			tempFilePath: 'wxfile://small.mp4',
			size: 5 * 1024 * 1024
		})
		assert.equal(result.path, 'wxfile://small.mp4')
		assert.equal(compressionCalls, 0)
	} finally {
		globalThis.uni = previousUni
	}
})
