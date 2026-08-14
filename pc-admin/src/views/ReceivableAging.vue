<template>
  <div class="glass-card aging-page">
    <div class="section-title">
      <div>
        <span>应收账龄</span>
        <p class="section-desc">未收清款项（待付款/待核销）按付款期限分档，逾期越久越需要优先催收。</p>
      </div>
      <div class="title-actions">
        <el-tag type="info" effect="plain">应收余额 ¥{{ fmtMoney(summary?.outstandingAmount) }} · {{ summary?.outstandingCount || 0 }} 单</el-tag>
        <el-tag type="warning" effect="plain">已逾期 ¥{{ fmtMoney(summary?.overdueAmount) }} · {{ summary?.overdueCount || 0 }} 单</el-tag>
      </div>
    </div>

    <div class="aging-toolbar">
      <el-input v-model="keyword" clearable placeholder="搜索工单号 / 客户 / 手机号" style="width: 260px" @keyup.enter="applyFilter" @clear="applyFilter" />
      <el-button type="primary" plain @click="applyFilter">查询</el-button>
      <el-tooltip content="导出当前筛选下的催款清单 Excel，含账龄分组、联系方式与逾期天数" placement="top">
        <el-button type="primary" :loading="exporting" @click="doExport"><el-icon><Download /></el-icon>导出催款清单</el-button>
      </el-tooltip>
    </div>

    <div class="aging-bucket-chips">
      <div
        v-for="b in buckets"
        :key="b.key"
        class="aging-chip"
        :class="['is-' + b.tone, { 'is-active': activeBucket === b.key }]"
        @click="toggleBucket(b.key)"
      >
        <span class="aging-chip-label">{{ b.label }}</span>
        <strong>{{ b.count }}</strong><span> 单</span>
        <em>¥{{ fmtMoney(b.amount) }}</em>
      </div>
    </div>

    <div class="table-responsive">
      <el-table :data="filteredRows" class="modern-table" style="width:100%;">
        <template #empty>
          <div class="table-empty-guide">
            <strong>暂无未收清款项</strong>
            <span>已出报价且未收清（待付款/待核销）的工单会自动出现在这里。</span>
          </div>
        </template>
        <el-table-column label="账龄分组" width="130">
          <template #default="{ row }">
            <el-tag :type="bucketTag(row.bucket)" effect="plain">{{ bucketLabel(row.bucket) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="order_no" label="工单号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="customer" label="客户" min-width="150" show-overflow-tooltip />
        <el-table-column prop="phone" label="联系电话" width="140" />
        <el-table-column label="应收金额" width="120">
          <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="付款截止" width="150">
          <template #default="{ row }">{{ row.payment_deadline ? formatTime(row.payment_deadline) : '-' }}</template>
        </el-table-column>
        <el-table-column label="逾期天数" width="110">
          <template #default="{ row }">
            <span :class="row.overdue_days > 0 ? 'aging-overdue' : 'aging-ok'">{{ row.overdue_days > 0 ? row.overdue_days + ' 天' : '未逾期' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="付款状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.payment_status === 'uploaded' ? 'primary' : 'warning'" effect="plain">{{ row.payment_status === 'uploaded' ? '待核销' : '待付款' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="right" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goWorkOrder(row)">去工单</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="truncated" class="aging-truncated">
      数据量超过后台扫描上限，可能不完整，请缩小筛选范围或联系管理员调高上限。
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { exportReceivableAging } from '../utils/financeExport.js'

const props = defineProps({
  summary: { type: Object, default: () => ({}) },
  aging: { type: Array, default: () => [] },
  truncated: { type: Boolean, default: false }
})

const router = useRouter()
const keyword = ref('')
const activeBucket = ref('')
const exporting = ref(false)

const BUCKET_META = [
  { key: 'notDue', label: '未到期', tone: 'blue', tag: 'primary' },
  { key: 'overdue1_7', label: '逾期1-7天', tone: 'orange', tag: 'warning' },
  { key: 'overdue8_30', label: '逾期8-30天', tone: 'red', tag: 'danger' },
  { key: 'overdue30plus', label: '逾期30天以上', tone: 'dark', tag: 'danger' }
]

const buckets = computed(() => (props.aging || []).map(bucket => {
  const meta = BUCKET_META.find(item => item.key === bucket.key) || { tone: 'blue', tag: 'primary' }
  return { ...bucket, tone: meta.tone, tag: meta.tag }
}))

const allRows = computed(() => (props.aging || []).flatMap(bucket =>
  (bucket.orders || []).map(order => ({ ...order, bucket: bucket.key, bucketLabel: bucket.label }))
))

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return allRows.value.filter(row => {
    if (activeBucket.value && row.bucket !== activeBucket.value) return false
    if (!kw) return true
    return [row.order_no, row.customer, row.phone].filter(Boolean).join(' ').toLowerCase().includes(kw)
  })
})

const bucketLabel = key => {
  const meta = BUCKET_META.find(item => item.key === key)
  return meta ? meta.label : '未到期'
}
const bucketTag = key => {
  const meta = BUCKET_META.find(item => item.key === key)
  return meta ? meta.tag : 'primary'
}

const toggleBucket = key => {
  activeBucket.value = activeBucket.value === key ? '' : key
}
const applyFilter = () => {}

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(Number(ts))
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const fmtMoney = (value) => Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const goWorkOrder = (row) => {
  router.push({ path: '/workorder', query: { keyword: row.order_no } })
}

const doExport = async () => {
  if (!filteredRows.value.length) {
    ElMessage.warning('当前筛选条件下没有可导出的应收记录')
    return
  }
  exporting.value = true
  try {
    await exportReceivableAging(filteredRows.value)
    ElMessage.success(`已导出 ${filteredRows.value.length} 条应收记录`)
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.aging-page { min-height: 420px; }
.aging-toolbar { display: flex; align-items: center; gap: 10px; margin: 4px 0 16px; flex-wrap: wrap; }
.aging-bucket-chips { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
.aging-chip {
  display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;
  padding: 12px 14px; border-radius: 10px; cursor: pointer;
  border: 1px solid #edf1f7; background: #f7f9fc; transition: border-color .2s ease, transform .2s ease;
}
.aging-chip:hover { transform: translateY(-1px); }
.aging-chip.is-active { border-color: #1677ff; box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12); }
.aging-chip.is-blue .aging-chip-label { color: #1677ff; }
.aging-chip.is-orange .aging-chip-label { color: #d97706; }
.aging-chip.is-red .aging-chip-label { color: #dc2626; }
.aging-chip.is-dark .aging-chip-label { color: #7f1d1d; }
.aging-chip-label { font-size: 13px; font-weight: 700; }
.aging-chip strong { font-size: 20px; color: #1f2d3d; }
.aging-chip em { font-style: normal; font-size: 13px; color: #6b7785; margin-left: auto; }
.aging-overdue { color: #dc2626; font-weight: 600; }
.aging-ok { color: #16a34a; }
.aging-truncated { margin-top: 12px; font-size: 12px; color: #d97706; }
</style>
