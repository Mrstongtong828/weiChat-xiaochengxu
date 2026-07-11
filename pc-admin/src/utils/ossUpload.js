import { getOssUploadPolicy } from '../api/admin.js'

const sanitizeFileName = (name = 'video.mp4') => {
  const normalized = String(name || 'video.mp4')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'video.mp4'
}

const joinUrl = (baseUrl = '', key = '') => {
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '')
  const cleanKey = String(key || '').replace(/^\/+/, '')
  return `${cleanBase}/${cleanKey}`
}

const buildObjectKey = (prefix = 'product-video/', file = {}) => {
  const safePrefix = String(prefix || 'product-video/').replace(/^\/+/, '').replace(/\/?$/, '/')
  const ext = (String(file.name || '').split('.').pop() || 'mp4').toLowerCase()
  const rand = Math.random().toString(16).slice(2)
  const fileName = sanitizeFileName(file.name || `${Date.now()}_${rand}.${ext}`)
  return `${safePrefix}${Date.now()}_${rand}_${fileName}`
}

const parseOssError = (status, responseText = '') => {
  const text = String(responseText || '')
  const code = text.match(/<Code>([^<]+)<\/Code>/i)?.[1]
  const message = text.match(/<Message>([^<]+)<\/Message>/i)?.[1]
  const requestId = text.match(/<RequestId>([^<]+)<\/RequestId>/i)?.[1]
  return [
    `OSS upload failed: HTTP ${status}`,
    code ? `Code=${code}` : '',
    message ? `Message=${message}` : '',
    requestId ? `RequestId=${requestId}` : ''
  ].filter(Boolean).join(' | ')
}

const postToOss = (file, policy, key, onProgress) => new Promise((resolve, reject) => {
  const form = new FormData()
  form.append('key', key)
  form.append('policy', policy.policy)
  form.append('OSSAccessKeyId', policy.accessKeyId)
  form.append('Signature', policy.signature)
  form.append('success_action_status', policy.successStatus || '200')
  if (file.type) form.append('Content-Type', file.type)
  form.append('file', file)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', policy.uploadUrl, true)
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && onProgress) {
      onProgress(Math.round((event.loaded / event.total) * 100))
    }
  }
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      if (onProgress) onProgress(100)
      resolve()
      return
    }
    reject(new Error(parseOssError(xhr.status, xhr.responseText)))
  }
  xhr.onerror = () => reject(new Error('OSS upload failed. Check bucket CORS and network access.'))
  xhr.ontimeout = () => reject(new Error('OSS upload timed out.'))
  xhr.timeout = 30 * 60 * 1000
  xhr.send(form)
})

export const uploadToOss = async (file, { keyPrefix = 'product-video/', onProgress } = {}) => {
  if (!file) throw new Error('请选择要上传的文件')
  const token = localStorage.getItem('adminToken')
  const policy = await getOssUploadPolicy(token, keyPrefix)
  if (!policy || !policy.uploadUrl || !policy.policy || !policy.signature || !policy.accessKeyId) {
    throw new Error('获取阿里云 OSS 上传凭证失败，请检查云函数环境变量')
  }
  if (policy.maxSize && file.size > policy.maxSize) {
    throw new Error(`文件不能超过 ${Math.round(policy.maxSize / 1024 / 1024)}MB`)
  }

  const key = buildObjectKey(policy.keyPrefix || keyPrefix, file)
  await postToOss(file, policy, key, onProgress)
  return { fileUrl: joinUrl(policy.baseUrl, key), key }
}
