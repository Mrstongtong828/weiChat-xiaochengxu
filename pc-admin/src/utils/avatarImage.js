const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const AVATAR_EDGE = 512

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob)
    else reject(new Error('浏览器无法压缩这张头像，请换一张图片'))
  }, type, quality)
})

const decodeImage = async (file) => {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file)

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const getOutputName = (name, type) => {
  const base = String(name || 'avatar').replace(/\.[^.]+$/, '') || 'avatar'
  return `${base}-avatar.${type === 'image/webp' ? 'webp' : 'jpg'}`
}

/**
 * Prepare a browser image for avatar upload.
 * The image is center-cropped, resized to 512×512 and encoded under 2MB.
 */
export const prepareAvatarImage = async (file) => {
  if (!file) throw new Error('请选择头像图片')
  if (!ALLOWED_AVATAR_TYPES.has(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name || '')) {
    throw new Error('头像仅支持 JPG、PNG 或 WebP 图片')
  }
  if (file.size > MAX_SOURCE_BYTES) throw new Error('原始头像图片不能超过 20MB')

  const image = await decodeImage(file)
  try {
    const width = Number(image.width)
    const height = Number(image.height)
    if (!width || !height) throw new Error('无法读取头像图片尺寸')

    const sourceEdge = Math.min(width, height)
    const sourceX = (width - sourceEdge) / 2
    const sourceY = (height - sourceEdge) / 2
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_EDGE
    canvas.height = AVATAR_EDGE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法处理这张头像')
    context.drawImage(image, sourceX, sourceY, sourceEdge, sourceEdge, 0, 0, AVATAR_EDGE, AVATAR_EDGE)

    const attempts = [
      ['image/webp', 0.86],
      ['image/webp', 0.74],
      ['image/webp', 0.62],
      ['image/jpeg', 0.82],
      ['image/jpeg', 0.68]
    ]
    let jpegBackgroundApplied = false
    for (const [type, quality] of attempts) {
      if (type === 'image/jpeg' && !jpegBackgroundApplied) {
        context.globalCompositeOperation = 'destination-over'
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, AVATAR_EDGE, AVATAR_EDGE)
        context.globalCompositeOperation = 'source-over'
        jpegBackgroundApplied = true
      }
      const blob = await canvasToBlob(canvas, type, quality)
      if (blob.size < MAX_AVATAR_BYTES && (blob.type === type || !blob.type)) {
        return new File([blob], getOutputName(file.name, type), { type, lastModified: Date.now() })
      }
    }
    throw new Error('头像压缩后仍超过 2MB，请换一张图片')
  } finally {
    if (typeof image.close === 'function') image.close()
  }
}
