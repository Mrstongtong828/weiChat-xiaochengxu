// uniCloud 云函数 URL 配置
// 请在 uniCloud 控制台开启云函数 URL 化后，将对应 URL 配置到 .env.local。
const env = import.meta.env || {}

const normalizeBase = (base = '') => String(base || '').replace(/\/$/, '')
const cloudBase = normalizeBase(env.VITE_UNICLOUD_BASE_URL)
const resolveUrl = (envKey, functionName) => {
  const explicitUrl = normalizeBase(env[envKey])
  if (explicitUrl) return explicitUrl
  if (cloudBase) return `${cloudBase}/${functionName}`
  throw new Error(`缺少 ${envKey} 或 VITE_UNICLOUD_BASE_URL，不能静默连接默认云空间`)
}

export const API_BASE = {
  // 管理端系统接口（登录、员工管理）
  adminSys: resolveUrl('VITE_ADMIN_SYS_URL', 'cicada-admin-sys'),

  // 管理端知识库接口（分类、故障库）
  adminKb: resolveUrl('VITE_ADMIN_KB_URL', 'cicada-admin-kb'),

  // 管理端工单接口（工单列表、分配、状态更新）
  adminOrder: resolveUrl('VITE_ADMIN_ORDER_URL', 'cicada-admin-order'),

  // 管理端客户接口（客户档案、设备、历史工单、合规日志）
  adminCustomer: resolveUrl('VITE_ADMIN_CUSTOMER_URL', 'cicada-admin-customer')
}
