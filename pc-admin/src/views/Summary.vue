<template>
  <div class="summary-page" v-loading="loading">
    <div class="summary-header">
      <div>
        <h2 class="page-title">运营汇总看板</h2>
        <p class="page-subtitle">按日期范围统计新增工单、处理效率、报价与发票待办，辅助安排售后资源。</p>
      </div>
      <div class="summary-actions">
        <el-segmented v-model="quickRange" :options="quickRangeOptions" @change="applyQuickRange" />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          @change="fetchSummaryData"
        />
        <el-select v-model="granularity" class="granularity-select" @change="fetchSummaryData">
          <el-option label="按日" value="day"></el-option>
          <el-option label="按周" value="week"></el-option>
        </el-select>
        <el-button type="primary" icon="Refresh" @click="fetchSummaryData">刷新</el-button>
      </div>
    </div>

    <section class="summary-section">
      <div class="section-title">工单运营指标</div>
      <el-row :gutter="20">
        <el-col v-for="item in orderMetrics" :key="item.key" :xs="24" :sm="12" :lg="6">
          <el-card shadow="hover" class="metric-card">
            <div class="metric-label">{{ item.title }}</div>
            <div class="metric-value" :class="item.type ? `is-${item.type}` : ''">
              {{ formatMetric(summaryData[item.key], item.precision) }}
              <span>{{ item.suffix }}</span>
            </div>
            <div class="metric-desc">{{ item.desc }}</div>
          </el-card>
        </el-col>
      </el-row>
    </section>

    <section class="summary-section">
      <div class="section-title">待办压力</div>
      <el-row :gutter="20">
        <el-col v-for="item in todoMetrics" :key="item.key" :xs="24" :sm="12" :lg="6">
          <el-card shadow="hover" class="metric-card">
            <div class="metric-label">{{ item.title }}</div>
            <div class="metric-value" :class="item.type ? `is-${item.type}` : ''">
              {{ formatMetric(summaryData[item.key]) }}
              <span>{{ item.suffix }}</span>
            </div>
            <div class="metric-desc">{{ item.desc }}</div>
          </el-card>
        </el-col>
      </el-row>
    </section>

    <section class="summary-section">
      <div class="section-head">
        <div class="section-title">趋势对比</div>
        <span class="section-meta">{{ rangeText }} · {{ granularity === 'day' ? '按日统计' : '按周统计' }}</span>
      </div>
      <el-card shadow="never" class="trend-card">
        <div v-if="trendRows.length" class="trend-list">
          <div v-for="row in trendRows" :key="row.label" class="trend-row">
            <div class="trend-date">{{ row.label }}</div>
            <div class="trend-bars">
              <div class="trend-line">
                <span>新增 {{ row.newOrders }}</span>
                <div><i class="bar-new" :style="{ width: `${barWidth(row.newOrders)}%` }"></i></div>
              </div>
              <div class="trend-line">
                <span>完成 {{ row.completedOrders }}</span>
                <div><i class="bar-done" :style="{ width: `${barWidth(row.completedOrders)}%` }"></i></div>
              </div>
              <div class="trend-line">
                <span>待处理 {{ row.pendingOrders }}</span>
                <div><i class="bar-warn" :style="{ width: `${barWidth(row.pendingOrders)}%` }"></i></div>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else description="当前日期范围暂无趋势数据"></el-empty>
      </el-card>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getDashboardSummary } from '../api/order.js'

const loading = ref(true)
const granularity = ref('day')
const quickRange = ref('7d')
const dateRange = ref([])
const trendRows = ref([])

const quickRangeOptions = [
  { label: '近7天', value: '7d' },
  { label: '近30天', value: '30d' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' }
]

const summaryData = reactive({
  newOrders: 0,
  pendingOrders: 0,
  repairingOrders: 0,
  completedOrders: 0,
  avgHandleHours: 0,
  quotePendingOrders: 0,
  invoicePendingOrders: 0,
  totalOrders: 0,
  totalFeedbacks: 0,
  pendingFeedbacks: 0
})

const orderMetrics = [
  { title: '新增工单', key: 'newOrders', suffix: '单', desc: '筛选范围内提交的工单' },
  { title: '待处理', key: 'pendingOrders', suffix: '单', desc: '待签收、运输中、待初步处理', type: 'warning' },
  { title: '维修中', key: 'repairingOrders', suffix: '单', desc: '检测、报价、维修流程中的工单', type: 'info' },
  { title: '已完成', key: 'completedOrders', suffix: '单', desc: '筛选范围内完成或结单', type: 'success' },
  { title: '平均处理时长', key: 'avgHandleHours', suffix: '小时', desc: '完成工单从创建到更新的平均耗时', precision: 1 },
  { title: '累计工单', key: 'totalOrders', suffix: '单', desc: '当前系统有效工单总量' }
]

const todoMetrics = [
  { title: '报价待确认', key: 'quotePendingOrders', suffix: '单', desc: '已签收/处理中但报价未发布或未确认', type: 'warning' },
  { title: '发票待处理', key: 'invoicePendingOrders', suffix: '单', desc: '客户已提交发票申请', type: 'danger' },
  { title: '客户反馈', key: 'totalFeedbacks', suffix: '条', desc: '筛选范围内投诉与建议' },
  { title: '反馈待跟进', key: 'pendingFeedbacks', suffix: '条', desc: '仍需客服处理的反馈', type: 'danger' }
]

const rangeText = computed(() => {
  if (!dateRange.value || dateRange.value.length !== 2) return '未选择日期'
  return `${dateRange.value[0]} 至 ${dateRange.value[1]}`
})

const maxTrendValue = computed(() => {
  const values = trendRows.value.flatMap(item => [item.newOrders, item.completedOrders, item.pendingOrders])
  return Math.max(...values, 1)
})

const pad = (num) => String(num).padStart(2, '0')
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const applyQuickRange = () => {
  const now = new Date()
  const start = new Date(now)
  if (quickRange.value === '30d') {
    start.setDate(now.getDate() - 29)
  } else if (quickRange.value === 'week') {
    const day = now.getDay() || 7
    start.setDate(now.getDate() - day + 1)
  } else if (quickRange.value === 'month') {
    start.setDate(1)
  } else {
    start.setDate(now.getDate() - 6)
  }
  dateRange.value = [formatDate(start), formatDate(now)]
  fetchSummaryData()
}

const formatMetric = (value, precision = 0) => {
  const numberValue = Number(value || 0)
  return precision ? numberValue.toFixed(precision) : numberValue.toLocaleString()
}

const barWidth = (value) => Math.max(6, Math.round((Number(value || 0) / maxTrendValue.value) * 100))

const fetchSummaryData = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const [startDate = '', endDate = ''] = dateRange.value || []
    const res = await getDashboardSummary(token, {
      startDate,
      endDate,
      granularity: granularity.value
    })
    const data = res?.data || res || {}
    const metrics = data.metrics || data

    Object.keys(summaryData).forEach(key => {
      summaryData[key] = Number(metrics[key] || 0)
    })
    trendRows.value = Array.isArray(data.trend) ? data.trend : []
  } catch (error) {
    console.error('加载运营汇总看板失败:', error)
    if (!error.__displayed) ElMessage.error(error.message || '加载运营汇总看板失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  applyQuickRange()
})
</script>

<style scoped>
.summary-page {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.summary-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 8px 0 4px;
}

.summary-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.granularity-select {
  width: 110px;
}

.page-title {
  margin: 0;
  color: #1d2129;
  font-size: 28px;
  font-weight: 700;
}

.page-subtitle {
  margin: 10px 0 0;
  max-width: 620px;
  color: #667085;
  font-size: 14px;
  line-height: 1.6;
}

.summary-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  padding-left: 12px;
  border-left: 4px solid #165dff;
  color: #1d2129;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.section-meta {
  color: #86909c;
  font-size: 13px;
}

.metric-card {
  height: 160px;
  border: none;
  border-radius: 14px;
  margin-bottom: 20px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-3px);
}

.metric-card :deep(.el-card__body) {
  height: 100%;
  box-sizing: border-box;
  padding: 24px;
}

.metric-label {
  color: #667085;
  font-size: 14px;
}

.metric-value {
  margin-top: 16px;
  color: #1d2129;
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
}

.metric-value span {
  margin-left: 6px;
  color: #86909c;
  font-size: 14px;
  font-weight: 500;
}

.metric-value.is-warning {
  color: var(--el-color-warning);
}

.metric-value.is-danger {
  color: var(--el-color-danger);
}

.metric-value.is-info {
  color: var(--el-color-primary);
}

.metric-value.is-success {
  color: var(--el-color-success);
}

.metric-desc {
  margin-top: 14px;
  color: #98a2b3;
  font-size: 12px;
  line-height: 1.5;
}

.trend-card {
  border: none;
  border-radius: 16px;
}

.trend-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.trend-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 20px;
  align-items: center;
}

.trend-date {
  color: #344054;
  font-weight: 700;
}

.trend-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trend-line {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 12px;
  align-items: center;
  color: #667085;
  font-size: 12px;
}

.trend-line > div {
  height: 8px;
  overflow: hidden;
  border-radius: 99px;
  background: #eef2f7;
}

.trend-line i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.bar-new {
  background: #165dff;
}

.bar-done {
  background: #12b76a;
}

.bar-warn {
  background: #f79009;
}

@media screen and (max-width: 900px) {
  .summary-header {
    flex-direction: column;
  }

  .summary-actions {
    justify-content: flex-start;
  }

  .trend-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}
</style>
