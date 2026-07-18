import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../views/Login.vue'
import MainLayout from '../components/Layout/MainLayout.vue'
import Home from '../views/Home.vue'
import WorkOrder from '../views/WorkOrder.vue'
import FaultDB from '../views/FaultDB.vue'
import Users from '../views/Users.vue'
import CustomerManagement from '../views/CustomerManagement.vue'
import Feedback from '../views/Feedback.vue'
import InventoryManagement from '../views/InventoryManagement.vue'
import SettlementManagement from '../views/SettlementManagement.vue'
import Settings from '../views/Settings.vue'
import Summary from '../views/Summary.vue'
import AuditLog from '../views/AuditLog.vue'
import { clearAdminSession } from '../utils/adminSession.js'
import { canAccessMenu } from '../config/menuAccess.js'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'Login', component: Login },
    {
      path: '/',
      component: MainLayout,
      redirect: '/home',
      children: [
        { path: 'home', name: 'Home', component: Home },
        { path: 'workorder', name: 'WorkOrder', component: WorkOrder },
        { path: 'customers', name: 'CustomerManagement', component: CustomerManagement },
        { path: 'inventory', name: 'InventoryManagement', component: InventoryManagement },
        { path: 'settlement', name: 'SettlementManagement', component: SettlementManagement },
        { path: 'faultdb', name: 'FaultDB', component: FaultDB },
        { path: 'users', name: 'Users', component: Users },
        { path: 'feedback', name: 'Feedback', component: Feedback },
        { path: 'summary', name: 'Summary', component: Summary },
        { path: 'audit', name: 'AuditLog', component: AuditLog },
        { path: 'settings', name: 'Settings', component: Settings },
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
  // 按角色门禁：无权访问的页面重定向到工作台首页
  const menu = to.path.replace(/^\//, '')
  if (menu && !canAccessMenu(menu)) {
    next({ path: '/home' })
    return
  }
  next()
})

export default router
