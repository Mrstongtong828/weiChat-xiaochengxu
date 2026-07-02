<template>
  <div class="shad-page-shell home-page">
    <section class="hero-card">
      <div class="hero-copy">
        <h2>专业医疗设备维保</h2>
        <p>高效 · 精准 · 数字化服务体系</p>
        <div class="hero-actions">
          <button type="button" @click="navigateTo('workorder', '')">处理工单</button>
          <button type="button" @click="navigateTo('settlement', '')">查看结算</button>
        </div>
      </div>
    </section>

    <section v-if="showOverview" class="overview-section" v-loading="overviewLoading">
      <div class="overview-header">
        <div class="overview-title">
          <ShadBadge variant="primary">本月经营概览</ShadBadge>
          <span class="overview-hint">数据截至今日 · 点击数字可下钻</span>
        </div>
        <span class="overview-more" @click="navigateTo('summary', '')">查看完整运营统计 →</span>
      </div>
      <div class="overview-grid">
        <ShadCard
          v-for="card in overviewCards"
          :key="card.key"
          clickable
          class="overview-card"
          @click="goOverview(card)"
        >
          <div class="overview-label">{{ card.title }}</div>
          <div class="overview-value" :class="card.accent">{{ card.value }}<small>{{ card.unit }}</small></div>
        </ShadCard>
      </div>
    </section>

    <div class="stat-grid">
      <ShadCard
        v-for="item in statCards"
        :key="item.key"
        clickable
        class="stat-card"
        @click="navigateTo(item.route, item.filter)"
      >
        <div class="stat-head">
          <span>{{ item.title }}</span>
          <ShadBadge :variant="item.badgeVariant">{{ item.badge }}</ShadBadge>
        </div>
        <div class="stat-value" :class="item.className">{{ item.value }}<small>{{ item.unit }}</small></div>
        <p>{{ item.desc }}</p>
      </ShadCard>
    </div>

    <section class="todo-section">
      <div class="section-header">
        <div>
          <ShadBadge variant="default">Todo Center</ShadBadge>
          <h3>待办中心</h3>
        </div>
        <el-tag v-if="todoError" type="danger" effect="plain">{{ todoError }}</el-tag>
      </div>
      <div v-loading="todoLoading" class="todo-grid">
        <ShadCard v-for="item in displayedTodoGroups" :key="item.key" clickable class="todo-card" @click="navigateTodo(item.key)">
          <div class="todo-title">
            <span>{{ item.title }}</span>
            <ShadBadge :variant="item.count ? 'warning' : 'default'">{{ item.count }} 件</ShadBadge>
          </div>
          <div class="todo-desc">{{ item.desc }}</div>
        </ShadCard>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getStatistics, getTodoSummary, getDashboardSummary } from '../api/order.js'
import { getFeedbackStats } from '../api/admin.js'
import { canAccessMenu } from '../config/menuAccess.js'
import ShadCard from '../components/ui/ShadCard.vue'
import ShadBadge from '../components/ui/ShadBadge.vue'

const router = useRouter()
const stats = ref({ pendingCount: 0, todayCount: 0, unreadCount: 0 })
const todoGroups = ref([])
const todoLoading = ref(false)
const todoError = ref('')

// 经营概览条：仅管理 / 财务可见（与「运营统计」同权限），工程师 / 客服不显示
const showOverview = canAccessMenu('summary')
const overview = ref({ newOrders: 0, completedOrders: 0, quotePendingOrders: 0, invoicePendingOrders: 0, avgHandleHours: 0, paidAmount: 0 })
const overviewLoading = ref(false)

const fallbackTodoGroups = [
  { key: 'inbound', title: '待签收', desc: '客户已提交或运输中的工单', count: 0 },
  { key: 'quote', title: '待报价', desc: '已签收/处理中但未发布报价', count: 0 },
  { key: 'payment', title: '待核销', desc: '客户已上传付款凭证', count: 0 },
  { key: 'invoice', title: '待开票', desc: '客户已提交发票申请', count: 0 },
  { key: 'return', title: '待回寄', desc: '已付款但尚未回寄', count: 0 },
  { key: 'exception', title: '异常工单', desc: '需要人工介入处理', count: 0 }
]

const todoTextMap = {
  pending: { title: '待签收', desc: '客户已提交或运输中的工单' },
  inbound: { title: '待签收', desc: '客户已提交或运输中的工单' },
  quote: { title: '待报价', desc: '已签收/处理中但未发布报价' },
  payment: { title: '待核销', desc: '客户已上传付款凭证' },
  invoice: { title: '待开票', desc: '客户已提交发票申请' },
  return: { title: '待回寄', desc: '已付款但尚未回寄' },
  exception: { title: '异常工单', desc: '需要人工介入处理' }
}

const displayedTodoGroups = computed(() => {
  const groups = todoGroups.value.length ? todoGroups.value : fallbackTodoGroups
  return groups.map(item => ({
    ...item,
    ...(todoTextMap[item.key] || {})
  }))
})

const statCards = computed(() => [
  {
    key: 'pending',
    title: '待处理工单',
    value: stats.value.pendingCount || 0,
    unit: '件',
    badge: '急',
    badgeVariant: 'danger',
    route: 'workorder',
    filter: '',
    className: 'is-primary',
    desc: '优先处理签收、检测和维修中的服务请求'
  },
  {
    key: 'today',
    title: '今日新增报修',
    value: stats.value.todayCount || 0,
    unit: '件',
    badge: 'New',
    badgeVariant: 'primary',
    route: 'workorder',
    filter: '',
    className: 'is-dark',
    desc: '跟踪当天新增需求，辅助安排客服与工程师'
  },
  {
    key: 'feedback',
    title: '未读投诉/建议',
    value: stats.value.unreadCount || 0,
    unit: '条',
    badge: 'Care',
    badgeVariant: 'warning',
    route: 'feedback',
    filter: '',
    className: 'is-warning',
    desc: '客户声音集中处理，避免服务体验断点'
  }
])

// 本月经营概览卡：只放数字 + 可点击下钻，趋势分析仍在「运营统计」页
const fmtMoney = (n) => Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const overviewCards = computed(() => [
  { key: 'paidAmount', title: '本月已收', value: fmtMoney(overview.value.paidAmount), unit: '元', accent: 'is-success', route: 'settlement' },
  { key: 'newOrders', title: '本月新增工单', value: overview.value.newOrders || 0, unit: '件', accent: 'is-primary', route: 'summary' },
  { key: 'completedOrders', title: '本月完工', value: overview.value.completedOrders || 0, unit: '件', accent: 'is-dark', route: 'summary' },
  { key: 'quotePendingOrders', title: '待报价', value: overview.value.quotePendingOrders || 0, unit: '件', accent: 'is-warning', route: 'workorder', todo: 'quote' },
  { key: 'invoicePendingOrders', title: '待开票', value: overview.value.invoicePendingOrders || 0, unit: '件', accent: 'is-warning', route: 'invoices' },
  { key: 'avgHandleHours', title: '平均处理时长', value: overview.value.avgHandleHours || 0, unit: '小时', accent: 'is-dark', route: 'summary' }
])

const monthRangeParams = () => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const startDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return { startDate, endDate, granularity: 'day' }
}

const loadOverview = async () => {
  if (!showOverview) return
  const token = localStorage.getItem('adminToken')
  if (!token) return
  overviewLoading.value = true
  try {
    const res = await getDashboardSummary(token, monthRangeParams())
    const data = res?.data || res || {}
    const metrics = data.metrics || data
    overview.value = {
      newOrders: Number(metrics.newOrders || 0),
      completedOrders: Number(metrics.completedOrders || 0),
      quotePendingOrders: Number(metrics.quotePendingOrders || 0),
      invoicePendingOrders: Number(metrics.invoicePendingOrders || 0),
      avgHandleHours: Number(metrics.avgHandleHours || 0),
      paidAmount: Number(metrics.paidAmount || 0)
    }
  } catch (e) {
    // 概览条为辅助信息，失败静默（不打断待办主流程）
    console.warn('加载经营概览失败:', e)
  } finally {
    overviewLoading.value = false
  }
}

const goOverview = (card) => {
  if (!card || !card.route) return
  router.push({ path: '/' + card.route, query: card.todo ? { todo: card.todo } : {} })
}

const loadStats = async () => {
  const token = localStorage.getItem('adminToken')
  if (!token) {
    router.push('/login')
    return
  }
  todoLoading.value = true
  todoError.value = ''
  try {
    const [orderStats, feedbackStats, todoSummary] = await Promise.all([
      getStatistics(token),
      getFeedbackStats(token),
      getTodoSummary(token)
    ])
    stats.value = {
      pendingCount: orderStats.pendingCount || 0,
      todayCount: orderStats.todayCount || 0,
      unreadCount: feedbackStats.unreadCount || 0
    }
    todoGroups.value = Array.isArray(todoSummary.groups) ? todoSummary.groups : []
  } catch (e) {
    console.error('加载统计数据失败:', e)
    todoError.value = e.message || '待办数据加载失败'
    ElMessage.error(todoError.value)
  } finally {
    todoLoading.value = false
  }
}

const navigateTo = (menu, filterValue) => {
  router.push({ path: '/' + menu, query: filterValue ? { filter: filterValue } : {} })
}

const navigateTodo = (todoType) => {
  router.push({ path: '/workorder', query: { todo: todoType } })
}

onMounted(() => {
  loadStats()
  loadOverview()
})
</script>

<style scoped>
.home-page { width: 100%; }
.hero-card {
  min-height: 186px;
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid #c7d7f2;
  background:
    linear-gradient(90deg, rgba(17, 55, 126, 0.55) 0%, rgba(37, 99, 235, 0.48) 43%, rgba(37, 99, 235, 0.82) 100%),
    url('/brand/cicada-factory.jpg') center / cover no-repeat;
}
.hero-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(13, 43, 102, 0.08), rgba(37, 99, 235, 0.26));
}
.hero-copy {
  position: relative;
  z-index: 1;
  min-height: 186px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 520px;
  margin-left: 48px;
  color: #ffffff;
}
.hero-copy h2 { margin: 0 0 8px; font-size: 34px; line-height: 1.16; font-weight: 900; }
.hero-copy p { margin: 0; font-size: 22px; line-height: 1.25; font-weight: 800; }
.hero-actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.hero-actions button {
  min-width: 118px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: #ffffff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
/* 本月经营概览条：紧凑 KPI，区别于下方大号待办卡 */
.overview-section { display: grid; gap: 14px; }
.overview-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.overview-title { display: flex; align-items: center; gap: 12px; }
.overview-hint { font-size: 13px; color: #64748b; }
.overview-more { font-size: 14px; font-weight: 700; color: #2563eb; cursor: pointer; white-space: nowrap; }
.overview-more:hover { text-decoration: underline; }
.overview-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; }
.overview-card { padding: 18px 20px; min-height: 96px; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.overview-label { font-size: 14px; font-weight: 700; color: #536783; }
.overview-value { font-size: 26px; font-weight: 900; line-height: 1.1; color: #0f172a; word-break: break-all; }
.overview-value small { margin-left: 6px; font-size: 13px; font-weight: 500; color: #64748b; }
.overview-value.is-primary { color: hsl(var(--primary)); }
.overview-value.is-success { color: #16a34a; }
.overview-value.is-warning { color: #f97316; }
.overview-value.is-dark { color: hsl(var(--foreground)); }

.stat-grid, .todo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.stat-card { padding: 26px 24px 22px; min-height: 184px; }
.stat-head, .todo-title, .section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.stat-head > span, .todo-title > span { font-size: 22px; font-weight: 900; color: #0f172a; }
.stat-value { margin-top: 30px; font-size: 48px; font-weight: 900; letter-spacing: 0; line-height: 1; }
.stat-value small { margin-left: 24px; color: #64748b; font-size: 20px; font-weight: 500; letter-spacing: 0; }
.stat-value.is-primary { color: hsl(var(--primary)); }
.stat-value.is-warning { color: #f97316; }
.stat-value.is-dark { color: hsl(var(--foreground)); }
.stat-card p { margin: 8px 0 0; color: #536783; line-height: 1.6; font-size: 14px; }
.todo-section { display: grid; gap: 16px; }
.section-header { margin-top: 10px; justify-content: flex-start; }
.section-header h3 { margin: 0; font-size: 28px; font-weight: 900; color: #0f172a; }
.section-header :deep(.shad-badge) { display: none; }
.todo-card { padding: 28px 30px; min-height: 150px; }
.todo-title :deep(.shad-badge) { min-width: 62px; justify-content: center; font-size: 15px; }
.todo-desc { margin-top: 16px; color: #536783; line-height: 1.6; font-size: 14px; }
.todo-card::after {
  content: '进入处理  ->';
  display: block;
  margin-top: 22px;
  color: #2563eb;
  font-size: 14px;
  font-weight: 700;
}
@media screen and (max-width: 900px) {
  .hero-card { min-height: 170px; }
  .hero-copy { min-height: 170px; margin: 0; padding: 24px; }
  .hero-copy h2 { font-size: 28px; }
  .hero-copy p { font-size: 18px; }
  .stat-grid, .todo-grid { grid-template-columns: 1fr; }
  .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .overview-header { flex-direction: column; align-items: flex-start; gap: 6px; }
}
</style>
