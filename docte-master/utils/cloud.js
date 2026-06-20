import { unwrapCloudResult, withToken } from '@/api/cloudHelpers.js'

export function getUniCloudClient() {
  if (typeof uniCloud === 'undefined') {
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

export function callCloudFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
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
        reject(err)
      }
    })
  })
}

export function importCloudObject(name) {
  const cloudClient = getUniCloudClient()
  ensureUniCloudReady(cloudClient)

  const cloudObject = cloudClient.importObject(name)
  if (!cloudObject) {
    throw new Error(`云对象 ${name} 未连接，请确认已部署该云对象并重新上传体验版`)
  }

  return cloudObject
}

export function uploadCloudFile(options = {}) {
  const cloudClient = getUniCloudClient()
  return cloudClient.uploadFile(options)
}

export function getCloudTempFileURL(fileList = []) {
  const cloudClient = getUniCloudClient()
  return cloudClient.getTempFileURL({ fileList })
}
