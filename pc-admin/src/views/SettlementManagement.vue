<template>
  <div class="glass-card settlement-page">
    <div class="section-title">
      <div>
        <span>结算管理</span>
        <p class="section-desc">复用工单报价与付款凭证，集中处理待付款、待核销和发票状态。</p>
      </div>
      <div class="title-actions">
        <el-tag type="info" effect="plain">复用工单报价与付款核销数据</el-tag>
      </div>
    </div>

    <div class="settlement-toolbar">
      <el-input v-model="filters.keyword" clearable placeholder="搜索工单号 / 客户 / 手机号" style="width: 260px;" @keyup.enter="loadSettlements"></el-input>
      <el-select v-model="filters.paymentStatus" placeholder="付款状态" style="width: 150px;">
        <el-option label="全部" value=""></el-option>
        <el-option label="待付款" value="pending"></el-option>
        <el-option label="待核销" value="uploaded"></el-option>
        <el-option label="已付款" value="paid"></el-option>
      </el-select>
      <el-button type="primary" plain @click="loadSettlements">查询</el-button>
    </div>

    <div class="table-responsive">
    <el-table :data="rows" class="modern-table" style="width:100%;" v-loading="loading">
      <template #empty>
        <div class="table-empty-guide">
          <strong>暂无结算记录</strong>
          <span>工单发布报价并产生付款状态后，会自动出现在这里；也可以先去工单页处理报价。</span>
        </div>
      </template>
      <el-table-column prop="order_no" label="工单号" width="150" show-overflow-tooltip></el-table-column>
      <el-table-column prop="customer_name" label="客户" min-width="150" show-overflow-tooltip>
        <template #default="{ row }"><span class="cell-primary">{{ row.customer_name || '-' }}</span></template>
      </el-table-column>
      <el-table-column prop="contact_phone" label="联系电话" width="140"></el-table-column>
      <el-table-column label="最终报价" width="120">
        <template #default="{ row }">¥{{ Number(row.total_price || 0).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="付款方式" width="120">
        <template #default="{ row }">{{ (row.payment_proofs || []).length ? '对公凭证' : '微信/待付款' }}</template>
      </el-table-column>
      <el-table-column label="凭证数" width="90" align="center">
        <template #default="{ row }">{{ (row.payment_proofs || []).length }}</template>
      </el-table-column>
      <el-table-column label="付款状态" width="120">
        <template #default="{ row }">
          <el-tag :type="paymentTag(row.payment_status)" effect="plain">{{ paymentText(row.payment_status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="库存出库" width="110">
        <template #default="{ row }">
          <el-tag :type="row.inventory_deducted ? 'success' : 'info'" effect="plain">{{ row.inventory_deducted ? '已出库' : '未出库' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发票状态" width="120">
        <template #default="{ row }">{{ row.invoice_info?.status || (row.invoice_info?.need_invoice ? '待开票' : '无需开票') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="right" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="goWorkOrder(row)">查看工单</el-button>
          <span class="risk-actions">
            <el-button type="success" link :disabled="row.payment_status === 'paid'" @click="confirmPaid(row)">核销</el-button>
          </span>
        </template>
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
  </div>
</template>

<script setup>
import { reactive, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSettlementList } from '../api/settlement.js'
import { updatePaymentStatus } from '../api/order.js'

const router = useRouter()
const rows = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', paymentStatus: '' })
const getToken = () => localStorage.getItem('adminToken')

const paymentText = (status = 'pending') => ({ pending: '待付款', uploaded: '待核销', paid: '已付款' }[status] || '待付款')
const paymentTag = (status = 'pending') => ({ pending: 'warning', uploaded: 'primary', paid: 'success' }[status] || 'warning')

const loadSettlements = async () => {
  loading.value = true
  try {
    const data = await getSettlementList(getToken(), {
      keyword: filters.keyword,
      paymentStatus: filters.paymentStatus,
      page: page.value,
      pageSize: pageSize.value
    })
    rows.value = data.list || []
    total.value = Number(data.total || 0)
  } catch (error) {
    ElMessage.error(error.message || '结算列表加载失败')
  } finally {
    loading.value = false
  }
}

const goWorkOrder = (row) => {
  router.push({ path: '/workorder', query: { keyword: row.order_no } })
}

const confirmPaid = async (row) => {
  try {
    await ElMessageBox.confirm('核销后将标记为已付款；若报价配件已绑定库存，会同步生成出库流水。确定继续吗？', '付款核销确认', {
      confirmButtonText: '确认核销',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await updatePaymentStatus(getToken(), row._id, 'paid')
    ElMessage.success('付款已核销')
    await loadSettlements()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '核销失败')
    }
  }
}

watch([page, pageSize], loadSettlements)
onMounted(loadSettlements)
</script>

<style scoped>
.settlement-page { min-height: 520px; }
.settlement-toolbar { display: flex; align-items: center; gap: 10px; margin: 16px 0 18px; flex-wrap: wrap; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
