const asText = (value = '') => String(value || '').trim()

const asFile = (value = {}) => ({
  fileUrl: asText(value.fileUrl),
  fileName: asText(value.fileName),
  fileType: asText(value.fileType).toLowerCase()
})

export const parsePolicyDocument = (value) => {
  let parsed = value
  try {
    if (typeof value === 'string') parsed = value ? JSON.parse(value) : null
  } catch (error) {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.status !== 'published') {
    return null
  }

  const source = asFile(parsed.source)
  const original = parsed.original && typeof parsed.original === 'object' ? parsed.original : {}
  const pages = Array.isArray(original.pages) ? original.pages.map(asText).filter(Boolean) : []
  const pdfUrl = asText(original.pdfUrl)
  const mobileHtml = asText(parsed.mobileHtml)

  if (!mobileHtml && !pdfUrl && !pages.length) return null

  return {
    schemaVersion: Number(parsed.schemaVersion) || 1,
    status: 'published',
    source,
    original: { pdfUrl, pages },
    mobileHtml,
    version: Math.max(1, Number(parsed.version) || 1),
    updatedAt: Number(parsed.updatedAt) || 0
  }
}

const isCloudFile = (value) => /^cloud:\/\//i.test(asText(value))

const resolveFilesWithDeadline = async (resolveFiles, fileIds, timeoutMs) => {
  const lookup = Promise.resolve()
    .then(() => resolveFiles(fileIds))
    .catch(() => ({}))
  if (!(timeoutMs > 0)) return lookup

  let timer
  try {
    return await Promise.race([
      lookup,
      new Promise(resolve => {
        timer = setTimeout(() => resolve({}), timeoutMs)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const resolvePolicyDocumentFiles = async (document, resolveFiles, { timeoutMs = 0 } = {}) => {
  if (!document) return null

  const cloudFiles = [
    document.source.fileUrl,
    document.original.pdfUrl,
    ...document.original.pages
  ].filter(isCloudFile)
  const uniqueCloudFiles = [...new Set(cloudFiles)]
  let resolved = {}
  if (uniqueCloudFiles.length && typeof resolveFiles === 'function') {
    // Mobile HTML is already usable; temporary file URLs are optional enhancements.
    resolved = await resolveFilesWithDeadline(resolveFiles, uniqueCloudFiles, timeoutMs) || {}
  }
  const previewUrl = (value) => (isCloudFile(value) ? resolved[value] || value : value)

  return {
    ...document,
    source: {
      ...document.source,
      previewUrl: previewUrl(document.source.fileUrl)
    },
    original: {
      ...document.original,
      pdfPreviewUrl: previewUrl(document.original.pdfUrl),
      pagePreviewUrls: document.original.pages.map(previewUrl)
    }
  }
}
