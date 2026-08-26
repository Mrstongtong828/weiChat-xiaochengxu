const photoIdentity = (photo = {}) => String(
  photo.fileID || photo.fileId || photo.url || ''
).trim()

export const formatReceivedPartsDetail = (parts = []) => parts
  .map((part = {}) => {
    const name = String(part.name || part.part_name || '').trim()
    if (!name) return ''
    const quantity = Math.max(1, Number(part.quantity || part.qty || 1) || 1)
    const remark = String(part.remark || part.note || '').trim()
    return `${name} x ${quantity}${remark ? `（${remark}）` : ''}`
  })
  .filter(Boolean)
  .join('\n')
  .slice(0, 1000)

export const reuseReceivedPartsInRepairRecord = ({
  products = [],
  repairPhotos = [],
  receivedParts = [],
  receivedPhotos = [],
  receiptStatus = '',
  photoLimit = 6
} = {}) => {
  if (receiptStatus !== 'confirmed') {
    return { products: [...products], photos: [...repairPhotos] }
  }

  const receivedDetail = formatReceivedPartsDetail(receivedParts)
  const nextProducts = products.map(product => ({
    ...product,
    receivedDetail: String(product.receivedDetail || '').trim() ? product.receivedDetail : receivedDetail
  }))

  const seenPhotos = new Set()
  const photos = [...repairPhotos, ...receivedPhotos]
    .filter((photo) => {
      const identity = photoIdentity(photo)
      if (!identity || seenPhotos.has(identity)) return false
      seenPhotos.add(identity)
      return true
    })
    .slice(0, Math.max(0, Number(photoLimit) || 0))

  return { products: nextProducts, photos }
}
