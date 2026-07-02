import COS from 'cos-js-sdk-v5'
import { getCosUploadCredential } from '../api/admin.js'

/**
 * 用后端 STS 临时凭证直传腾讯云 COS，返回公网可访问 URL。
 * 视频不经过云函数，支持几百 MB / 几分钟的大文件（自动分块上传）。
 * @param {File} file 浏览器文件对象
 * @param {object} opts
 * @param {string} opts.keyPrefix COS 对象前缀目录，默认 'product-video/'
 * @param {(percent:number)=>void} opts.onProgress 进度回调（0-100）
 * @returns {Promise<{fileUrl:string, key:string}>}
 */
export const uploadToCos = async (file, { keyPrefix = 'product-video/', onProgress } = {}) => {
  if (!file) throw new Error('请选择要上传的文件')
  const token = localStorage.getItem('adminToken')
  const cred = await getCosUploadCredential(token, keyPrefix)
  if (!cred || !cred.credentials) throw new Error('获取上传凭证失败，请检查腾讯云 COS 是否已配置')

  const { credentials, bucket, region, keyPrefix: prefix, baseUrl, startTime, expiredTime } = cred

  const cos = new COS({
    getAuthorization: (options, cb) => {
      cb({
        TmpSecretId: credentials.tmpSecretId,
        TmpSecretKey: credentials.tmpSecretKey,
        SecurityToken: credentials.sessionToken,
        StartTime: startTime,
        ExpiredTime: expiredTime
      })
    }
  })

  const ext = (String(file.name || '').split('.').pop() || 'mp4').toLowerCase()
  const rand = Math.random().toString(16).slice(2)
  const key = `${prefix}${Date.now()}_${rand}.${ext}`

  await new Promise((resolve, reject) => {
    cos.uploadFile({
      Bucket: bucket,
      Region: region,
      Key: key,
      Body: file,
      SliceSize: 5 * 1024 * 1024, // 超过 5MB 走分块上传
      onProgress: (info) => {
        if (onProgress) onProgress(Math.round((info.percent || 0) * 100))
      }
    }, (err, data) => (err ? reject(err) : resolve(data)))
  })

  return { fileUrl: `${baseUrl}/${key}`, key }
}
