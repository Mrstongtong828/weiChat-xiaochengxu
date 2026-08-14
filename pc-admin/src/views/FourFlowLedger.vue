<template>
  <div class="glass-card ledger-page">
    <div class="section-title">
      <div>
        <span>四流台账</span>
        <p class="section-desc">订单 / 物流 / 支付 / 发票 合一，筛选后可直接导出对账与开票数据。</p>
      </div>
      <div class="title-actions">
        <el-tooltip content="导出当前筛选条件下的全部台账数据（自动分页拉全量）" placement="top">
          <el-button type="primary" :loading="exporting" @click="doExport"><el-icon><Download /></el-icon>导出四流台账</el-button>
        </el-tooltip>
      </div>
    </div>

    <div class="ledger-toolbar">
      <el-date-picker v-model="filters.dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至"
        start-placeholder="开始日期" end-placeholder="结束日期" :shortcuts="dateRangeShortcuts" unlink-panels clearable
        style="width: 250px" @change="onFilterChange" />
      <el-input v-model="filters.keyword" clearable placeholder="工单号 / 客户 / 运单号 / 发票号" style="width: 240px"
        @keyup.enter="onFilterChange" @clear="onFilterChange" />
      <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 130px" @change="onFilterChange">
        <el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <el-checkbox v-model="filters.billableOnly" @change="onFilterChange">仅含有金额工单</el-checkbox>
      <el-button type="primary" plain @click="onFilterChange">查询</el-button>
    </div>

    <div class="table-responsive">
      <el-table :data="rows" class="modern-table" style="width:100%;" v-loading="loading">
        <template #empty>
          <div class="table-empty-guide">
            <strong>暂无台账数据</strong>
            <span>调整筛选条件后重试，或点击右上角「导出四流台账」拉取全量数据。</span>
          </div>
        </template>
        <el-table-column prop="order_no" label="工单号" min-width="150" show-overflow-tooltip />
        <el-table-column label="工单状态" width="100">
          <template #default="{ row }">{{ statusLabel(row.status) }}</template>
        </el-table-column>
        <el-table-column prop="customer" label="客户" min-width="140" show-overflow-tooltip />
        <el-table-column prop="phone" label="联系电话" width="130" />
        <el-table-column label="实付金额" width="110" align="right">
          <template #default="{ row }">¥{{ Number(row.total_price || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="配件费" width="100" align="right">
          <template #default="{ row }">¥{{ Number(row.parts_fee || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="工时费" width="100" align="right">
          <template #default="{ row }">¥{{ Number(row.labor_fee || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="付款状态" width="100">
          <template #default="{ row }"><el-tag :type="payTag(row.payment_status)" effect="plain">{{ payText(row.payment_status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="付款方式" width="100">
          <template #default="{ row }">{{ payMethod(row.payment_method) }}</template>
        </el-table-column>
        <el-table-column label="付款时间" width="150">
          <template #default="{ row }">{{ row.payment_paid_time ? formatTime(row.payment_paid_time) : '-' }}</template>
        </el-table-column>
        <el-table-column label="微信支付单号" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ row.wechat_transaction_id || '-' }}</template>
        </el-table-column>
        <el-table-column label="寄出运单号" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.out_no || '-' }}</template>
        </el-table-column>
        <el-table-column label="回寄运单号" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.back_no || '-' }}</template>
        </el-table-column>
        <el-table-column label="开票状态" width="100">
          <template #default="{ row }">{{ row.invoice_status || '-' }}</template>
        </el-table-column>
        <el-table-column label="发票号码" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.invoice_no || '-' }}</template>
        </el-table-column>
      </el-table>
    </div>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      class="pager"
      background
      layout="total, prev, pager, next"
      :total="total"
    />

    <div v-if="truncated" class="ledger-truncated">数据量超过后台扫描上限，列表可能不完整，请缩小筛选范围或使用导出拉取全量。</div>
  </div>
</template>

<script setup>
import { reactive, ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getFourFlowLedger } from '../api/order.js'
import { exportFourFlowLedger } from '../utils/fourFlowExport.js'
import { createCurrentMonthRange, dateRangeShortcuts, toApiDateRange } from '../utils/dateRange.js'

const getToken = () => localStorage.getItem('adminToken')

const STATUS_OPTIONS = [
  { value: 'pending', label: '已提交' }, { value: 'sent', label: '运输中' }, { value: 'received', label: '已签收' },
  { value: 'inspecting', label: '检测中' }, { value: 'fixing', label: '处理中' }, { value: 'shipped', label: '已回寄' },
  { value: 'completed', label: '已完成' }
]
const STATUS_LABELS = {
  pending: '已提交', sent: '运输中', received: '已签收', inspecting: '检测中',
  fixing: '处理中', shipped: '已回寄', completed: '已完成', cancelled: '已取消'
}
const PAY_LABELS = { pending: '待付款', uploaded: '待核销', paid: '已付款', refunded: '已退款' }
const PAY_TAGS = { pending: 'warning', uploaded: 'primary', paid: 'success', refunded: 'info' }
const PAY_METHOD_LABELS = { wechat_pay: '微信支付', offline_transfer: '对公支付', bank_transfer: '对公支付' }

const statusLabel = (status) => STATUS_LABELS[status] || status || '-'
const payText = (status = 'pending') => PAY_LABELS[status] || status || '-'
const payTag = (status = 'pending') => PAY_TAGS[status] || 'info'
const payMethod = (method) => PAY_METHOD_LABELS[method] || method || '未选择'

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(Number(ts))
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const exporting = ref(false)
const truncated = ref(false)
const filters = reactive({ keyword: '', status: '', billableOnly: false, dateRange: createCurrentMonthRange() })

const load = async () => {
  loading.value = true
  try {
    const data = await getFourFlowLedger(getToken(), {
      keyword: filters.keyword,
      status: filters.status,
      billableOnly: filters.billableOnly,
      ...toApiDateRange(filters.dateRange),
      page: page.value,
      pageSize: pageSize.value
    })
    rows.value = (data && data.list) || []
    total.value = Number((data && data.total) || 0)
    truncated.value = Boolean(data && data.truncated)
  } catch (e) {
    ElMessage.error(e.message || '台账列表加载失败')
  } finally {
    loading.value = false
  }
}

const onFilterChange = () => {
  page.value = 1
  load()
}

const doExport = async () => {
  exporting.value = true
  try {
    const PAGE_SIZE = 100, MAX_PAGES = 100
    const all = []
    let pageNo = 1, totalCount = 0, truncatedFlag = false
    while (pageNo <= MAX_PAGES) {
      const data = await getFourFlowLedger(getToken(), {
        keyword: filters.keyword,
        status: filters.status,
        billableOnly: filters.billableOnly,
        ...toApiDateRange(filters.dateRange),
        page: pageNo,
        pageSize: PAGE_SIZE
      })
      const list = (data && data.list) || []
      totalCount = Number((data && data.total) || 0)
      truncatedFlag = truncatedFlag || Boolean(data && data.truncated)
      all.push(...list)
      if (list.length < PAGE_SIZE || all.length >= totalCount) break
      pageNo += 1
    }
    if (!all.length) { ElMessage.warning('当前条件下没有可导出的台账数据'); return }
    await exportFourFlowLedger(all)
    if (truncatedFlag) ElMessage.warning(`已导出 ${all.length} 条，但数据量超过后台扫描上限，可能不完整，请缩小筛选范围`)
    else ElMessage.success(`已导出 ${all.length} 条四流台账`)
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

watch([page, pageSize], load)
onMounted(load)
</script>

<style scoped>
.ledger-page { min-height: 460px; }
.ledger-toolbar { display: flex; align-items: center; gap: 10px; margin: 4px 0 16px; flex-wrap: wrap; }
.pager { margin-top: 16px; justify-content: flex-end; }
.ledger-truncated { margin-top: 12px; font-size: 12px; color: #d97706; }
</style>
