<template>
  <div class="logistics-monitor">
    <section class="lm-overview-section" aria-labelledby="logistics-overview-title">
      <div class="lm-section-label">
        <div><h2 id="logistics-overview-title">物流总览</h2><span>当前工单物流状态</span></div>
        <div class="lm-overview-meta">
          <span class="lm-updated-at">更新于 {{ overviewUpdatedAt || '--:--' }}</span>
          <div v-if="readinessLoaded" class="lm-service-state" :class="{ ready: readiness.ready }">
            <span class="lm-service-dot"></span>
            <span>{{ readiness.ready ? '物流服务正常' : '物流服务降级' }}</span>
            <el-tooltip :content="readinessDescription" placement="bottom-end">
              <el-button text circle aria-label="重新检查物流服务" :loading="loadingReadiness" @click="loadReadiness"><el-icon><Refresh /></el-icon></el-button>
            </el-tooltip>
          </div>
        </div>
      </div>

      <div class="lm-overview-layout">
        <div class="lm-metric-grid" v-loading="loadingOverview">
          <button v-for="item in overviewCards" :key="item.key" type="button" class="lm-metric" :class="[`is-${item.tone}`, { active: activeStatus === item.filter }]" @click="selectOverviewCard(item)">
            <span class="lm-metric-label">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.note }}</small>
            <span class="lm-metric-icon"><el-icon><component :is="item.icon" /></el-icon></span>
          </button>
        </div>

        <aside class="lm-exception-queue" :class="{ clear: !exceptions.length }">
          <div class="lm-exception-head">
            <div><h2>异常预警</h2><p>{{ exceptions.length ? `${exceptions.length} 个异常物流需要处理` : '当前没有待处理异常' }}</p></div>
            <el-button v-if="exceptions.length" type="primary" link @click="selectStatus('exception')">查看全部</el-button>
          </div>
          <div v-if="exceptions.length" class="lm-exception-list">
            <button v-for="item in exceptions.slice(0, 3)" :key="`${item.orderId}-${item.segment}-${item.type}`" type="button" class="lm-exception-item" @click="openExceptionTrack(item)">
              <span class="lm-exception-type">{{ exceptionLabel(item.type) }}</span>
              <span class="lm-exception-copy"><strong>{{ item.orderNo || '-' }}</strong><small>{{ item.company || '物流公司待补充' }} · {{ maskTrackingNo(item.trackingNo) }}</small></span>
              <span class="lm-exception-hours">{{ item.hours ? `已超 ${item.hours} 小时` : '立即核实' }}</span>
              <el-icon><ArrowRight /></el-icon>
            </button>
          </div>
          <div v-else class="lm-exception-empty"><el-icon><CircleCheck /></el-icon><span>在途物流运行正常</span></div>
        </aside>
      </div>
    </section>

    <section ref="ledgerSection" class="lm-ledger-section" aria-labelledby="logistics-ledger-title">
      <div class="lm-ledger-head">
        <div><h2 id="logistics-ledger-title">{{ activeStatus === 'exception' ? '异常物流' : '物流台账' }}</h2><p>{{ activeStatus === 'exception' ? '按超时程度排序，建议从上到下处理' : '寄入与回寄物流统一查看' }}</p></div>
        <div class="lm-toolbar">
          <el-button v-if="canImportLogistics" @click="importDialogVisible = true"><el-icon><Upload /></el-icon>批量导入</el-button>
          <el-button v-if="canExportLedger" :loading="exporting" @click="exportLedger"><el-icon><Download /></el-icon>批量导出</el-button>
          <el-tooltip content="刷新当前数据" placement="top"><el-button circle aria-label="刷新物流数据" :loading="loadingLedger || loadingExceptions" @click="refreshAll"><el-icon><Refresh /></el-icon></el-button></el-tooltip>
        </div>
      </div>

      <div class="lm-status-tabs" role="tablist" aria-label="物流状态筛选">
        <button v-for="tab in statusTabs" :key="tab.key" type="button" role="tab" :aria-selected="activeStatus === tab.key" :class="{ active: activeStatus === tab.key, danger: tab.key === 'exception' }" @click="selectStatus(tab.key)">
          {{ tab.label }} <span>({{ tab.count }})</span>
        </button>
      </div>

      <div v-if="activeStatus !== 'exception'" class="lm-filter-bar">
        <el-input v-model="filters.keyword" clearable class="lm-search" placeholder="工单号 / 客户名称 / 运单号" @keyup.enter="reloadLedger" @clear="reloadLedger"><template #prefix><el-icon><Search /></el-icon></template></el-input>
        <el-select v-model="filters.status" class="lm-status-select" placeholder="全部状态" @change="onStatusSelectChange">
          <el-option label="全部状态" value="" /><el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-date-picker v-model="filterDateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" :shortcuts="dateRangeShortcuts" unlink-panels clearable class="lm-date-range" style="width: 100%" />
        <el-button type="primary" class="lm-query-button" @click="reloadLedger">查询</el-button><el-button @click="resetFilters">重置</el-button>
      </div>

      <div v-if="activeStatus === 'exception'" class="lm-exception-table-wrap" v-loading="loadingExceptions">
        <el-table :data="exceptions" row-key="orderId" empty-text="当前没有物流异常">
          <el-table-column label="异常类型" width="120"><template #default="{ row }"><span class="lm-danger-badge">{{ exceptionLabel(row.type) }}</span></template></el-table-column>
          <el-table-column label="工单信息" min-width="210"><template #default="{ row }"><div class="lm-order-cell"><strong>{{ row.orderNo || '-' }}</strong><small>{{ row.segment === 'back' ? '后台回寄物流' : '客户寄入物流' }}</small></div></template></el-table-column>
          <el-table-column label="物流信息" min-width="230"><template #default="{ row }"><div class="lm-shipment-cell"><strong>{{ row.company || '物流公司待补充' }}</strong><span>{{ row.trackingNo || '-' }}</span></div></template></el-table-column>
          <el-table-column prop="reason" label="异常说明" min-width="270" show-overflow-tooltip />
          <el-table-column label="超时" width="110"><template #default="{ row }"><span class="lm-overdue-text">{{ row.hours ? `${row.hours} 小时` : '需立即核实' }}</span></template></el-table-column>
          <el-table-column label="操作" width="110" fixed="right"><template #default="{ row }"><el-button type="primary" link @click="openExceptionTrack(row)">处理异常</el-button></template></el-table-column>
        </el-table>
      </div>

      <template v-else>
        <el-table :data="ledger" v-loading="loadingLedger" row-key="order_id" empty-text="当前筛选条件下没有物流记录" class="lm-ledger-table">
          <el-table-column type="selection" width="46" />
          <el-table-column label="工单信息" min-width="210"><template #default="{ row }"><div class="lm-order-cell"><span class="lm-order-number"><strong>{{ row.order_no }}</strong><el-button text circle aria-label="复制工单号" @click="copyOrderNo(row.order_no)"><el-icon><Document /></el-icon></el-button></span><small>创建：{{ formatTime(row.create_time) || '-' }}</small></div></template></el-table-column>
          <el-table-column prop="customer" label="客户" min-width="160" show-overflow-tooltip><template #default="{ row }"><span class="lm-customer">{{ row.customer || '客户信息待补充' }}</span></template></el-table-column>
          <el-table-column label="寄入物流" min-width="210"><template #default="{ row }"><ShipmentCell v-if="row.out_no" :company="row.out_company" :tracking-no="row.out_no" :track-status="row.out_track_status" :last-track-at="row.out_last_track_at" :failed="row.out_subscription_status === 'failed'" @open="openLogisticsTrack(row, 'out')" /><span v-else class="lm-muted">—</span></template></el-table-column>
          <el-table-column label="回寄物流" min-width="210"><template #default="{ row }"><ShipmentCell v-if="row.back_no" :company="row.back_company" :tracking-no="row.back_no" :track-status="row.back_track_status" :last-track-at="row.back_last_track_at" :failed="row.back_subscription_status === 'failed'" @open="openLogisticsTrack(row, 'back')" /><span v-else class="lm-muted">—</span></template></el-table-column>
          <el-table-column label="物流状态" width="140"><template #default="{ row }"><div class="lm-status-cell"><span class="lm-status-pill" :class="`is-${statusTone(row.status)}`">{{ row.arrival_confirm_status === 'pending' ? '待入库' : statusLabel(row.status) }}</span><small v-if="row.arrival_confirm_status === 'pending'">包裹已到达，待核对</small><small v-else>{{ statusNote(row) }}</small></div></template></el-table-column>
          <el-table-column label="更新时间" width="156"><template #default="{ row }">{{ formatTime(row.update_time) || '-' }}</template></el-table-column>
          <el-table-column label="操作" width="150" fixed="right"><template #default="{ row }"><div class="lm-row-actions"><el-button v-if="row.arrival_confirm_status === 'pending' && row.can_confirm_arrival" type="primary" link :loading="confirmingOrderId === row.order_id" @click="confirmArrival(row)">确认入库</el-button><el-button v-else-if="row.out_no || row.back_no" type="primary" link @click="openLogisticsTrack(row, row.back_no ? 'back' : 'out')">查看详情</el-button><span v-else class="lm-muted">—</span></div></template></el-table-column>
        </el-table>
        <div class="lm-pager"><el-pagination background layout="total, prev, pager, next" :total="total" :current-page="page" :page-size="pageSize" @current-change="onPageChange" /></div>
      </template>
    </section>

    <el-dialog v-model="importDialogVisible" title="批量导入物流" width="min(720px, 92vw)" destroy-on-close append-to-body><LogisticsImport /></el-dialog>

    <el-drawer v-model="trackDrawerVisible" :title="trackDrawerTitle" size="min(480px, 100vw)" destroy-on-close>
      <div v-loading="trackLoading" class="lm-trace-drawer">
        <div class="lm-trace-summary"><div><span>{{ logisticsTrack.company || '物流公司待补充' }}</span><strong>{{ logisticsTrack.tracking_no || '暂无运单号' }}</strong></div><el-tag v-if="logisticsTrack.cache?.status" size="small" :type="traceTone(logisticsTrack.cache?.tone)">{{ logisticsTrack.cache.status }}</el-tag></div>
        <dl class="lm-trace-context"><div><dt>关联工单</dt><dd>{{ logisticsTrack.orderNo || logisticsTrack.orderId || '-' }}</dd></div><div><dt>物流方向</dt><dd>{{ logisticsTrack.segment === 'back' ? '后台回寄' : '客户寄入' }}</dd></div><div><dt>最后更新</dt><dd>{{ traceTime(logisticsTrack.cache?.lastTrackAt) || '-' }}</dd></div></dl>
        <div class="lm-trace-toolbar"><span>{{ logisticsTrack.cached ? '当前展示缓存轨迹' : '当前展示最新查询结果' }}</span><el-button type="primary" :loading="trackLoading" :disabled="!logisticsTrack.tracking_no" @click="loadLogisticsTrack(true)">刷新轨迹</el-button></div>
        <el-alert v-if="logisticsTrack.message" :title="logisticsTrack.message" type="warning" :closable="false" show-icon class="lm-trace-alert" />
        <el-timeline v-if="traceRows.length" class="lm-trace-timeline"><el-timeline-item v-for="item in traceRows" :key="`${item.time}-${item.desc}`" :timestamp="traceTime(item.time)" :type="traceTone(logisticsTrack.cache?.tone)"><strong>{{ item.title || '物流更新' }}</strong><p>{{ item.desc }}</p><small v-if="item.location">{{ item.location }}</small></el-timeline-item></el-timeline>
        <el-empty v-else :image-size="76" :description="logisticsTrack.available ? '暂未获取到物流轨迹' : '暂时无法查询物流轨迹'" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, reactive, ref, watch } from 'vue'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import { confirmInboundArrival, getLogisticsExceptions, getLogisticsLedger, getLogisticsReadiness, getLogisticsTrack, getStatistics, getWorkflowConfig } from '../api/order.js'
import LogisticsImport from './LogisticsImport.vue'
import { createCurrentMonthRange, dateRangeShortcuts, toApiDateRange } from '../utils/dateRange.js'

const route = useRoute()
const getToken = () => localStorage.getItem('adminToken')
const workflowConfig = ref(null)
const canImportLogistics = computed(() => Boolean(workflowConfig.value?.permissions?.import_inbound_logistics || workflowConfig.value?.permissions?.import_return_logistics))
const canExportLedger = computed(() => Boolean(workflowConfig.value?.permissions?.export_order))
const STATUS_LABELS = { pending: '待发货', sent: '运输中', received: '已签收', inspecting: '检测中', fixing: '处理中', shipped: '已回寄', completed: '已完成', cancelled: '已取消' }
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
const statusLabel = status => STATUS_LABELS[status] || status || '-'
const statusTone = status => ({ pending: 'pending', sent: 'transit', received: 'delivered', inspecting: 'processing', fixing: 'processing', shipped: 'delivered', completed: 'delivered' }[status] || 'neutral')
const exceptionLabel = type => ({ no_pickup: '未揽收', stalled: '运输超时', provider_exception: '物流异常' }[type] || '异常')
const formatTime = ts => {
  if (!ts) return ''
  const date = new Date(Number(ts))
  if (Number.isNaN(date.getTime())) return String(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const traceTime = value => {
  if (!value) return ''
  if (typeof value === 'number' || /^\d+$/.test(String(value))) return formatTime(Number(value))
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : formatTime(date.getTime())
}
const relativeTrackTime = value => {
  if (!value) return '查看最新轨迹'
  const timestamp = typeof value === 'number' ? value : Date.parse(value)
  if (!timestamp) return String(value)
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 60) return `${Math.max(minutes, 1)} 分钟前更新`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前更新`
  return `${Math.floor(minutes / 1440)} 天前更新`
}
const traceTone = tone => ({ ok: 'success', danger: 'danger', warn: 'warning' }[tone] || 'info')
const maskTrackingNo = value => { const text = String(value || ''); return text.length > 12 ? `${text.slice(0, 8)}...${text.slice(-4)}` : (text || '-') }

const ShipmentCell = defineComponent({
  props: { company: String, trackingNo: String, trackStatus: String, lastTrackAt: [String, Number], failed: Boolean },
  emits: ['open'],
  setup(props, { emit }) {
    return () => h('div', { class: 'lm-shipment-cell' }, [
      h('strong', props.company || '物流公司待补充'), h('span', props.trackingNo || '-'),
      h('small', { class: props.failed ? 'is-danger' : '' }, props.failed ? '订阅失败，点击查看' : (props.trackStatus ? `${props.trackStatus} · ${relativeTrackTime(props.lastTrackAt)}` : relativeTrackTime(props.lastTrackAt))),
      h(ElButton, { type: 'primary', link: true, onClick: () => emit('open') }, () => '查看轨迹')
    ])
  }
})

const readiness = ref({ ready: false, mode: 'fallback', missing: [] })
const readinessLoaded = ref(false)
const loadingReadiness = ref(false)
const readinessDescription = computed(() => readiness.value.ready ? '运单实时校验、轨迹查询、订阅推送和回调更新均可用。' : (readiness.value.mode === 'query_only' ? `实时查询可用，但订阅推送未就绪。缺少：${(readiness.value.missing || []).join('、') || '回调配置'}` : `当前仅使用本地格式校验和工单时间估算。缺少：${(readiness.value.missing || []).join('、') || '快递100配置'}`))
const loadReadiness = async () => { loadingReadiness.value = true; try { readiness.value = await getLogisticsReadiness(getToken()) } catch { readiness.value = { ready: false, mode: 'fallback', missing: [] } } finally { readinessLoaded.value = true; loadingReadiness.value = false } }

const overview = ref({})
const loadingOverview = ref(false)
const overviewUpdatedAt = ref('')
const loadOverview = async () => { loadingOverview.value = true; try { const data = await getStatistics(getToken(), { includeStatusBreakdown: true }); overview.value = data?.statusBreakdown || {}; overviewUpdatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) } catch (error) { ElMessage.error(error.message || '加载物流总览失败') } finally { loadingOverview.value = false } }
const exceptions = ref([])
const loadingExceptions = ref(false)
const loadExceptions = async () => { loadingExceptions.value = true; try { const data = await getLogisticsExceptions(getToken()); exceptions.value = data?.exceptions || [] } catch (error) { ElMessage.error(error.message || '加载物流异常失败') } finally { loadingExceptions.value = false } }

const overviewCards = computed(() => [
  { key: 'pending', label: '待发货', value: overview.value.pending || 0, note: '等待寄出或揽收', tone: 'pending', icon: 'Box', filter: 'pending' },
  { key: 'sent', label: '运输中', value: overview.value.sent || 0, note: '客户寄入途中', tone: 'transit', icon: 'Van', filter: 'sent' },
  { key: 'received', label: '已签收', value: overview.value.received || 0, note: '等待核对与处理', tone: 'delivered', icon: 'CircleCheck', filter: 'received' },
  { key: 'exception', label: '异常件', value: exceptions.value.length, note: exceptions.value.length ? '需要优先处理' : '当前无异常', tone: 'danger', icon: 'Warning', filter: 'exception' },
  { key: 'total', label: '台账总量', value: Object.entries(overview.value).filter(([key]) => key !== 'cancelled').reduce((sum, [, value]) => sum + Number(value || 0), 0), note: '全部有效工单', tone: 'total', icon: 'DataAnalysis', filter: 'all' }
])
const total = ref(0)
const statusTabs = computed(() => [
  { key: 'all', label: '全部', count: overviewCards.value.find(item => item.key === 'total')?.value || total.value }, { key: 'pending', label: '待发货', count: overview.value.pending || 0 }, { key: 'sent', label: '运输中', count: overview.value.sent || 0 }, { key: 'received', label: '已签收', count: overview.value.received || 0 }, { key: 'exception', label: '异常', count: exceptions.value.length }
])

const ledger = ref([])
const page = ref(1)
const pageSize = ref(20)
const loadingLedger = ref(false)
const activeStatus = ref('all')
const filters = reactive({ keyword: '', status: '' })
const filterDateRange = ref(null)
const exportDateRange = ref(createCurrentMonthRange())
const exporting = ref(false)
const confirmingOrderId = ref('')
const ledgerSection = ref(null)
const importDialogVisible = ref(false)
const loadLedger = async () => {
  if (activeStatus.value === 'exception') return
  loadingLedger.value = true
  try { const data = await getLogisticsLedger(getToken(), { keyword: filters.keyword, status: filters.status, ...toApiDateRange(filterDateRange.value), page: page.value, pageSize: pageSize.value }); ledger.value = data?.list || []; total.value = data?.total || 0 } catch (error) { ElMessage.error(error.message || '加载物流台账失败') } finally { loadingLedger.value = false }
}
const reloadLedger = () => { page.value = 1; loadLedger() }
const onPageChange = next => { page.value = next; loadLedger() }
const selectStatus = key => { activeStatus.value = key; filters.status = key === 'all' || key === 'exception' ? '' : key; page.value = 1; if (key !== 'exception') loadLedger() }
const selectOverviewCard = item => { selectStatus(item.filter); ledgerSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
const onStatusSelectChange = value => { activeStatus.value = value || 'all'; reloadLedger() }
const resetFilters = () => { filters.keyword = ''; filters.status = ''; filterDateRange.value = null; activeStatus.value = 'all'; reloadLedger() }
const statusNote = row => row.out_track_status || row.back_track_status || '状态已同步'
const refreshAll = () => Promise.all([loadOverview(), loadExceptions(), loadLedger(), loadReadiness()])
const copyOrderNo = async orderNo => { try { await navigator.clipboard.writeText(orderNo); ElMessage.success('工单号已复制') } catch { ElMessage.warning('复制失败，请手动复制') } }
const confirmArrival = async row => {
  try { await ElMessageBox.confirm(`确认工单 ${row.order_no} 的包裹和设备已经核对无误并正式入库？`, '确认设备入库', { confirmButtonText: '确认入库', cancelButtonText: '取消', type: 'warning' }); confirmingOrderId.value = row.order_id; await confirmInboundArrival(getToken(), row.order_id); ElMessage.success('设备已确认入库'); await Promise.all([loadLedger(), loadExceptions(), loadOverview()]) } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '确认入库失败') } finally { confirmingOrderId.value = '' }
}

const trackDrawerVisible = ref(false)
const trackLoading = ref(false)
const logisticsTrack = ref({})
const traceRows = computed(() => logisticsTrack.value.cache?.tracks || [])
const trackDrawerTitle = computed(() => `${logisticsTrack.value.segment === 'back' ? '回寄' : '寄入'}物流详情`)
const openLogisticsTrack = async (row, segment) => { logisticsTrack.value = { orderId: row.order_id, orderNo: row.order_no, segment, company: segment === 'back' ? row.back_company : row.out_company, tracking_no: segment === 'back' ? row.back_no : row.out_no, cache: {}, available: false, cached: true, message: '' }; trackDrawerVisible.value = true; await loadLogisticsTrack(false) }
const openExceptionTrack = async item => { logisticsTrack.value = { orderId: item.orderId, orderNo: item.orderNo, segment: item.segment, company: item.company, tracking_no: item.trackingNo, cache: {}, available: false, cached: true, message: item.reason || '' }; trackDrawerVisible.value = true; await loadLogisticsTrack(false) }
const loadLogisticsTrack = async (refresh = false) => { if (!logisticsTrack.value.orderId) return; trackLoading.value = true; try { const data = await getLogisticsTrack(getToken(), logisticsTrack.value.orderId, logisticsTrack.value.segment, refresh); logisticsTrack.value = { ...logisticsTrack.value, ...(data || {}) } } catch (error) { logisticsTrack.value = { ...logisticsTrack.value, message: error.message || '加载物流轨迹失败' } } finally { trackLoading.value = false } }

const exportLedger = async () => {
  exporting.value = true
  try {
    const list = []; let pageNo = 1; let totalCount = 0; let truncated = false
    while (pageNo <= 100) { const data = await getLogisticsLedger(getToken(), { keyword: filters.keyword, status: filters.status, ...toApiDateRange(exportDateRange.value), page: pageNo, pageSize: 100, forExport: true }); const rows = data?.list || []; totalCount = data?.total || 0; truncated ||= Boolean(data?.truncated); list.push(...rows); if (rows.length < 100 || list.length >= totalCount) break; pageNo += 1 }
    if (!list.length) { ElMessage.warning('当前条件下没有可导出的物流记录'); return }
    const headers = ['工单号', '状态', '客户', '寄出物流公司', '寄出运单号', '回寄物流公司', '回寄运单号', '创建时间', '更新时间']; const escapeCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`; const lines = [headers.join(','), ...list.map(row => [row.order_no, statusLabel(row.status), row.customer, row.out_company, row.out_no, row.back_company, row.back_no, formatTime(row.create_time), formatTime(row.update_time)].map(escapeCell).join(','))]
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })); const anchor = document.createElement('a'); const date = new Date(); const pad = value => String(value).padStart(2, '0'); anchor.href = url; anchor.download = `物流台账_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.csv`; anchor.click(); URL.revokeObjectURL(url)
    truncated ? ElMessage.warning(`已导出 ${list.length} 条，数据量超过扫描上限，请缩小范围复核`) : ElMessage.success(`已导出 ${list.length} 条物流台账`)
  } catch (error) { ElMessage.error(error.message || '导出失败') } finally { exporting.value = false }
}
const loadWorkflow = async () => { try { workflowConfig.value = await getWorkflowConfig(getToken()) } catch { workflowConfig.value = null } }
const applyRouteIntent = () => { if (route.query.tab === 'import' && canImportLogistics.value) importDialogVisible.value = true; if (route.query.tab === 'exception') selectStatus('exception') }
onMounted(async () => { await loadWorkflow(); applyRouteIntent(); await Promise.all([loadReadiness(), loadOverview(), loadExceptions(), loadLedger()]) })
watch(() => route.query.tab, applyRouteIntent)
</script>

<style scoped>
.logistics-monitor { --lm-blue: #246bfd; --lm-navy: #17233c; --lm-text: #344054; --lm-muted: #7b879d; --lm-line: #e5eaf2; display: flex; flex-direction: column; gap: 16px; color: var(--lm-text); }
.lm-section-label h2, .lm-ledger-head h2, .lm-exception-head h2 { margin: 0; color: var(--lm-navy); letter-spacing: 0; }.lm-ledger-head p { margin: 5px 0 0; color: var(--lm-muted); font-size: 13px; }.lm-overview-meta { display: flex; align-items: center; gap: 12px; }
.lm-service-state { display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 5px 0 12px; border: 1px solid #fed7aa; border-radius: 8px; background: #fffaf3; color: #b45309; font-size: 12px; }.lm-service-state.ready { border-color: #bbf7d0; background: #f2fbf5; color: #15803d; }.lm-service-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 12%, transparent); }
.lm-overview-section, .lm-ledger-section { border: 1px solid var(--lm-line); border-radius: 8px; background: #fff; box-shadow: 0 3px 14px rgba(29, 52, 90, .04); }.lm-overview-section { padding: 18px; }.lm-section-label, .lm-ledger-head, .lm-exception-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }.lm-section-label h2, .lm-ledger-head h2, .lm-exception-head h2 { font-size: 16px; }.lm-section-label > div > span, .lm-updated-at { color: var(--lm-muted); font-size: 12px; }
.lm-overview-layout { display: grid; grid-template-columns: minmax(0, 1fr) 318px; gap: 14px; margin-top: 14px; }.lm-metric-grid { display: grid; grid-template-columns: repeat(5, minmax(116px, 1fr)); gap: 10px; min-height: 120px; }.lm-metric { position: relative; min-width: 0; height: 120px; padding: 17px 14px; overflow: hidden; border: 1px solid var(--lm-line); border-radius: 8px; background: #fff; text-align: left; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }.lm-metric:hover, .lm-metric.active { border-color: currentColor; box-shadow: 0 6px 18px rgba(31, 85, 175, .10); transform: translateY(-1px); }.lm-metric-label { display: block; color: currentColor; font-size: 13px; font-weight: 650; }.lm-metric strong { display: block; margin-top: 9px; color: var(--lm-navy); font: 700 28px/1 "DIN Alternate", "Arial Narrow", Arial, sans-serif; }.lm-metric small { display: block; margin-top: 9px; color: var(--lm-muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.lm-metric-icon { position: absolute; right: 12px; top: 38px; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 8px; background: color-mix(in srgb, currentColor 10%, #fff); font-size: 21px; opacity: .9; }
.lm-metric.is-pending { color: #c56a16; background: #fffcf7; border-color: #f7dfc2; }.lm-metric.is-transit { color: #246bfd; background: #f8fbff; border-color: #d6e4ff; }.lm-metric.is-delivered { color: #15803d; background: #f7fcf8; border-color: #d5eadb; }.lm-metric.is-danger { color: #dc3545; background: #fff9f9; border-color: #f4d3d6; }.lm-metric.is-total { color: #6b7280; background: #fafbfc; }
.lm-exception-queue { min-width: 0; padding: 14px; border: 1px solid #f2d4d7; border-radius: 8px; background: #fffafa; }.lm-exception-queue.clear { border-color: #d8ebdf; background: #f8fcf9; }.lm-exception-head p { margin: 4px 0 0; color: #dc3545; font-size: 12px; }.lm-exception-queue.clear .lm-exception-head p { color: #15803d; }.lm-exception-list { display: flex; flex-direction: column; gap: 7px; margin-top: 12px; }.lm-exception-item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 9px; width: 100%; min-height: 52px; padding: 8px; border: 1px solid #f0e1e2; border-radius: 7px; background: #fff; text-align: left; cursor: pointer; }.lm-exception-item:hover { border-color: #eea8ae; }.lm-exception-type, .lm-danger-badge { padding: 3px 6px; border-radius: 5px; background: #fff0f1; color: #dc3545; font-size: 11px; white-space: nowrap; }.lm-exception-copy { min-width: 0; }.lm-exception-copy strong, .lm-exception-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.lm-exception-copy strong { color: var(--lm-navy); font-size: 11px; }.lm-exception-copy small { margin-top: 3px; color: var(--lm-muted); font-size: 10px; }.lm-exception-hours { color: #a43b45; font-size: 10px; white-space: nowrap; }.lm-exception-empty { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 76px; color: #15803d; }
.lm-ledger-section { overflow: hidden; }.lm-ledger-head { padding: 17px 18px 10px; }.lm-toolbar { display: flex; gap: 8px; flex-wrap: wrap; }.lm-status-tabs { display: flex; gap: 28px; padding: 0 18px; overflow-x: auto; border-bottom: 1px solid var(--lm-line); }.lm-status-tabs button { position: relative; flex: none; height: 44px; padding: 0 3px; border: 0; background: transparent; color: #667085; font: inherit; font-size: 13px; cursor: pointer; }.lm-status-tabs button span { color: #98a2b3; }.lm-status-tabs button.active { color: var(--lm-blue); font-weight: 650; }.lm-status-tabs button.active::after { content: ''; position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; background: currentColor; }.lm-status-tabs button.danger.active { color: #dc3545; }
.lm-filter-bar { position: relative; z-index: 4; display: grid; grid-template-columns: minmax(220px, 1.5fr) minmax(140px, .7fr) minmax(240px, 1fr) auto auto; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--lm-line); background: #fbfcfe; }.lm-filter-bar > * { min-width: 0; }:deep(.lm-date-range.el-date-editor) { width: 100% !important; min-width: 0; }.lm-query-button { min-width: 68px; }.lm-ledger-table, .lm-exception-table-wrap { width: 100%; }.lm-exception-table-wrap { padding-top: 4px; }.lm-order-cell, .lm-shipment-cell, .lm-status-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }.lm-order-number { display: flex; align-items: center; width: 100%; min-width: 0; }.lm-order-number strong { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.lm-order-cell strong { color: #24324a; font-size: 12px; font-weight: 650; }.lm-order-cell small, .lm-shipment-cell small, .lm-status-cell small { color: #8b96a9; font-size: 10px; }.lm-customer { color: #344054; font-weight: 550; }.lm-shipment-cell strong { color: #26364e; font-size: 12px; }.lm-shipment-cell > span { color: #657187; font-family: Consolas, "SFMono-Regular", monospace; font-size: 11px; letter-spacing: 0; word-break: break-all; }.lm-shipment-cell small.is-danger { color: #dc3545; }.lm-shipment-cell .el-button { height: auto; padding: 0; font-size: 11px; }
.lm-status-pill { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 650; }.lm-status-pill.is-pending { background: #fff4e8; color: #b75b08; }.lm-status-pill.is-transit, .lm-status-pill.is-processing { background: #edf4ff; color: #246bfd; }.lm-status-pill.is-delivered { background: #eaf8ef; color: #168347; }.lm-status-pill.is-neutral { background: #f1f3f6; color: #667085; }.lm-overdue-text { color: #dc3545; font-weight: 650; }.lm-row-actions { display: flex; align-items: center; gap: 6px; }.lm-muted { color: #b0b8c5; }.lm-pager { display: flex; justify-content: flex-end; padding: 14px 18px 18px; border-top: 1px solid var(--lm-line); }
.lm-trace-drawer { min-height: 300px; }.lm-trace-summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 15px; border: 1px solid #dbe5f4; border-radius: 8px; background: #f7faff; }.lm-trace-summary span, .lm-trace-summary strong { display: block; }.lm-trace-summary span { color: #68758a; font-size: 12px; }.lm-trace-summary strong { margin-top: 5px; color: var(--lm-navy); font: 650 16px/1.4 Consolas, monospace; word-break: break-all; }.lm-trace-context { margin: 18px 0; }.lm-trace-context > div { display: grid; grid-template-columns: 80px 1fr; padding: 9px 0; border-bottom: 1px solid var(--lm-line); }.lm-trace-context dt { color: #8b96a9; font-size: 12px; }.lm-trace-context dd { margin: 0; color: #344054; font-size: 12px; text-align: right; word-break: break-all; }.lm-trace-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 16px 0; color: #8b96a9; font-size: 12px; }.lm-trace-alert { margin-bottom: 16px; }.lm-trace-timeline { margin: 22px 0 0 4px; }.lm-trace-timeline p { margin: 4px 0; color: #344054; line-height: 1.55; }.lm-trace-timeline small { color: #8b96a9; }
:deep(.lm-ledger-table .el-table__header th), :deep(.lm-exception-table-wrap .el-table__header th) { height: 42px; background: #f8fafc; color: #596579; font-size: 11px; font-weight: 650; }.lm-ledger-table :deep(.el-table__row td), .lm-exception-table-wrap :deep(.el-table__row td) { padding: 10px 0; }.lm-ledger-table :deep(.el-table__row:hover > td), .lm-exception-table-wrap :deep(.el-table__row:hover > td) { background: #f8fbff !important; }
@media (max-width: 1320px) { .lm-overview-layout { grid-template-columns: 1fr; }.lm-exception-list { display: grid; grid-template-columns: repeat(3, 1fr); }.lm-exception-item { grid-template-columns: auto minmax(0, 1fr) auto; }.lm-exception-hours { display: none; } }
@media (max-width: 960px) { .lm-metric-grid { grid-template-columns: repeat(3, minmax(130px, 1fr)); }.lm-filter-bar { grid-template-columns: 1fr 1fr; }.lm-search, .lm-date-range { grid-column: span 2; }.lm-exception-list { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .logistics-monitor { gap: 12px; }.lm-section-label { align-items: flex-start; }.lm-overview-meta { align-items: flex-end; flex-direction: column-reverse; gap: 7px; }.lm-service-state { align-self: flex-start; }.lm-overview-section { padding: 13px; }.lm-overview-layout { margin-top: 11px; }.lm-metric-grid { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 3px; }.lm-metric { flex: 0 0 145px; scroll-snap-align: start; }.lm-ledger-head { align-items: flex-start; flex-direction: column; }.lm-toolbar { width: 100%; }.lm-status-tabs { gap: 20px; }.lm-filter-bar { display: flex; flex-direction: column; }.lm-search, .lm-status-select, .lm-date-range { width: 100% !important; }.lm-pager { justify-content: center; overflow-x: auto; }.lm-trace-toolbar { align-items: flex-start; flex-direction: column; } }
@media (prefers-reduced-motion: reduce) { .lm-metric { transition: none; }.lm-metric:hover { transform: none; } }
</style>
