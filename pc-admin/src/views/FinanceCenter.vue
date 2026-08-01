<template>
  <div class="finance-center">
    <!-- 统一四流台账导出（订单+物流+支付+发票），取代对账/发票各自导出 -->
    <el-card shadow="never" class="fc-export-card">
      <div class="fc-export-bar">
        <div class="fc-export-title">
          <el-icon><Files /></el-icon>
          <span>四流台账导出</span>
          <el-tooltip content="订单 / 物流 / 支付 / 发票 合一，一次导出全部对账与开票数据" placement="top">
            <el-icon class="fc-help"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
        <div class="fc-export-actions">
          <el-input v-model="exp.keyword" placeholder="工单号 / 客户 / 运单号 / 发票号" clearable size="small" style="width: 230px" />
          <el-select v-model="exp.status" placeholder="全部状态" clearable size="small" style="width: 120px">
            <el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-checkbox v-model="exp.billableOnly" size="small">仅含有金额工单</el-checkbox>
          <el-button type="primary" size="small" :loading="exporting" @click="doExport"><el-icon><Download /></el-icon>导出四流台账</el-button>
        </div>
      </div>
    </el-card>

    <el-tabs v-model="activeTab" class="fc-tabs">
      <el-tab-pane label="对账流水" name="settlement">
        <SettlementManagement />
      </el-tab-pane>
      <el-tab-pane label="开票管理" name="invoice" lazy>
        <InvoiceManagement />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import SettlementManagement from './SettlementManagement.vue'
import InvoiceManagement from './InvoiceManagement.vue'
import { getFourFlowLedger } from '../api/order.js'
import { exportFourFlowLedger } from '../utils/fourFlowExport.js'

// 支持 /finance?tab=invoice 直达开票 Tab
const route = useRoute()
const activeTab = ref(route.query.tab === 'invoice' ? 'invoice' : 'settlement')

const getToken = () => localStorage.getItem('adminToken')
const STATUS_OPTIONS = [
  { value: 'pending', label: '已提交' }, { value: 'sent', label: '运输中' }, { value: 'received', label: '已签收' },
  { value: 'inspecting', label: '检测中' }, { value: 'fixing', label: '处理中' }, { value: 'shipped', label: '已回寄' },
  { value: 'completed', label: '已完成' }
]
const exp = reactive({ keyword: '', status: '', billableOnly: false })
const exporting = ref(false)

const doExport = async () => {
  exporting.value = true
  try {
    const PAGE_SIZE = 100, MAX_PAGES = 100
    const all = []
    let pageNo = 1, totalCount = 0, truncated = false
    while (pageNo <= MAX_PAGES) {
      const data = await getFourFlowLedger(getToken(), { keyword: exp.keyword, status: exp.status, billableOnly: exp.billableOnly, page: pageNo, pageSize: PAGE_SIZE })
      const list = (data && data.list) || []
      totalCount = (data && data.total) || 0
      truncated = truncated || Boolean(data && data.truncated)
      all.push(...list)
      if (list.length < PAGE_SIZE || all.length >= totalCount) break
      pageNo += 1
    }
    if (!all.length) { ElMessage.warning('当前条件下没有可导出的台账数据'); return }
    await exportFourFlowLedger(all)
    if (truncated) ElMessage.warning(`已导出 ${all.length} 条，但数据量超过后台扫描上限，可能不完整，请缩小筛选范围`)
    else ElMessage.success(`已导出 ${all.length} 条四流台账`)
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.finance-center { width: 100%; }
.fc-export-card { border-radius: 12px; margin-bottom: 14px; }
.fc-export-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.fc-export-title { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; color: #1f2d3d; }
.fc-help { color: #909399; cursor: help; }
.fc-export-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fc-tabs :deep(.el-tabs__item) { font-size: 15px; font-weight: 600; }
</style>
