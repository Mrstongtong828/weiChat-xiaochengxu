import test from 'node:test'
import assert from 'node:assert/strict'

import { prepareAvatarImage } from './avatarImage.js'

test('large portrait images are cropped and compressed into a 512px webp avatar', async (t) => {
  const drawCalls = []
  const originalCreateImageBitmap = globalThis.createImageBitmap
  const originalDocument = globalThis.document

  globalThis.createImageBitmap = async () => ({ width: 2048, height: 3072, close() {} })
  globalThis.document = {
    createElement: (tag) => {
      assert.equal(tag, 'canvas')
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: (...args) => drawCalls.push(args) }),
        toBlob: (callback, type) => callback(new Blob([new Uint8Array(180_000)], { type }))
      }
    }
  }
  t.after(() => {
    globalThis.createImageBitmap = originalCreateImageBitmap
    globalThis.document = originalDocument
  })

  const original = {
    name: 'portrait.png',
    type: 'image/png',
    size: 7_560_264
  }
  const result = await prepareAvatarImage(original)

  assert.equal(result.name, 'portrait-avatar.webp')
  assert.equal(result.type, 'image/webp')
  assert.equal(result.size, 180_000)
  assert.deepEqual(drawCalls[0].slice(1), [0, 512, 2048, 2048, 0, 0, 512, 512])
})

test('unsupported files are rejected before decoding', async () => {
  await assert.rejects(
    prepareAvatarImage({ name: 'notes.pdf', type: 'application/pdf', size: 1024 }),
    /仅支持 JPG、PNG 或 WebP/
  )
})
