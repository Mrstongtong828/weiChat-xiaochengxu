import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../views/Login.vue'
import MainLayout from '../components/Layout/MainLayout.vue'
import { clearAdminSession } from '../utils/adminSession.js'
import { canAccessMenu, getFirstAccessibleMenu } from '../config/menuAccess.js'
import { ADMIN_NAV_ITEMS } from '../config/adminCatalog.js'

// 各业务页按需懒加载：拆成独立异步 chunk，首屏只下载登录 + 布局壳，
// 避免把 WorkOrder(3000+ 行)、Settings 等一次性打进首屏包。
const adminViewLoaders = {
  home: () => import('../views/Home.vue'),
  workorder: () => import('../views/WorkOrder.vue'),
  customers: () => import('../views/CustomerManagement.vue'),
  inventory: () => import('../views/InventoryManagement.vue'),
  finance: () => import('../views/FinanceCenter.vue'),
  settlement: () => import('../views/SettlementManagement.vue'),
  logistics: () => import('../views/LogisticsMonitor.vue'),
  invoices: () => import('../views/InvoiceManagement.vue'),
  faultdb: () => import('../views/FaultDB.vue'),
  users: () => import('../views/Users.vue'),
  feedback: () => import('../views/Feedback.vue'),
  audit: () => import('../views/AuditLog.vue'),
  settings: () => import('../views/Settings.vue')
}
const AccessDenied = () => import('../views/AccessDenied.vue')

const adminRoutes = ADMIN_NAV_ITEMS.map(item => ({
  path: item.path,
  name: item.name,
  component: adminViewLoaders[item.key]
}))

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'Login', component: Login },
    {
      path: '/',
      component: MainLayout,
      redirect: '/home',
      children: [
        ...adminRoutes,
        { path: 'forbidden', name: 'AccessDenied', component: AccessDenied },
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('adminToken')
  if (to.name === 'Login') {
    next()
    return
  }
  if (!token) {
    clearAdminSession()
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  if (to.name === 'AccessDenied') {
    next()
    return
  }
  // 按账号权限门禁：优先跳转到首个可访问页面；无业务权限时展示明确提示。
  const menu = to.path.replace(/^\//, '')
  if (menu && !canAccessMenu(menu)) {
    const fallback = getFirstAccessibleMenu()
    next({ path: fallback ? `/${fallback}` : '/forbidden' })
    return
  }
  next()
})

export default router
