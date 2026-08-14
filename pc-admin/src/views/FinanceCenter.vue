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
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import SettlementManagement from './SettlementManagement.vue'
import InvoiceManagement from './InvoiceManagement.vue'
import FourFlowLedger from './FourFlowLedger.vue'
import ReceivableAging from './ReceivableAging.vue'
import { getFinanceOverview } from '../api/order.js'
import { createCurrentMonthRange, dateRangeShortcuts, toApiDateRange } from '../utils/dateRange.js'

// 支持 /finance?tab=invoice|ledger 直达对应 Tab
const route = useRoute()
const TAB_ALIAS = { invoice: 'invoice', ledger: 'ledger', aging: 'aging' }
const activeTab = ref(TAB_ALIAS[route.query.tab] || 'settlement')

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

onMounted(loadOverview)
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
</style>
