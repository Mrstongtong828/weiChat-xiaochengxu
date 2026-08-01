<template>
  <div class="glass-card audit-log">
    <div class="section-title">
      <div>
        <span>操作审计日志</span>
        <p class="section-desc">记录工单状态、报价、付款、发票和物流等关键操作，便于追溯责任与合规留痕。</p>
      </div>
    </div>

    <el-form :inline="true" :model="filters" class="filter-bar" @submit.prevent>
      <el-form-item label="工单号">
        <el-input v-model="filters.orderNo" placeholder="精确工单号" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="操作类型">
        <el-select v-model="filters.action" placeholder="全部" clearable style="width: 160px">
          <el-option v-for="(label, key) in ACTION_LABELS" :key="key" :label="label" :value="key" />
        </el-select>
      </el-form-item>
      <el-form-item label="操作人">
        <el-input v-model="filters.actorName" placeholder="操作人姓名" clearable style="width: 140px" />
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker v-model="filters.timeRange" type="datetimerange" range-separator="至"
          start-placeholder="开始时间" end-placeholder="结束时间" value-format="x" style="width: 360px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleQuery">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" plain :loading="exporting" @click="handleExport">导出 Excel</el-button>
      </el-form-item>
    </el-form>

    <div class="table-responsive">
      <el-table :data="list" v-loading="loading" class="modern-table" style="width:100%;">
        <template #empty>
          <div class="table-empty-guide">
            <strong>暂无审计记录</strong>
            <span>产生工单、报价、付款或物流操作后，会在这里留下可追溯记录。</span>
          </div>
        </template>
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="来源" width="100">
          <template #default="{ row }">{{ SOURCE_LABELS[row.source] || row.source }}</template>
        </el-table-column>
        <el-table-column label="操作类型" width="140">
          <template #default="{ row }">{{ ACTION_LABELS[row.action] || row.action }}</template>
        </el-table-column>
        <el-table-column label="操作人" width="170">
          <template #default="{ row }">
            <span>{{ row.actor_name || '—' }}</span>
            <el-tag v-if="row.actor_role" size="small" class="role-tag">{{ ROLE_LABELS[row.actor_role] || row.actor_role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="工单号" width="190" prop="order_no" />
        <el-table-column label="变更详情" min-width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="showDetail(row)">查看前后值</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
      <div class="pager">
        <el-pagination background layout="total, sizes, prev, pager, next" :total="total"
          v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]"
          @current-change="loadData" @size-change="handleQuery" />
      </div>

    <el-dialog v-model="detailVisible" title="操作前后值（合规留痕）" width="640px">
      <div class="detail-block"><h4>变更前 (before)</h4><pre>{{ detailBefore }}</pre></div>
      <div class="detail-block"><h4>变更后 (after)</h4><pre>{{ detailAfter }}</pre></div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import ExcelJS from 'exceljs'
import { getOrderEvents } from '../api/audit.js'

const ACTION_LABELS = {
  create_order: '新建工单', update_status: '状态变更', issue_quote: '发布报价',
  confirm_quote: '确认报价', upload_payment_proof: '上传付款凭证', confirm_payment: '确认收款',
  apply_invoice: '申请发票', update_invoice: '发票处理', ship_return: '回寄物流',
  cancel_order: '取消工单', update_remarks: '修改备注', add_timeline: '添加跟进',
  assign_engineer: '分配工程师', wechat_pay_confirmed: '微信支付确认'
}
const SOURCE_LABELS = { client: '客户端', admin: '后台', system: '系统', wechat_pay: '微信支付' }
const ROLE_LABELS = { admin: '管理员', superadmin: '超级管理员', engineer: '工程师', finance: '财务', support: '客服' }

const filters = reactive({ orderNo: '', action: '', actorName: '', timeRange: null })
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const exporting = ref(false)
const detailVisible = ref(false)
const detailBefore = ref('')
const detailAfter = ref('')

const formatTime = (t) => (t ? new Date(Number(t)).toLocaleString('zh-CN') : '')

const buildParams = () => {
  const p = { orderNo: filters.orderNo, action: filters.action, actorName: filters.actorName }
  if (Array.isArray(filters.timeRange) && filters.timeRange.length === 2) {
    p.startTime = filters.timeRange[0]
    p.endTime = filters.timeRange[1]
  }
  return p
}

const loadData = async () => {
  loading.value = true
  try {
    const data = await getOrderEvents({ ...buildParams(), page: page.value, pageSize: pageSize.value })
    list.value = data.list || []
    total.value = data.total || 0
  } catch (e) {
    // 错误信息已由 request 拦截器统一提示
  } finally {
    loading.value = false
  }
}

const handleQuery = () => { page.value = 1; loadData() }
const handleReset = () => {
  filters.orderNo = ''
  filters.action = ''
  filters.actorName = ''
  filters.timeRange = null
  handleQuery()
}

const showDetail = (row) => {
  detailBefore.value = JSON.stringify(row.before || {}, null, 2)
  detailAfter.value = JSON.stringify(row.after || {}, null, 2)
  detailVisible.value = true
}

const handleExport = async () => {
  exporting.value = true
  try {
    const data = await getOrderEvents({ ...buildParams(), page: 1, pageSize: 1000 })
    const rows = data.list || []
    if (!rows.length) { ElMessage.warning('当前条件下没有可导出的记录'); return }
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('工单操作日志')
    ws.columns = [
      { header: '操作时间', key: 'time', width: 22 },
      { header: '来源', key: 'source', width: 12 },
      { header: '操作类型', key: 'action', width: 16 },
      { header: '操作人', key: 'actor', width: 16 },
      { header: '角色', key: 'role', width: 12 },
      { header: '工单号', key: 'order_no', width: 20 },
      { header: '变更前', key: 'before', width: 44 },
      { header: '变更后', key: 'after', width: 44 }
    ]
    ws.addRows(rows.map(r => ({
      time: formatTime(r.create_time),
      source: SOURCE_LABELS[r.source] || r.source,
      action: ACTION_LABELS[r.action] || r.action,
      actor: r.actor_name || '',
      role: ROLE_LABELS[r.actor_role] || r.actor_role || '',
      order_no: r.order_no || '',
      before: JSON.stringify(r.before || {}),
      after: JSON.stringify(r.after || {})
    })))
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `工单操作日志_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${rows.length} 条记录`)
  } catch (e) {
    ElMessage.error('导出失败：' + (e.message || e))
  } finally {
    exporting.value = false
  }
}

loadData()
</script>

<style scoped>
.audit-log { display: flex; flex-direction: column; gap: 16px; }
.filter-card, .table-card { border-radius: 12px; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
.role-tag { margin-left: 6px; }
.detail-block { margin-bottom: 12px; }
.detail-block h4 { margin: 0 0 6px; font-size: 13px; color: #475569; }
.detail-block pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; max-height: 240px; overflow: auto; font-size: 12px; margin: 0; white-space: pre-wrap; word-break: break-all; }
</style>
