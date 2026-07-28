<template>
  <div class="logistics-monitor">
    <el-tabs v-model="activeTab" class="lm-tabs">
    <el-tab-pane label="批量导入" name="import" lazy>
      <LogisticsImport />
    </el-tab-pane>
    <el-tab-pane label="异常预警" name="exception">
    <!-- 物流异常预警 -->
    <el-card shadow="never" class="lm-card">
      <div class="lm-head">
        <div class="lm-title">
          <el-icon><Warning /></el-icon>
          <span>物流异常预警</span>
          <el-tag v-if="exceptions.length" type="danger" effect="dark" size="small">{{ exceptions.length }}</el-tag>
        </div>
        <el-button :loading="loadingExceptions" size="small" @click="loadExceptions"><el-icon><Refresh /></el-icon>刷新</el-button>
      </div>
      <p class="lm-sub">优先依据快递100真实轨迹识别疑难、退签、拒签、48 小时未揽收和 72 小时停滞；未取得轨迹时自动按工单时间降级判断。</p>
      <el-table :data="exceptions" v-loading="loadingExceptions" size="small" empty-text="暂无物流异常，一切正常" stripe>
        <el-table-column prop="orderNo" label="工单号" min-width="150" />
        <el-table-column label="物流段" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.segment === 'back' ? 'success' : 'primary'" effect="plain">{{ row.segment === 'back' ? '回寄' : '寄出' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="异常类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'no_pickup' ? 'warning' : 'danger'">{{ exceptionLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hours" label="已超(小时)" width="100" />
        <el-table-column prop="company" label="快递公司" min-width="110" />
        <el-table-column prop="trackingNo" label="运单号" min-width="160" />
        <el-table-column prop="reason" label="处理建议" min-width="240" show-overflow-tooltip />
      </el-table>
    </el-card>
    </el-tab-pane>
    <el-tab-pane label="台账" name="ledger" lazy>
    <!-- 物流台账 -->
    <el-card shadow="never" class="lm-card">
      <div class="lm-head">
        <div class="lm-title"><el-icon><Van /></el-icon><span>物流台账</span></div>
        <div class="lm-actions">
          <el-input v-model="filters.keyword" placeholder="工单号 / 客户 / 运单号" clearable size="small" style="width: 220px" @keyup.enter="reloadLedger" @clear="reloadLedger" />
          <el-select v-model="filters.status" placeholder="全部状态" clearable size="small" style="width: 130px" @change="reloadLedger">
            <el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-button type="primary" size="small" @click="reloadLedger">查询</el-button>
          <el-button type="success" plain size="small" :loading="exporting" @click="exportLedger"><el-icon><Download /></el-icon>导出台账</el-button>
        </div>
      </div>
      <el-table :data="ledger" v-loading="loadingLedger" size="small" empty-text="暂无物流记录" stripe>
        <el-table-column prop="order_no" label="工单号" min-width="150" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.arrival_confirm_status === 'pending'" size="small" type="warning">待入库</el-tag>
            <el-tag v-else size="small" effect="plain">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customer" label="客户" min-width="120" show-overflow-tooltip />
        <el-table-column label="寄出物流" min-width="180">
          <template #default="{ row }">
            <div v-if="row.out_no" class="lm-track-cell">
              <span>{{ row.out_company || '物流' }} · {{ row.out_no }}</span>
              <small v-if="row.out_track_status">{{ row.out_track_status }}<template v-if="row.out_last_track_at"> · {{ row.out_last_track_at }}</template></small>
              <small v-else-if="row.out_subscription_status === 'failed'" class="lm-danger">订阅失败</small>
              <el-button type="primary" link size="small" class="lm-track-action" @click="openLogisticsTrack(row, 'out')">查看轨迹</el-button>
            </div>
            <span v-else class="lm-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="回寄物流" min-width="180">
          <template #default="{ row }">
            <div v-if="row.back_no" class="lm-track-cell">
              <span>{{ row.back_company || '物流' }} · {{ row.back_no }}</span>
              <small v-if="row.back_track_status">{{ row.back_track_status }}<template v-if="row.back_last_track_at"> · {{ row.back_last_track_at }}</template></small>
              <small v-else-if="row.back_subscription_status === 'failed'" class="lm-danger">订阅失败</small>
              <el-button type="primary" link size="small" class="lm-track-action" @click="openLogisticsTrack(row, 'back')">查看轨迹</el-button>
            </div>
            <span v-else class="lm-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="160">
          <template #default="{ row }">{{ formatTime(row.update_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.arrival_confirm_status === 'pending' && row.can_confirm_arrival"
              type="primary"
              size="small"
              :loading="confirmingOrderId === row.order_id"
              @click="confirmArrival(row)"
            >确认入库</el-button>
            <span v-else-if="row.arrival_confirm_status === 'confirmed'" class="lm-confirmed">已入库</span>
            <span v-else-if="row.arrival_confirm_status === 'pending'" class="lm-muted">待管理员确认</span>
            <span v-else class="lm-muted">—</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="lm-pager">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :current-page="page"
          :page-size="pageSize"
          @current-change="onPageChange"
        />
      </div>
    </el-card>
    </el-tab-pane>
    </el-tabs>

    <el-drawer v-model="trackDrawerVisible" :title="trackDrawerTitle" size="460px" destroy-on-close>
      <div v-loading="trackLoading" class="lm-trace-drawer">
        <div class="lm-trace-summary">
          <span class="lm-trace-label">{{ logisticsTrack.company || '物流公司待补充' }}</span>
          <strong>{{ logisticsTrack.tracking_no || '暂无运单号' }}</strong>
          <el-tag v-if="logisticsTrack.cache && logisticsTrack.cache.status" size="small" :type="traceTone(logisticsTrack.cache.tone)">
            {{ logisticsTrack.cache.status }}
          </el-tag>
        </div>
        <div class="lm-trace-meta">
          <span>最后更新：{{ traceTime(logisticsTrack.cache && logisticsTrack.cache.lastTrackAt) || '-' }}</span>
          <span>查询时间：{{ traceTime(logisticsTrack.cache && logisticsTrack.cache.fetchedAt) || '-' }}</span>
        </div>
        <div class="lm-trace-toolbar">
          <span>{{ logisticsTrack.cached ? '当前展示缓存轨迹' : '当前展示最新查询结果' }}</span>
          <el-button type="primary" size="small" :loading="trackLoading" :disabled="!logisticsTrack.tracking_no" @click="loadLogisticsTrack(true)">刷新轨迹</el-button>
        </div>
        <el-alert v-if="logisticsTrack.message" :title="logisticsTrack.message" type="warning" :closable="false" show-icon class="lm-trace-alert" />
        <el-timeline v-if="traceRows.length" class="lm-trace-timeline">
          <el-timeline-item v-for="item in traceRows" :key="`${item.time}-${item.desc}`" :timestamp="traceTime(item.time)" :type="traceTone(logisticsTrack.cache && logisticsTrack.cache.tone)">
            <strong>{{ item.title || '物流更新' }}</strong>
            <p>{{ item.desc }}</p>
            <small v-if="item.location">{{ item.location }}</small>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else :image-size="76" :description="logisticsTrack.available ? '暂未获取到物流轨迹' : '暂时无法查询物流轨迹'" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { confirmInboundArrival, getLogisticsExceptions, getLogisticsLedger, getLogisticsTrack } from '../api/order.js'
import LogisticsImport from './LogisticsImport.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeTab = ref(route.query.tab === 'import' ? 'import' : (route.query.tab === 'ledger' ? 'ledger' : 'exception'))
const applyRouteTab = () => { activeTab.value = route.query.tab === 'import' ? 'import' : (route.query.tab === 'ledger' ? 'ledger' : 'exception') }
const getToken = () => localStorage.getItem('adminToken')

const STATUS_LABELS = {
  pending: '已提交', sent: '运输中', received: '已签收', inspecting: '检测中',
  fixing: '处理中', shipped: '已回寄', completed: '已完成', cancelled: '已取消'
}
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
const statusLabel = (s) => STATUS_LABELS[s] || s || '-'
const exceptionLabel = (type) => ({ no_pickup: '未揽收', stalled: '停滞', provider_exception: '物流异常' }[type] || '异常')

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(Number(ts))
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const traceTime = (value) => {
  if (!value) return ''
  if (typeof value === 'number' || /^\d+$/.test(String(value))) return formatTime(Number(value))
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : formatTime(date.getTime())
}
const traceTone = (tone) => ({ ok: 'success', danger: 'danger', warn: 'warning' }[tone] || 'info')

// ===== 异常预警 =====
const exceptions = ref([])
const loadingExceptions = ref(false)
const loadExceptions = async () => {
  loadingExceptions.value = true
  try {
    const data = await getLogisticsExceptions(getToken())
    exceptions.value = (data && data.exceptions) || []
  } catch (e) {
    ElMessage.error(e.message || '加载物流异常失败')
  } finally {
    loadingExceptions.value = false
  }
}

// ===== 台账 =====
const ledger = ref([])
const loadingLedger = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '' })
const exporting = ref(false)
const confirmingOrderId = ref('')
const trackDrawerVisible = ref(false)
const trackLoading = ref(false)
const logisticsTrack = ref({})
const traceRows = computed(() => (logisticsTrack.value.cache && logisticsTrack.value.cache.tracks) || [])
const trackDrawerTitle = computed(() => `${logisticsTrack.value.segment === 'back' ? '回寄' : '寄出'}物流轨迹`)

const confirmArrival = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认工单 ${row.order_no} 的包裹和设备已经核对无误并正式入库？`,
      '确认设备入库',
      { confirmButtonText: '确认入库', cancelButtonText: '取消', type: 'warning' }
    )
    confirmingOrderId.value = row.order_id
    await confirmInboundArrival(getToken(), row.order_id)
    ElMessage.success('设备已确认入库')
    await Promise.all([loadLedger(), loadExceptions()])
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e.message || '确认入库失败')
  } finally {
    confirmingOrderId.value = ''
  }
}

const loadLedger = async () => {
  loadingLedger.value = true
  try {
    const data = await getLogisticsLedger(getToken(), {
      keyword: filters.keyword, status: filters.status, page: page.value, pageSize: pageSize.value
    })
    ledger.value = (data && data.list) || []
    total.value = (data && data.total) || 0
  } catch (e) {
    ElMessage.error(e.message || '加载物流台账失败')
  } finally {
    loadingLedger.value = false
  }
}
const reloadLedger = () => { page.value = 1; loadLedger() }
const onPageChange = (p) => { page.value = p; loadLedger() }

const openLogisticsTrack = async (row, segment) => {
  logisticsTrack.value = {
    orderId: row.order_id,
    segment,
    company: segment === 'back' ? row.back_company : row.out_company,
    tracking_no: segment === 'back' ? row.back_no : row.out_no,
    cache: {},
    available: false,
    cached: true,
    message: ''
  }
  trackDrawerVisible.value = true
  await loadLogisticsTrack(false)
}

const loadLogisticsTrack = async (refresh = false) => {
  if (!logisticsTrack.value.orderId) return
  trackLoading.value = true
  try {
    const data = await getLogisticsTrack(getToken(), logisticsTrack.value.orderId, logisticsTrack.value.segment, refresh)
    logisticsTrack.value = { ...logisticsTrack.value, ...(data || {}) }
  } catch (e) {
    logisticsTrack.value = { ...logisticsTrack.value, message: e.message || '加载物流轨迹失败' }
  } finally {
    trackLoading.value = false
  }
}

// 导出台账：分页拉全量（pageSize=100），避免静默截断
const exportLedger = async () => {
  exporting.value = true
  try {
    const PAGE_SIZE = 100
    const MAX_PAGES = 100
    const list = []
    let pageNo = 1
    let totalCount = 0
    let truncated = false
    while (pageNo <= MAX_PAGES) {
      const data = await getLogisticsLedger(getToken(), {
        keyword: filters.keyword, status: filters.status, page: pageNo, pageSize: PAGE_SIZE
      })
      const pageList = (data && data.list) || []
      totalCount = (data && data.total) || 0
      truncated = truncated || Boolean(data && data.truncated)
      list.push(...pageList)
      if (pageList.length < PAGE_SIZE || list.length >= totalCount) break
      pageNo += 1
    }
    if (!list.length) { ElMessage.warning('当前条件下没有可导出的物流记录'); return }
    const headers = ['工单号', '状态', '客户', '寄出物流公司', '寄出运单号', '回寄物流公司', '回寄运单号', '创建时间', '更新时间']
    const esc = (v) => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`
    const lines = [headers.join(',')]
    list.forEach(r => {
      lines.push([
        r.order_no, statusLabel(r.status), r.customer,
        r.out_company, r.out_no, r.back_company, r.back_no,
        formatTime(r.create_time), formatTime(r.update_time)
      ].map(esc).join(','))
    })
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = new Date(); const p = (n) => String(n).padStart(2, '0')
    a.href = url
    a.download = `物流台账_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.csv`
    a.click()
    URL.revokeObjectURL(url)
    if (truncated) {
      ElMessage.warning(`已导出 ${list.length} 条，但数据量超过后台扫描上限，可能不完整，请缩小筛选范围后再导出`)
    } else {
      ElMessage.success(`已导出 ${list.length} 条物流台账`)
    }
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

onMounted(() => { loadExceptions(); loadLedger() })
watch(() => route.query.tab, applyRouteTab)
</script>

<style scoped>
.logistics-monitor { display: flex; flex-direction: column; gap: 16px; }
.lm-card { border-radius: 12px; }
.lm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.lm-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #1f2d3d; }
.lm-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lm-sub { margin: 8px 0 14px; font-size: 12px; color: #909399; }
.lm-pager { margin-top: 14px; display: flex; justify-content: flex-end; }
.lm-muted { color: #c0c4cc; }
.lm-track-cell { display: flex; flex-direction: column; gap: 3px; }
.lm-track-cell small { color: #909399; }
.lm-track-cell .lm-danger { color: #f56c6c; }
.lm-track-action { width: fit-content; height: auto; padding: 0; margin-top: 1px; }
.lm-confirmed { color: #67c23a; font-size: 12px; }
.lm-trace-drawer { min-height: 280px; }
.lm-trace-summary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-bottom: 10px; border-bottom: 1px solid #ebeef5; }
.lm-trace-summary strong { color: #303133; font-size: 16px; word-break: break-all; }
.lm-trace-label { color: #606266; font-size: 13px; }
.lm-trace-meta { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; color: #909399; font-size: 12px; }
.lm-trace-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 16px 0; color: #909399; font-size: 12px; }
.lm-trace-alert { margin-bottom: 16px; }
.lm-trace-timeline { margin: 18px 0 0 4px; }
.lm-trace-timeline p { margin: 4px 0; color: #303133; line-height: 1.55; }
.lm-trace-timeline small { color: #909399; }
</style>
