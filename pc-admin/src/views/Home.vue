<template>
  <div class="shad-page-shell home-page">
    <section class="hero-card">
      <div class="hero-copy">
        <h2>专业医疗设备维保</h2>
        <p>高效 · 精准 · 数字化服务体系</p>
        <div class="hero-actions">
          <el-button class="hero-action" type="primary" @click="navigateTo('workorder', '')">处理工单</el-button>
          <el-button class="hero-action" plain @click="navigateTo('settlement', '')">查看结算</el-button>
        </div>
      </div>
      <div class="hero-clock">
        <div class="clock-date">{{ clockDate }}</div>
      </div>
    </section>

    <section v-if="showOverview" class="overview-section" v-loading="overviewLoading">
      <div class="overview-header">
        <div class="overview-title">
          <el-tag type="primary" effect="light">经营概览</el-tag>
          <span class="overview-hint">{{ rangeLabel }} · 点击数字可下钻</span>
        </div>
        <el-date-picker
          v-model="dashboardRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :shortcuts="dateRangeShortcuts"
          :clearable="false"
          unlink-panels
          class="dashboard-range"
          @change="loadOverview"
        />
      </div>
      <div class="overview-grid">
        <el-card
          v-for="card in overviewCards"
          :key="card.key"
          shadow="never"
          :body-style="{ padding: '0' }"
          class="overview-card"
          @click="goOverview(card)"
        >
          <div class="overview-card-head">
            <span class="overview-icon" :class="'overview-icon--' + card.tone">
              <el-icon><component :is="card.icon" /></el-icon>
            </span>
            <span class="overview-caption">所选时段</span>
          </div>
          <div class="overview-label">{{ card.title }}</div>
          <div class="overview-value" :class="card.accent">{{ card.value }}<small>{{ card.unit }}</small></div>
        </el-card>
      </div>
    </section>

    <section v-if="showOverview" class="dashboard-section" v-loading="overviewLoading">
      <div class="section-header dashboard-header">
        <div>
          <el-tag type="primary" effect="plain">数据看板</el-tag>
          <h3>实时数据看板</h3>
        </div>
        <el-button class="dashboard-refresh" type="primary" link @click="refreshDashboard"><el-icon><Refresh /></el-icon>刷新</el-button>
      </div>
      <div class="dashboard-grid">
        <el-card shadow="never" :body-style="{ padding: '0' }" class="ring-card reference-chart-card">
          <div class="ring-card-title">工单状态分布</div>
          <RingChart
            :data="statusRingData"
            :center-value="String(overview.totalOrders || 0)"
            center-label="区间工单"
          />
        </el-card>
        <el-card shadow="never" :body-style="{ padding: '0' }" class="ring-card reference-chart-card">
          <div class="ring-card-title">区间新增工单完工率</div>
          <RingChart
            :data="completionRingData"
            :center-value="completionRate + '%'"
            center-label="完工 / 新增"
            :center-color="'#16a34a'"
            :show-legend="true"
          />
        </el-card>
        <el-card shadow="never" :body-style="{ padding: '0' }" class="ring-card money-card reference-chart-card">
          <div class="ring-card-title">区间已收</div>
          <div class="money-figure">
            <span class="money-symbol">¥</span>
            <span class="money-value">{{ fmtMoney(overview.paidAmount) }}</span>
          </div>
          <div class="money-sub">
            <span>完工 {{ overview.completedOrders || 0 }} 单</span>
            <span>·</span>
            <span>平均 {{ overview.avgHandleHours || 0 }} 小时</span>
          </div>
          <LineChart v-if="trendRows.length" class="money-chart" :categories="trendCategories" :series="trendSeries" />
          <div v-else class="money-chart-empty">所选时段暂无趋势数据</div>
          <div class="money-foot" @click="navigateTo('settlement', '')">查看结算 →</div>
        </el-card>
      </div>
    </section>

    <section class="todo-section">
      <div class="section-header">
        <div>
          <h3>待办中心</h3>
        </div>
        <el-tag v-if="todoError" type="danger" effect="plain">{{ todoError }}</el-tag>
      </div>
      <div v-loading="todoLoading" class="todo-grid">
        <el-card v-for="item in displayedTodoGroups" :key="item.key" shadow="never" :body-style="{ padding: '0' }" class="todo-card" @click="navigateTodo(item.key)">
          <div class="todo-card-inner">
            <span class="todo-icon" :class="'todo-icon--' + todoMeta(item.key).tone"><el-icon><component :is="todoMeta(item.key).icon" /></el-icon></span>
            <div class="todo-copy">
              <div class="todo-title"><span class="todo-label">{{ item.title }}</span><el-tag :type="item.count ? 'warning' : 'info'" size="small" effect="light">{{ item.count }} 件</el-tag></div>
              <div class="todo-desc">{{ item.desc }}</div>
              <div class="todo-footer"><span>进入处理 →</span></div>
            </div>
          </div>
        </el-card>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ChatLineRound, CircleCheck, Document, Money, Tickets, Timer } from '@element-plus/icons-vue'
import { getStatistics, getTodoSummary, getDashboardSummary } from '../api/order.js'
import { getFeedbackStats } from '../api/admin.js'
import { canAccessMenu } from '../config/menuAccess.js'
import { createCurrentMonthRange, dateRangeShortcuts, toApiDateRange } from '../utils/dateRange.js'
import RingChart from '../components/ui/RingChart.vue'
import LineChart from '../components/ui/LineChart.vue'

const router = useRouter()

// 当前日期
const now = ref(new Date())
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const clockDate = computed(() => {
  const d = now.value
  return `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日 星期${WEEKDAYS[d.getDay()]}`
})

const stats = ref({ pendingCount: 0, todayCount: 0, unreadCount: 0 })
const todoGroups = ref([])
const todoLoading = ref(false)
const todoError = ref('')

// 经营概览 + 数据看板：仅管理 / 财务可见（原依附 summary 权限，运营统计页已并入本页，
// 改依附 finance 权限——角色完全相同 superadmin/admin/finance，可见范围不变）
const showOverview = canAccessMenu('finance')
const overview = ref({ newOrders: 0, completedOrders: 0, createdCompletedOrders: 0, quotePendingOrders: 0, invoicePendingOrders: 0, avgHandleHours: 0, paidAmount: 0, totalOrders: 0 })
const overviewLoading = ref(false)
const statusBreakdown = ref({ pending: 0, sent: 0, received: 0, inspecting: 0, fixing: 0, shipped: 0, completed: 0 })
const trendRows = ref([])
const dashboardRange = ref(createCurrentMonthRange())
const rangeLabel = computed(() => {
  const [startDate, endDate] = dashboardRange.value || []
  return startDate && endDate ? `${startDate} 至 ${endDate}` : '请选择统计日期'
})

// 趋势图：X 轴用 MM-DD，三条曲线（新增/完成/待处理）
const trendCategories = computed(() => trendRows.value.map(r => String(r.label || '').slice(5) || r.label))
const trendSeries = computed(() => [
  { name: '新增', color: '#2563eb', data: trendRows.value.map(r => Number(r.newOrders || 0)), area: true },
  { name: '完成', color: '#16a34a', data: trendRows.value.map(r => Number(r.completedOrders || 0)) },
  { name: '待处理', color: '#f59e0b', data: trendRows.value.map(r => Number(r.pendingOrders || 0)) }
])

// 环形图：把 7 个原始状态归并为看板展示分组，配色对齐主题
const STATUS_RING_META = [
  { key: 'toReceive', label: '待签收', color: '#f59e0b', from: ['pending', 'sent'] },
  { key: 'received', label: '已签收', color: '#0ea5e9', from: ['received'] },
  { key: 'processing', label: '处理中', color: '#2563eb', from: ['inspecting', 'fixing'] },
  { key: 'shipped', label: '已回寄', color: '#8b5cf6', from: ['shipped'] },
  { key: 'completed', label: '已完成', color: '#16a34a', from: ['completed'] }
]

const statusRingData = computed(() => {
  const b = statusBreakdown.value || {}
  return STATUS_RING_META
    .map(meta => ({
      name: meta.label,
      color: meta.color,
      value: meta.from.reduce((sum, k) => sum + (Number(b[k]) || 0), 0)
    }))
    .filter(item => item.value > 0)
})

const completionRate = computed(() => {
  const done = Number(overview.value.createdCompletedOrders || 0)
  const created = Number(overview.value.newOrders || 0)
  if (created <= 0) return 0
  return Math.min(100, Math.round((done / created) * 100))
})

const completionRingData = computed(() => {
  const rate = completionRate.value
  return [
    { name: '已完工', value: rate, color: '#16a34a' },
    { name: '进行中', value: 100 - rate, color: '#e2e8f0' }
  ]
})

const fallbackTodoGroups = [
  { key: 'inbound', title: '待签收', desc: '客户已提交或运输中的工单', count: 0 },
  { key: 'quote', title: '待报价', desc: '已签收/处理中但未发布报价', count: 0 },
  { key: 'payment', title: '待核销', desc: '客户已上传付款凭证', count: 0 },
  { key: 'invoice', title: '待开票', desc: '客户已提交发票申请', count: 0 },
  { key: 'return', title: '待回寄', desc: '已报价或拒修且尚未回寄', count: 0 },
  { key: 'exception', title: '异常工单', desc: '需要人工介入处理', count: 0 }
]

const todoTextMap = {
  pending: { title: '待签收', desc: '客户已提交或运输中的工单' },
  inbound: { title: '待签收', desc: '客户已提交或运输中的工单' },
  quote: { title: '待报价', desc: '已签收/处理中但未发布报价' },
  payment: { title: '待核销', desc: '客户已上传付款凭证' },
  invoice: { title: '待开票', desc: '客户已提交发票申请' },
  return: { title: '待回寄', desc: '已报价或拒修且尚未回寄' },
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
    tagType: 'danger',
    route: 'workorder',
    filter: '',
    className: 'is-primary',
    icon: Tickets,
    tone: 'blue',
    desc: '优先处理签收、检测和维修中的服务请求'
  },
  {
    key: 'today',
    title: '今日新增报修',
    value: stats.value.todayCount || 0,
    unit: '件',
    badge: 'New',
    tagType: 'primary',
    route: 'workorder',
    filter: '',
    className: 'is-dark',
    icon: Timer,
    tone: 'violet',
    desc: '跟踪当天新增需求，辅助安排客服与工程师'
  },
  {
    key: 'feedback',
    title: '未读投诉/建议',
    value: stats.value.unreadCount || 0,
    unit: '条',
    badge: 'Care',
    tagType: 'warning',
    route: 'feedback',
    filter: '',
    className: 'is-warning',
    icon: ChatLineRound,
    tone: 'orange',
    desc: '客户声音集中处理，避免服务体验断点'
  }
])

// 经营概览卡：只放数字 + 可点击下钻
const fmtMoney = (n) => Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const overviewCards = computed(() => [
  { key: 'paidAmount', title: '区间已收', value: fmtMoney(overview.value.paidAmount), unit: '元', accent: 'is-success', route: 'settlement', icon: Money, tone: 'green' },
  { key: 'newOrders', title: '区间新增工单', value: overview.value.newOrders || 0, unit: '件', accent: 'is-primary', route: 'workorder', icon: Tickets, tone: 'blue' },
  { key: 'completedOrders', title: '区间完工', value: overview.value.completedOrders || 0, unit: '件', accent: 'is-dark', route: 'workorder', icon: CircleCheck, tone: 'violet' },
  { key: 'quotePendingOrders', title: '待报价', value: overview.value.quotePendingOrders || 0, unit: '件', accent: 'is-warning', route: 'workorder', todo: 'quote', icon: Document, tone: 'orange' },
  { key: 'invoicePendingOrders', title: '待开票', value: overview.value.invoicePendingOrders || 0, unit: '件', accent: 'is-warning', route: 'invoices', icon: Document, tone: 'amber' },
  { key: 'avgHandleHours', title: '平均处理时长', value: overview.value.avgHandleHours || 0, unit: '小时', accent: 'is-dark', route: '', icon: Timer, tone: 'navy' }
])

const TODO_META = {
  pending: { icon: Tickets, tone: 'blue' },
  inbound: { icon: Tickets, tone: 'blue' },
  quote: { icon: Document, tone: 'orange' },
  payment: { icon: Money, tone: 'green' },
  invoice: { icon: Document, tone: 'amber' },
  return: { icon: CircleCheck, tone: 'violet' },
  exception: { icon: ChatLineRound, tone: 'rose' }
}
const todoMeta = (key) => TODO_META[key] || { icon: Document, tone: 'blue' }

const loadOverview = async () => {
  if (!showOverview) return
  const token = localStorage.getItem('adminToken')
  if (!token) return
  overviewLoading.value = true
  try {
    const res = await getDashboardSummary(token, { ...toApiDateRange(dashboardRange.value), granularity: 'day' })
    const data = res?.data || res || {}
    const metrics = data.metrics || data
    overview.value = {
      newOrders: Number(metrics.newOrders || 0),
      completedOrders: Number(metrics.completedOrders || 0),
      createdCompletedOrders: Number(metrics.createdCompletedOrders || 0),
      quotePendingOrders: Number(metrics.quotePendingOrders || 0),
      invoicePendingOrders: Number(metrics.invoicePendingOrders || 0),
      avgHandleHours: Number(metrics.avgHandleHours || 0),
      paidAmount: Number(metrics.paidAmount || 0),
      totalOrders: Number(metrics.totalOrders || data.totalOrders || 0)
    }
    const breakdown = metrics.statusBreakdown || data.statusBreakdown || {}
    statusBreakdown.value = {
      pending: Number(breakdown.pending || 0),
      sent: Number(breakdown.sent || 0),
      received: Number(breakdown.received || 0),
      inspecting: Number(breakdown.inspecting || 0),
      fixing: Number(breakdown.fixing || 0),
      shipped: Number(breakdown.shipped || 0),
      completed: Number(breakdown.completed || 0)
    }
    trendRows.value = Array.isArray(data.trend) ? data.trend : (Array.isArray(metrics.trend) ? metrics.trend : [])
  } catch (e) {
    // 概览条为辅助信息，失败静默（不打断待办主流程）
    console.warn('加载经营概览失败:', e)
  } finally {
    overviewLoading.value = false
  }
}

const refreshDashboard = () => {
  loadOverview()
  loadStats()
}

const goOverview = (card) => {
  if (!card || !card.route) return
  const query = { ...toApiDateRange(dashboardRange.value) }
  if (card.todo) query.todo = card.todo
  router.push({ path: '/' + card.route, query })
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
.hero-clock {
  position: absolute;
  right: 52px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  text-align: right;
  color: #ffffff;
  text-shadow: 0 1px 8px rgba(0,0,0,0.25);
  user-select: none;
}
.clock-date {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.85;
  letter-spacing: 0.5px;
}
.hero-copy h2 { margin: 0 0 8px; font-size: 34px; line-height: 1.16; font-weight: 900; }
.hero-copy p { margin: 0; font-size: 22px; line-height: 1.25; font-weight: 800; }
.hero-actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.hero-actions :deep(.hero-action) {
  min-width: 118px;
  height: 32px;
  font-weight: 700;
}
.hero-actions :deep(.el-button--primary.hero-action) { color: #2563eb; background: #ffffff; border-color: #ffffff; }
.hero-actions :deep(.el-button--default.hero-action) { color: #ffffff; background: rgba(255, 255, 255, .12); border-color: rgba(255, 255, 255, .75); }
/* 本月经营概览条：紧凑 KPI，区别于下方大号待办卡 */
.overview-section { display: grid; gap: 12px; }
.overview-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.overview-title { display: flex; align-items: center; gap: 12px; }
.dashboard-range { width: 300px; }
.overview-hint { font-size: 13px; color: #64748b; }
.overview-more { font-size: 14px; font-weight: 700; color: #2563eb; cursor: pointer; white-space: nowrap; }
.overview-more:hover { text-decoration: underline; }
.overview-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
.overview-card { min-height: 140px; border-color: #e7edf6; border-radius: 10px; cursor: pointer; transition: border-color .2s, box-shadow .2s, transform .2s; }
.overview-card:hover, .stat-card:hover, .todo-card:hover { border-color: #8bbcf2; box-shadow: 0 5px 14px rgba(30, 111, 224, .1); }
.overview-card:hover { transform: translateY(-2px); }
.overview-card :deep(.el-card__body) { min-height: 140px; padding: 16px 18px 17px; display: flex; flex-direction: column; box-sizing: border-box; }
.overview-card-head { display: flex; align-items: center; justify-content: space-between; }
.overview-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 11px; font-size: 20px; }
.overview-icon--green { color: #22a65a; background: #eaf9ef; }.overview-icon--blue { color: #2377ef; background: #eaf3ff; }.overview-icon--violet { color: #7956df; background: #f0edff; }.overview-icon--orange { color: #ed8515; background: #fff2e2; }.overview-icon--amber { color: #d98a12; background: #fff5df; }.overview-icon--navy { color: #235dcb; background: #eaf2ff; }
.overview-caption { color: #98a6b9; font-size: 11px; }
.overview-label { margin-top: 11px; font-size: 14px; font-weight: 700; color: #536783; }
.overview-value { margin-top: 4px; font-size: 28px; font-weight: 900; line-height: 1.1; color: #0f172a; word-break: break-all; }
.overview-value small { margin-left: 6px; font-size: 13px; font-weight: 500; color: #64748b; }
.overview-value.is-primary { color: hsl(var(--primary)); }
.overview-value.is-success { color: #16a34a; }
.overview-value.is-warning { color: #f97316; }
.overview-value.is-dark { color: hsl(var(--foreground)); }

/* 实时数据看板：环形图区块 */
.dashboard-section { display: grid; gap: 12px; }
.dashboard-header { margin-top: 10px; justify-content: space-between; }
.dashboard-header h3 { margin: 6px 0 0; font-size: 28px; font-weight: 900; color: #0f172a; }
.dashboard-refresh { font-weight: 700; white-space: nowrap; }
.dashboard-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.ring-card, .trend-card { border-color: #e5edf6; border-radius: 10px; }
.ring-card :deep(.el-card__body) { min-height: 310px; padding: 18px 20px; display: flex; flex-direction: column; }
.ring-card-title { font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
.money-card { justify-content: center; gap: 14px; }
.money-figure { display: flex; align-items: baseline; gap: 6px; margin-top: 8px; }
.money-symbol { font-size: 22px; font-weight: 800; color: #16a34a; }
.money-value { font-size: 42px; font-weight: 900; line-height: 1; color: #16a34a; word-break: break-all; }
.money-sub { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #536783; }
.money-foot { margin-top: auto; padding-top: 14px; color: #2563eb; font-size: 14px; font-weight: 700; cursor: pointer; }
.trend-card :deep(.el-card__body) { padding: 18px 20px; }
.trend-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.trend-legend-hint { font-size: 13px; color: #64748b; }

.stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.stat-card { min-height: 172px; border-color: #e5edf6; border-radius: 10px; cursor: pointer; transition: border-color .2s, box-shadow .2s; }
.stat-card :deep(.el-card__body) { min-height: 172px; padding: 18px 20px 16px; display: flex; flex-direction: column; box-sizing: border-box; }
.stat-head, .todo-title, .section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.stat-title, .todo-label { display: flex; align-items: center; gap: 10px; min-width: 0; color: #0f172a; font-size: 18px; font-weight: 850; }
.stat-icon, .todo-icon { display: grid; place-items: center; flex: 0 0 auto; border-radius: 10px; }
.stat-icon { width: 36px; height: 36px; font-size: 18px; }.todo-icon { width: 32px; height: 32px; font-size: 16px; }
.stat-icon--blue, .todo-icon--blue { color: #2377ef; background: #eaf3ff; }.stat-icon--violet, .todo-icon--violet { color: #7956df; background: #f0edff; }.stat-icon--orange, .todo-icon--orange { color: #ed8515; background: #fff2e2; }.todo-icon--green { color: #22a65a; background: #eaf9ef; }.todo-icon--amber { color: #d98a12; background: #fff5df; }.todo-icon--rose { color: #dd5c66; background: #fff0f2; }
.stat-value { margin-top: 14px; font-size: 42px; font-weight: 900; letter-spacing: 0; line-height: 1; }
.stat-value small { margin-left: 10px; color: #64748b; font-size: 16px; font-weight: 500; letter-spacing: 0; }
.stat-value.is-primary { color: hsl(var(--primary)); }
.stat-value.is-warning { color: #f97316; }
.stat-value.is-dark { color: hsl(var(--foreground)); }
.stat-card p { margin: 8px 0 0; color: #536783; line-height: 1.5; font-size: 13px; }
.stat-footer, .todo-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 11px; border-top: 1px solid #eef3f8; color: #93a0b2; font-size: 12px; }.stat-footer span:last-child, .todo-footer span:last-child { color: #2563eb; font-weight: 700; }
.todo-section { display: grid; gap: 12px; }
.section-header { margin-top: 10px; justify-content: flex-start; }
.section-header h3 { margin: 0; font-size: 28px; font-weight: 900; color: #0f172a; }
.todo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.todo-card { min-height: 158px; border-color: #e7edf6; border-radius: 10px; cursor: pointer; transition: border-color .2s, box-shadow .2s, transform .2s; }
.todo-card:hover { transform: translateY(-2px); }
.todo-card :deep(.el-card__body) { min-height: 158px; padding: 16px 18px 14px; display: flex; flex-direction: column; box-sizing: border-box; }
.todo-title :deep(.el-tag) { min-width: 62px; justify-content: center; font-size: 13px; }
.todo-desc { margin-top: 10px; color: #536783; line-height: 1.55; font-size: 13px; }

/* 工作台参考版：信息以横向密度优先，避免大面积留白。 */
.hero-card { min-height: 192px; border-radius: 8px; }
.hero-copy { min-height: 192px; margin-left: 40px; }.hero-copy h2 { font-size: 31px; }.hero-copy p { font-size: 18px; }.hero-actions { margin-top: 16px; }.hero-actions :deep(.hero-action) { height: 38px; min-width: 126px; }
.overview-grid { gap: 10px; }.overview-card { min-height: 132px; border-radius: 8px; }.overview-card :deep(.el-card__body) { position: relative; min-height: 132px; padding: 20px 17px; }.overview-card-head { position: absolute; top: 18px; left: 17px; right: 17px; }.overview-icon { width: 44px; height: 44px; border-radius: 13px; }.overview-caption { display: none; }.overview-label { margin: 6px 0 0 57px; min-height: 20px; font-size: 15px; line-height: 20px; }.overview-value { margin: 4px 0 0 57px; font-size: 27px; }.overview-value small { font-size: 13px; }
.dashboard-section { gap: 10px; }.dashboard-header { margin-top: 6px; align-items: center; }.dashboard-header h3 { position: relative; margin: 0; padding-left: 12px; font-size: 18px; line-height: 24px; }.dashboard-header h3::before { content: ''; position: absolute; top: 2px; bottom: 2px; left: 0; width: 3px; border-radius: 3px; background: #2563eb; }.dashboard-grid { gap: 12px; }.reference-chart-card { min-height: 306px; }.reference-chart-card :deep(.el-card__body) { min-height: 306px; padding: 16px 18px; }.reference-chart-card .ring-card-title { margin-bottom: 0; font-size: 15px; }.reference-chart-card :deep(.ring-chart) { height: 250px; }.money-card { gap: 6px; justify-content: flex-start; }.money-figure { margin-top: 8px; }.money-value { font-size: 35px; }.money-symbol { font-size: 18px; }.money-sub { font-size: 13px; }.money-chart { flex: 1; min-height: 0; margin-top: 2px; }.money-chart :deep(.line-chart) { height: 124px; }.money-chart-empty { flex: 1; display: grid; min-height: 124px; place-items: center; color: #94a3b8; font-size: 13px; }.money-foot { padding-top: 6px; font-size: 13px; }
.todo-section { margin-top: 4px; gap: 10px; }.section-header { margin-top: 0; }.section-header h3 { position: relative; padding-left: 12px; font-size: 18px; line-height: 24px; }.section-header h3::before { content: ''; position: absolute; top: 2px; bottom: 2px; left: 0; width: 3px; border-radius: 3px; background: #2563eb; }.todo-grid { gap: 10px; }.todo-card { min-height: 112px; border-radius: 8px; }.todo-card :deep(.el-card__body) { min-height: 112px; padding: 14px 16px; }.todo-card-inner { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; height: 100%; }.todo-icon { width: 42px; height: 42px; border-radius: 12px; font-size: 19px; }.todo-copy { min-width: 0; display: flex; flex-direction: column; }.todo-title { min-height: 22px; gap: 8px; }.todo-label { overflow: hidden; font-size: 15px; line-height: 22px; text-overflow: ellipsis; white-space: nowrap; }.todo-title :deep(.el-tag) { min-width: 42px; height: 21px; padding: 0 7px; font-size: 11px; }.todo-desc { overflow: hidden; margin-top: 2px; color: #63758e; font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }.todo-footer { justify-content: flex-start; margin-top: auto; padding-top: 5px; border: 0; font-size: 12px; }
@media screen and (max-width: 900px) {
  .hero-card { min-height: 170px; }
  .hero-copy { min-height: 170px; margin: 0; padding: 24px; }
  .hero-copy h2 { font-size: 28px; }
  .hero-copy p { font-size: 18px; }
  .stat-grid, .todo-grid { grid-template-columns: 1fr; }
  .dashboard-grid { grid-template-columns: 1fr; }
  .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .overview-header { flex-direction: column; align-items: flex-start; gap: 6px; }
  .dashboard-range { width: 100%; }
}

@media screen and (max-width: 600px) {
  .home-page { gap: 14px; }
  .hero-card {
    min-height: 0;
    border-radius: 8px;
    background-position: 42% center;
  }
  .hero-card::after {
    background: linear-gradient(90deg, rgba(13, 43, 102, .42), rgba(37, 99, 235, .46));
  }
  .hero-copy {
    min-height: 0;
    max-width: none;
    padding: 52px 18px 18px;
  }
  .hero-copy h2 { margin-bottom: 6px; font-size: 24px; line-height: 1.2; }
  .hero-copy p { font-size: 14px; line-height: 1.4; }
  .hero-actions { width: 100%; gap: 8px; margin-top: 16px; }
  .hero-actions :deep(.hero-action) { flex: 1 1 0; min-width: 0; height: 38px; margin: 0; }
  .hero-clock {
    top: 17px;
    right: auto;
    left: 18px;
    transform: none;
    text-align: left;
  }
  .clock-date { font-size: 12px; font-weight: 600; opacity: .92; }

  .overview-section { gap: 9px; }
  .overview-title { width: 100%; align-items: flex-start; gap: 8px; }
  .overview-title :deep(.el-tag) { flex: 0 0 auto; }
  .overview-hint { min-width: 0; font-size: 12px; line-height: 1.5; }
  .overview-grid { gap: 8px; }
  .overview-card { min-height: 132px; }
  .overview-card :deep(.el-card__body) { min-height: 132px; padding: 12px; }
  .overview-card-head { position: static; }
  .overview-icon { width: 34px; height: 34px; border-radius: 8px; font-size: 17px; }
  .overview-label {
    min-height: 36px;
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 18px;
  }
  .overview-value {
    margin: 2px 0 0;
    font-size: 23px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .overview-value small { margin-left: 4px; font-size: 11px; }

  .dashboard-section, .todo-section { gap: 8px; }
  .dashboard-header { margin-top: 2px; align-items: center; }
  .dashboard-header > div { min-width: 0; }
  .dashboard-header h3, .section-header h3 { font-size: 17px; line-height: 22px; }
  .dashboard-refresh { padding: 0; }
  .dashboard-grid { gap: 10px; }
  .reference-chart-card, .reference-chart-card :deep(.el-card__body) { min-height: 278px; }
  .reference-chart-card :deep(.el-card__body) { padding: 14px; }
  .reference-chart-card :deep(.ring-chart) { height: 226px; }
  .reference-chart-card .ring-card-title { font-size: 14px; }
  .money-card { min-height: 292px; }
  .money-value { font-size: 32px; }
  .money-sub { flex-wrap: wrap; gap: 5px; font-size: 12px; }
  .money-chart :deep(.line-chart) { height: 146px; }
  .money-foot { min-height: 30px; display: flex; align-items: flex-end; }

  .section-header { align-items: center; }
  .todo-grid { gap: 8px; }
  .todo-card, .todo-card :deep(.el-card__body) { min-height: 108px; }
  .todo-card :deep(.el-card__body) { padding: 12px; }
  .todo-card-inner { grid-template-columns: 38px minmax(0, 1fr); gap: 10px; }
  .todo-icon { width: 38px; height: 38px; border-radius: 9px; font-size: 17px; }
  .todo-title :deep(.el-tag) { min-width: 40px; }
}

@media screen and (max-width: 340px) {
  .overview-grid { grid-template-columns: 1fr; }
  .overview-card, .overview-card :deep(.el-card__body) { min-height: 112px; }
  .overview-label { min-height: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .overview-card, .todo-card { transition: none; }
  .overview-card:hover, .todo-card:hover { transform: none; }
}
</style>
