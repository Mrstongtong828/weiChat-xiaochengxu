import { unwrapCloudResult, withToken } from '@/api/cloudHelpers.js'
import request, { baseURL } from './request.js'

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
    console.warn('[cloud] uniCloud 检测失败，将降级为 HTTPS 请求:', e.message)
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

// 云函数调用（带降级）
export function callCloudFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    if (!checkCloudAvailable()) {
      // 云服务不可用时，降级为 HTTPS 请求
      console.warn(`[cloud] 降级为 HTTPS: ${name}`)
      const httpPath = `/cloud/${name}`
      request({
        url: httpPath,
        method: 'POST',
        data: withToken(data)
      })
        .then(resolve)
        .catch(reject)
      return
    }

    const cloudClient = getUniCloudClient()
    cloudClient.callFunction({
      name,
      data: withToken(data),
      success: (res) => {
        try {
          resolve(unwrapCloudResult(res.result || {}))
        } catch (error) {
          reject(error)
        }
      },
      fail: (err) => {
        console.warn(`[cloud] 云函数 ${name} 调用失败，尝试 HTTPS 降级`)
        // 云函数失败时尝试 HTTPS 降级
        request({
          url: `/cloud/${name}`,
          method: 'POST',
          data: withToken(data)
        })
          .then(resolve)
          .catch(() => reject(err))
      }
    })
  })
}

// 云对象导入（带异常捕获）
export function importCloudObject(name) {
  if (!checkCloudAvailable()) {
    console.warn(`[cloud] 云对象 ${name} 不可用，将使用 HTTPS 降级`)
    return null
  }

  try {
    const cloudClient = getUniCloudClient()
    ensureUniCloudReady(cloudClient)

    const cloudObject = cloudClient.importObject(name)
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

export function uploadCloudFile(options = {}) {
  if (!checkCloudAvailable()) {
    // 云上传不可用时，降级为 HTTP 上传
    console.warn('[cloud] 降级为 HTTP 上传')
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: `${baseURL}/upload`,
        filePath: options.filePath,
        name: options.name || 'file',
        success: (res) => {
          try {
            const data = JSON.parse(res.data || '{}')
            resolve({ url: data.url || data.fileID, fileID: data.fileID })
          } catch (e) {
            reject(e)
          }
        },
        fail: reject
      })
    })
  }

  const cloudClient = getUniCloudClient()
  return cloudClient.uploadFile(options)
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
