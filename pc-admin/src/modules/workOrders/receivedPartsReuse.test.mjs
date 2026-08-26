import test from 'node:test'
import assert from 'node:assert/strict'

import { reuseReceivedPartsInRepairRecord } from './receivedPartsReuse.js'

test('confirmed received parts fill blank repair details and carry receipt photos', () => {
  const result = reuseReceivedPartsInRepairRecord({
    products: [
      { productName: '高速手机', receivedDetail: '' },
      { productName: '洁牙机', receivedDetail: '外观有划痕，已单独核对' }
    ],
    repairPhotos: [{ fileID: 'cloud://repair/a.jpg', url: 'https://temp/a.jpg' }],
    receivedParts: [
      { name: '手机主体', quantity: 1, remark: '' },
      { name: '扳手', quantity: 2, remark: '包装完好' }
    ],
    receivedPhotos: [
      { fileID: 'cloud://repair/a.jpg', url: 'https://temp/a-new.jpg' },
      { fileID: 'cloud://receipt/b.jpg', url: 'https://temp/b.jpg' }
    ],
    receiptStatus: 'confirmed'
  })

  assert.equal(result.products[0].receivedDetail, '手机主体 x 1\n扳手 x 2（包装完好）')
  assert.equal(result.products[1].receivedDetail, '外观有划痕，已单独核对')
  assert.deepEqual(result.photos.map(photo => photo.fileID), [
    'cloud://repair/a.jpg',
    'cloud://receipt/b.jpg'
  ])
})

test('pending receipt does not change the repair record', () => {
  const result = reuseReceivedPartsInRepairRecord({
    products: [{ receivedDetail: '' }],
    repairPhotos: [],
    receivedParts: [{ name: '手机主体', quantity: 1 }],
    receivedPhotos: [{ fileID: 'cloud://receipt/a.jpg' }],
    receiptStatus: 'pending'
  })

  assert.equal(result.products[0].receivedDetail, '')
  assert.deepEqual(result.photos, [])
})

test('carried receipt photos respect the repair photo limit', () => {
  const result = reuseReceivedPartsInRepairRecord({
    products: [],
    repairPhotos: [{ fileID: 'saved-1' }, { fileID: 'saved-2' }],
    receivedParts: [],
    receivedPhotos: Array.from({ length: 8 }, (_, index) => ({ fileID: `received-${index + 1}` })),
    receiptStatus: 'confirmed',
    photoLimit: 6
  })

  assert.equal(result.photos.length, 6)
  assert.deepEqual(result.photos.slice(0, 2).map(photo => photo.fileID), ['saved-1', 'saved-2'])
})
