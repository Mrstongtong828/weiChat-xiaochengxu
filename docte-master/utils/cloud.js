import { unwrapCloudResult, withToken } from '@/api/cloudHelpers.js'
import { downloadCloudFileWithClient } from './cloudFile.js'

// 云服务可用性标记
let cloudAvailable = null

export function checkCloudAvailable() {
  if (cloudAvailable !== null) return cloudAvailable
  try {
    if (typeof uniCloud === 'undefined') {
      cloudAvailable = false
      return false
    }
    const client = uniCloud
    if (!client || typeof client.callFunction !== 'function') {
      cloudAvailable = false
      return false
    }
    cloudAvailable = true
    return true
  } catch (e) {
    cloudAvailable = false
    console.warn('[cloud] uniCloud 检测失败:', e.message)
    return false
  }
}

export function getUniCloudClient() {
  if (!checkCloudAvailable()) {
    throw new Error('云服务未连接，请先在 HBuilderX 关联正确的 uniCloud 服务空间')
  }
  return uniCloud
}

function ensureUniCloudReady(cloudClient) {
  if (!cloudClient || typeof cloudClient.importObject !== 'function') {
    throw new Error('云服务未初始化，请先在 HBuilderX 关联正确的 uniCloud 服务空间')
  }
  if (!cloudClient.config && !cloudClient._isDefault) {
    throw new Error('云服务未连接，请重新生成带 uniCloud 服务空间配置的微信小程序发行包')
  }
}

// 云对象导入（带异常捕获）
export function importCloudObject(name) {
  if (!checkCloudAvailable()) {
    console.warn(`[cloud] 云对象 ${name} 不可用`)
    return null
  }

  try {
    const cloudClient = getUniCloudClient()
    ensureUniCloudReady(cloudClient)

    // 云对象 SDK 默认会在每次调用时自动 showLoading；并发请求或本地调试超时
    // 时可能留下无法关闭的全局遮罩，页面业务层自行处理加载与错误提示。
    const cloudObject = cloudClient.importObject(name, { customUI: true })
    if (!cloudObject) {
      console.warn(`[cloud] 云对象 ${name} 导入失败`)
      return null
    }
    return cloudObject
  } catch (e) {
    console.warn(`[cloud] 云对象 ${name} 异常:`, e.message)
    return null
  }
}

export function getCloudTempFileURL(fileList = []) {
  if (!checkCloudAvailable()) {
    // 云存储不可用时，直接返回原 URL
    console.warn('[cloud] 云存储降级，返回原 URL')
    return Promise.resolve({
      fileList: fileList.map(url => ({ fileID: url, tempFileURL: url }))
    })
  }

  const cloudClient = getUniCloudClient()
  return cloudClient.getTempFileURL({ fileList })
}

export function downloadCloudFile(fileID = '') {
  const cloudClient = getUniCloudClient()
  return downloadCloudFileWithClient({
    cloudClient,
    fileID,
    downloadFile: (options) => uni.downloadFile(options)
  })
}
