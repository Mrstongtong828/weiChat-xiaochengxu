import { uploadFile } from '../api/admin.js'

// 将浏览器 File 读成 base64（去掉 dataURL 前缀）
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => resolve(String(e.target.result).split(',')[1])
  reader.onerror = reject
  reader.readAsDataURL(file)
})

/**
 * 通用上传：把浏览器 File 上传到云存储指定目录
 * @param {File} file 浏览器文件对象
 * @param {string} dir 云存储目录，如 'compliance/'、'tutorials/'、'print/'
 * @param {number} maxSize 体积上限（字节），默认 10MB
 * @returns {Promise<{fileUrl:string, tempUrl:string}>} fileUrl 为持久 fileID，tempUrl 为临时预览地址
 */
export const uploadFileToCloud = async (file, dir = 'guides/', maxSize = 10 * 1024 * 1024) => {
  if (!file) throw new Error('请选择要上传的文件')
  if (maxSize && file.size > maxSize) {
    throw new Error(`文件不能超过 ${Math.round(maxSize / 1024 / 1024)}MB`)
  }
  const token = localStorage.getItem('adminToken')
  const fileContent = await fileToBase64(file)
  const data = await uploadFile(token, fileContent, file.name, file.type, dir)
  const fileUrl = data && (data.fileUrl || data.fileID)
  if (!fileUrl) throw new Error('上传失败：未返回文件地址')
  return { fileUrl, tempUrl: (data && data.tempUrl) || '' }
}
