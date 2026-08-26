<template>
  <div class="finance-center">
    <!-- 收款总览：实收 / 待核销 / 逾期 / 已退款 -->
    <section class="fc-overview" v-loading="overviewLoading">
      <div class="fc-overview-head">
        <div class="fc-overview-title">
          <el-icon><Money /></el-icon>
          <span>收款总览</span>
          <el-tooltip content="实收与退款按所选时间段统计；待核销与逾期未付为当前时点存量" placement="top">
            <el-icon class="fc-help"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
        <div class="fc-overview-actions">
          <el-date-picker v-model="overviewRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至"
            start-placeholder="开始日期" end-placeholder="结束日期" :shortcuts="dateRangeShortcuts" unlink-panels size="small"
            class="fc-date-range" @change="loadOverview" />
          <el-button size="small" circle :loading="overviewLoading" @click="loadOverview"><el-icon><Refresh /></el-icon></el-button>
        </div>
      </div>
      <div class="fc-overview-grid">
        <el-card
          v-for="card in overviewCards"
          :key="card.key"
          shadow="never"
          class="fc-overview-card"
          :class="'fc-overview-card--' + card.tone"
          @click="goOverview(card)"
        >
          <div class="fc-overview-label">{{ card.label }}</div>
          <div class="fc-overview-value"><small>¥</small>{{ fmtMoney(card.value) }}</div>
          <div class="fc-overview-sub">{{ card.sub }}</div>
        </el-card>
      </div>
    </section>

    <el-tabs v-model="activeTab" class="fc-tabs">
      <el-tab-pane label="开票任务看板" name="workboard">
        <section class="invoice-board" v-loading="invoiceBoardLoading">
          <div class="invoice-board-head">
            <div>
              <div class="invoice-board-kicker">WORK QUEUE</div>
              <h2>开票申请，今天先处理这些</h2>
              <p>按开票时效优先展示当前待办，已开具记录仍保留在开票管理中。</p>
            </div>
            <div class="invoice-board-actions">
              <el-button size="small" @click="loadInvoiceBoard" :loading="invoiceBoardLoading"><el-icon><Refresh /></el-icon>刷新任务</el-button>
              <el-button size="small" type="primary" @click="openPendingInvoices">处理待开票</el-button>
            </div>
          </div>
          <div class="invoice-board-stats">
            <button v-for="card in invoiceBoardCards" :key="card.key" class="invoice-board-stat" :class="`is-${card.tone}`" @click="openInvoiceStatus(card.status)">
              <span>{{ card.label }}</span><strong>{{ card.value }}</strong><small>{{ card.sub }}</small>
            </button>
          </div>
          <div class="invoice-board-grid">
            <div class="invoice-board-panel invoice-board-priority">
              <div class="invoice-board-panel-head"><div><strong>优先任务</strong><span>逾期和临近时限的申请</span></div><el-button link type="primary" @click="openPendingInvoices">查看全部</el-button></div>
              <div v-if="invoiceBoardPriority.length" class="invoice-task-list">
                <button v-for="row in invoiceBoardPriority" :key="row._id" class="invoice-task" @click="openInvoiceRow(row)">
                  <span class="invoice-task-marker" :class="`is-${row.risk}`"></span>
                  <span class="invoice-task-main"><strong>{{ row.order_no || '未命名工单' }}</strong><small>{{ row.customer || '客户未填写' }} · {{ row.title || '抬头待补充' }}</small></span>
                  <span class="invoice-task-meta"><el-tag size="small" :type="row.risk === 'overdue' ? 'danger' : 'warning'">{{ row.riskLabel }}</el-tag><small>{{ row.ageLabel }}</small></span>
                  <el-icon class="invoice-task-arrow"><ArrowRight /></el-icon>
                </button>
              </div>
              <el-empty v-else description="当前没有逾期或临近时限的申请" :image-size="70" />
            </div>
            <div class="invoice-board-panel invoice-board-snapshot">
              <div class="invoice-board-panel-head"><div><strong>工作量快照</strong><span>按当前申请总量统计</span></div><el-icon><Tickets /></el-icon></div>
              <div class="invoice-progress-row"><div><span>待开票</span><strong>{{ invoiceBoardSummary.pendingCount || 0 }}</strong></div><el-progress :percentage="invoiceProgress('pendingCount')" color="#f59e0b" :show-text="false" /></div>
              <div class="invoice-progress-row"><div><span>开具中</span><strong>{{ invoiceBoardSummary.processingCount || 0 }}</strong></div><el-progress :percentage="invoiceProgress('processingCount')" color="#2563eb" :show-text="false" /></div>
              <div class="invoice-progress-row"><div><span>已开具</span><strong>{{ invoiceBoardSummary.issuedCount || 0 }}</strong></div><el-progress :percentage="invoiceProgress('issuedCount')" color="#16a34a" :show-text="false" /></div>
              <div class="invoice-board-note"><el-icon><InfoFilled /></el-icon><span>待开票金额 ¥{{ fmtMoney(invoiceBoardSummary.pendingAmount) }}；逾期金额 ¥{{ fmtMoney(invoiceBoardSummary.overdueAmount) }}</span></div>
            </div>
          </div>
        </section>
      </el-tab-pane>
      <el-tab-pane label="结算管理" name="settlement">
        <SettlementManagement />
      </el-tab-pane>
      <el-tab-pane label="开票管理" name="invoice" lazy>
        <InvoiceManagement />
      </el-tab-pane>
      <el-tab-pane label="四流台账" name="ledger" lazy>
        <FourFlowLedger />
      </el-tab-pane>
      <el-tab-pane label="应收账龄" name="aging" lazy>
        <ReceivableAging :summary="overview.summary" :aging="overview.aging" :truncated="overview.truncated" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import SettlementManagement from './SettlementManagement.vue'
import InvoiceManagement from './InvoiceManagement.vue'
import FourFlowLedger from './FourFlowLedger.vue'
import ReceivableAging from './ReceivableAging.vue'
import { getFinanceOverview, getInvoiceWorkboard } from '../api/order.js'
import { createCurrentMonthRange, dateRangeShortcuts, toApiDateRange } from '../utils/dateRange.js'

// 支持 /finance?tab=invoice|ledger 直达对应 Tab
const route = useRoute()
const router = useRouter()
const TAB_ALIAS = { workboard: 'workboard', invoice: 'invoice', ledger: 'ledger', aging: 'aging' }
const activeTab = ref(TAB_ALIAS[route.query.tab] || 'workboard')

const getToken = () => localStorage.getItem('adminToken')

// ===== 收款总览 =====
const overviewLoading = ref(false)
const overview = ref({ summary: {}, aging: [], truncated: false })
const overviewRange = ref(route.query.startDate && route.query.endDate
  ? [String(route.query.startDate), String(route.query.endDate)]
  : createCurrentMonthRange())

const overviewCards = computed(() => {
  const s = overview.value.summary || {}
  return [
    { key: 'paid', label: '本期实收', value: s.paidAmount || 0, sub: `${s.paidCount || 0} 单`, tone: 'green' },
    { key: 'verify', label: '待核销金额', value: s.pendingVerifyAmount || 0, sub: `${s.pendingVerifyCount || 0} 单待核销`, tone: 'blue' },
    { key: 'overdue', label: '逾期未付金额', value: s.overdueAmount || 0, sub: `${s.overdueCount || 0} 单已逾期`, tone: 'orange' },
    { key: 'refund', label: '本期已退款', value: s.refundedAmount || 0, sub: `${s.refundedCount || 0} 笔`, tone: 'gray' }
  ]
})

const loadOverview = async () => {
  overviewLoading.value = true
  try {
    const data = await getFinanceOverview(getToken(), { ...toApiDateRange(overviewRange.value) })
    overview.value = {
      summary: (data && data.summary) || {},
      aging: (data && data.aging) || [],
      truncated: Boolean(data && data.truncated)
    }
  } catch (e) {
    ElMessage.error(e.message || '收款总览加载失败')
  } finally {
    overviewLoading.value = false
  }
}

const goOverview = (card) => {
  activeTab.value = card.key === 'overdue' ? 'aging' : 'settlement'
}

const fmtMoney = (value) => Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ===== 开票任务看板 =====
const invoiceBoardLoading = ref(false)
const invoiceBoardSummary = ref({})
const invoiceBoardRows = ref([])
const invoiceBoardCards = computed(() => {
  const s = invoiceBoardSummary.value || {}
  return [
    { key: 'overdue', label: '已逾期', value: s.overdueCount || 0, sub: `¥${fmtMoney(s.overdueAmount)}`, tone: 'danger', status: '待开票' },
    { key: 'dueSoon', label: '48小时内到期', value: s.dueSoonCount || 0, sub: '需要优先排期', tone: 'warning', status: '待开票' },
    { key: 'pending', label: '待开票', value: s.pendingCount || 0, sub: `¥${fmtMoney(s.pendingAmount)}`, tone: 'amber', status: '待开票' },
    { key: 'processing', label: '开具中', value: s.processingCount || 0, sub: '等待登记结果', tone: 'blue', status: '开具中' }
  ]
})
const invoiceBoardPriority = computed(() => invoiceBoardRows.value
  .map(row => {
    const base = Number(row.settlement_time || row.service_completed_time || 0)
    const due = base ? base + Math.max(Number(row.expected_delivery_days || 15), 1) * 86400000 : 0
    const risk = due && due < Date.now() ? 'overdue' : 'soon'
    return { ...row, risk, riskLabel: risk === 'overdue' ? '已逾期' : '临近到期', ageLabel: due ? `${Math.max(0, Math.ceil((due - Date.now()) / 86400000))}天内` : '待确认时限', due }
  })
  .filter(row => row.due > 0 && (row.risk === 'overdue' || row.due <= Date.now() + 2 * 86400000))
  .sort((a, b) => (a.due || Infinity) - (b.due || Infinity)).slice(0, 6))
const invoiceProgress = (key) => {
  const total = Number(invoiceBoardSummary.value.total || 0)
  return total ? Math.round(Number(invoiceBoardSummary.value[key] || 0) / total * 100) : 0
}
const loadInvoiceBoard = async () => {
  invoiceBoardLoading.value = true
  try {
    const data = await getInvoiceWorkboard(getToken())
    invoiceBoardSummary.value = data?.summary || {}
    invoiceBoardRows.value = data?.list || []
  } catch (e) {
    ElMessage.error(e.message || '开票任务加载失败')
  } finally {
    invoiceBoardLoading.value = false
  }
}
const openInvoiceStatus = (status) => { activeTab.value = 'invoice'; router.replace({ path: '/finance', query: { tab: 'invoice', status } }) }
const openPendingInvoices = () => openInvoiceStatus('pending')
const openInvoiceRow = (row) => { activeTab.value = 'invoice'; router.replace({ path: '/finance', query: { tab: 'invoice', keyword: row.order_no || '' } }) }

onMounted(() => { loadOverview(); loadInvoiceBoard() })
</script>

<style scoped>
.finance-center { width: 100%; }
.fc-overview { margin-bottom: 14px; }
.fc-overview-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.fc-overview-title { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; color: #1f2d3d; }
.fc-overview-actions { display: flex; align-items: center; gap: 8px; }
.fc-help { color: #909399; cursor: help; }
.fc-overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
.fc-overview-card { border-radius: 12px; cursor: pointer; transition: transform .2s ease, border-color .2s ease; }
.fc-overview-card:hover { transform: translateY(-2px); }
.fc-overview-label { font-size: 13px; color: #6b7785; font-weight: 600; }
.fc-overview-value { margin: 6px 0 2px; font-size: 26px; font-weight: 800; color: #1f2d3d; line-height: 1.1; }
.fc-overview-value small { font-size: 14px; font-weight: 700; margin-right: 2px; }
.fc-overview-sub { font-size: 12px; color: #86909c; }
.fc-overview-card--green .fc-overview-value { color: #16a34a; }
.fc-overview-card--blue .fc-overview-value { color: #2563eb; }
.fc-overview-card--orange .fc-overview-value { color: #d97706; }
.fc-overview-card--gray .fc-overview-value { color: #6b7280; }
.fc-date-range { width: 250px; }
.fc-tabs :deep(.el-tabs__item) { font-size: 15px; font-weight: 600; }
.invoice-board { display: flex; flex-direction: column; gap: 18px; }
.invoice-board-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; padding: 4px 2px 2px; }
.invoice-board-kicker { color: #2563eb; font-size: 10px; letter-spacing: .16em; font-weight: 800; }
.invoice-board-head h2 { margin: 5px 0 4px; color: #172033; font-size: 22px; line-height: 1.2; }
.invoice-board-head p { margin: 0; color: #64748b; font-size: 13px; }
.invoice-board-actions { display: flex; gap: 8px; flex-shrink: 0; }
.invoice-board-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.invoice-board-stat { min-height: 112px; padding: 15px 16px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; text-align: left; cursor: pointer; transition: transform .16s ease, box-shadow .16s ease; }
.invoice-board-stat:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15, 23, 42, .08); }
.invoice-board-stat span, .invoice-board-stat small { display: block; color: #64748b; font-size: 12px; }
.invoice-board-stat strong { display: block; margin: 8px 0 3px; color: #172033; font-size: 28px; line-height: 1; }
.invoice-board-stat.is-danger { border-top: 3px solid #ef4444; } .invoice-board-stat.is-danger strong { color: #dc2626; }
.invoice-board-stat.is-warning { border-top: 3px solid #f59e0b; } .invoice-board-stat.is-warning strong, .invoice-board-stat.is-amber strong { color: #d97706; }
.invoice-board-stat.is-blue { border-top: 3px solid #2563eb; } .invoice-board-stat.is-blue strong { color: #2563eb; }
.invoice-board-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, .8fr); gap: 14px; }
.invoice-board-panel { min-width: 0; padding: 18px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
.invoice-board-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.invoice-board-panel-head strong, .invoice-board-panel-head span { display: block; } .invoice-board-panel-head strong { color: #172033; font-size: 15px; } .invoice-board-panel-head span { margin-top: 4px; color: #94a3b8; font-size: 12px; }
.invoice-board-panel-head > .el-icon { color: #2563eb; font-size: 20px; }
.invoice-task { width: 100%; display: grid; grid-template-columns: 8px minmax(0, 1fr) auto 18px; align-items: center; gap: 10px; padding: 11px 0; border: 0; border-top: 1px solid #eef2f7; background: transparent; text-align: left; cursor: pointer; }
.invoice-task:hover .invoice-task-main strong { color: #2563eb; } .invoice-task-marker { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; } .invoice-task-marker.is-overdue { background: #ef4444; }
.invoice-task-main, .invoice-task-meta { min-width: 0; } .invoice-task-main strong, .invoice-task-main small, .invoice-task-meta small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .invoice-task-main strong { color: #172033; font-size: 13px; } .invoice-task-main small { margin-top: 3px; color: #64748b; font-size: 12px; } .invoice-task-meta { text-align: right; } .invoice-task-meta small { margin-top: 4px; color: #94a3b8; font-size: 11px; } .invoice-task-arrow { color: #94a3b8; }
.invoice-progress-row { margin-top: 18px; } .invoice-progress-row > div { display: flex; justify-content: space-between; margin-bottom: 7px; color: #64748b; font-size: 12px; } .invoice-progress-row strong { color: #172033; font-size: 14px; }
.invoice-board-note { display: flex; gap: 7px; align-items: flex-start; margin-top: 22px; padding-top: 13px; border-top: 1px dashed #e5e7eb; color: #64748b; font-size: 12px; line-height: 1.5; } .invoice-board-note .el-icon { color: #2563eb; flex-shrink: 0; }
@media (max-width: 900px) { .invoice-board-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .invoice-board-grid { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .invoice-board-head { align-items: flex-start; flex-direction: column; } .invoice-board-actions { width: 100%; } .invoice-board-actions .el-button { flex: 1; } .invoice-board-stats { gap: 8px; } .invoice-board-stat { min-height: 100px; padding: 12px; } .invoice-board-stat strong { font-size: 24px; } }
</style>
