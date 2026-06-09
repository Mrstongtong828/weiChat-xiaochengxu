// uniCloud 云函数 URL 配置
// 请在 uniCloud 控制台开启云函数 URL 化后，将对应 URL 配置到 .env.local。
const env = import.meta.env || {}

const defaultCloudBase = 'https://env-00jy6bcqqsjw.dev-hz.cloudbasefunction.cn'
const normalizeBase = (base = '') => String(base || '').replace(/\/$/, '')
const cloudBase = normalizeBase(env.VITE_UNICLOUD_BASE_URL || defaultCloudBase)
const resolveUrl = (envKey, functionName) => normalizeBase(env[envKey] || `${cloudBase}/${functionName}`)

export const API_BASE = {
  // 管理端系统接口（登录、员工管理）
  adminSys: resolveUrl('VITE_ADMIN_SYS_URL', 'cicada-admin-sys'),

  // 管理端知识库接口（分类、故障库）
  adminKb: resolveUrl('VITE_ADMIN_KB_URL', 'cicada-admin-kb'),

  // 管理端工单接口（工单列表、分配、状态更新）
  adminOrder: resolveUrl('VITE_ADMIN_ORDER_URL', 'cicada-admin-order')
}
