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

    <CorporateAccountDetails class="settlement-account" :account="corporateAccount" />

    <div class="settlement-toolbar">
      <el-input v-model="filters.keyword" clearable placeholder="搜索工单号 / 客户 / 手机号" style="width: 260px;" @keyup.enter="loadSettlements"></el-input>
      <el-select v-model="filters.paymentStatus" placeholder="付款状态" style="width: 150px;">
        <el-option label="全部" value=""></el-option>
        <el-option label="待付款" value="pending"></el-option>
        <el-option label="待核销" value="uploaded"></el-option>
        <el-option label="已付款" value="paid"></el-option>
        <el-option label="已退款" value="refunded"></el-option>
      </el-select>
      <el-select v-model="filters.paymentMethod" placeholder="付款方式" style="width: 150px;">
        <el-option label="全部方式" value=""></el-option>
        <el-option label="微信支付" value="wechat_pay"></el-option>
        <el-option label="对公支付" value="corporate"></el-option>
      </el-select>
      <el-button type="primary" plain @click="loadSettlements">查询</el-button>
      <el-tooltip content="对账/开票数据已统一到「财务中心 · 四流台账导出」" placement="top">
        <span class="settlement-export-hint">导出 → 四流台账</span>
      </el-tooltip>
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
        <template #default="{ row }">{{ getPaymentMethodLabel(row.payment_method) }}</template>
      </el-table-column>
      <el-table-column label="凭证数" width="90" align="center">
        <template #default="{ row }">{{ (row.payment_proofs || []).length }}</template>
      </el-table-column>
      <el-table-column label="付款状态" width="120">
        <template #default="{ row }">
          <el-tag :type="paymentTag(row.payment_status)" effect="plain">{{ paymentText(row.payment_status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="付款时间" width="150">
        <template #default="{ row }">{{ row.payment_paid_time ? formatTime(row.payment_paid_time) : '-' }}</template>
      </el-table-column>
      <el-table-column label="微信支付单号" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.wechat_transaction_id || '-' }}</template>
      </el-table-column>
      <el-table-column label="运单号(寄出/回寄)" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">{{ [row.logistics_no_out, row.logistics_no_back].filter(Boolean).join(' / ') || '-' }}</template>
      </el-table-column>
      <el-table-column label="库存出库" width="110">
        <template #default="{ row }">
          <el-tag :type="row.inventory_deducted ? 'success' : 'info'" effect="plain">{{ row.inventory_deducted ? '已出库' : '未出库' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发票状态" width="120">
        <template #default="{ row }">{{ row.invoice_info?.status || (row.invoice_info?.need_invoice ? '待开票' : '无需开票') }}</template>
      </el-table-column>
      <el-table-column label="发票号码" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.invoice_info?.invoice_no || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="280" align="right" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canConfirmCorporatePayment(row)"
            type="success"
            link
            :loading="confirmingOrderId === row._id"
            @click="confirmCorporatePayment(row)"
          >
            确认收款
          </el-button>
          <el-button type="primary" link @click="openDetail(row)">查看详情</el-button>
          <el-button type="primary" link @click="goWorkOrder(row)">去工单处理</el-button>
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

    <!-- 结算详情抽屉：报价明细 / 付款凭证 / 退款记录 / 开票信息 / 物流信息 -->
    <el-drawer v-model="detailVisible" :size="540" class="settlement-drawer" destroy-on-close>
      <template #header>
        <div class="sd-head">
          <div class="sd-head-title">
            <strong>{{ detail.order_no || '-' }}</strong>
            <el-tag size="small" :type="paymentTag(detail.payment_status)" effect="plain">{{ paymentText(detail.payment_status) }}</el-tag>
          </div>
          <div class="sd-head-sub">{{ detail.customer_name || '未填写客户' }} · {{ detail.contact_phone || '-' }}</div>
        </div>
      </template>

      <div class="sd-body">
        <!-- 报价明细 -->
        <section class="sd-section">
          <h3 class="sd-section-title">报价明细</h3>
          <div class="sd-summary">
            <div><span>最终报价</span><strong class="sd-total">¥{{ fmtMoney(detail.total_price) }}</strong></div>
            <div><span>配件费</span><strong>¥{{ fmtMoney(detail.parts_fee) }}</strong></div>
            <div><span>工时费</span><strong>¥{{ fmtMoney(detail.labor_fee) }}</strong></div>
            <div><span>其他费</span><strong>¥{{ fmtMoney(detail.other_fee) }}</strong></div>
          </div>
          <div v-if="quoteBreakdown.length" class="sd-table-wrap">
            <el-table :data="quoteBreakdown" size="small" border>
              <el-table-column prop="typeLabel" label="类型" width="64" />
              <el-table-column prop="name" label="项目" min-width="120" show-overflow-tooltip />
              <el-table-column prop="quantity" label="数量" width="60" align="center" />
              <el-table-column label="单价" width="96" align="right">
                <template #default="{ row }">¥{{ Number(row.unit_price || 0).toFixed(2) }}</template>
              </el-table-column>
              <el-table-column label="金额" width="104" align="right">
                <template #default="{ row }">¥{{ Number(row.amount || 0).toFixed(2) }}</template>
              </el-table-column>
            </el-table>
          </div>
          <p v-if="detail.quote_remark" class="sd-remark">备注：{{ detail.quote_remark }}</p>
        </section>

        <!-- 付款信息 -->
        <section class="sd-section">
          <h3 class="sd-section-title">付款信息</h3>
          <dl class="sd-grid">
            <div><dt>付款方式</dt><dd>{{ getPaymentMethodLabel(detail.payment_method) }}</dd></div>
            <div><dt>付款时间</dt><dd>{{ detail.payment_paid_time ? formatTime(detail.payment_paid_time) : '-' }}</dd></div>
            <div><dt>微信支付单号</dt><dd class="sd-mono">{{ detail.wechat_transaction_id || '-' }}</dd></div>
            <div><dt>付款期限</dt><dd>{{ detail.payment_deadline ? formatTime(detail.payment_deadline) : '-' }}</dd></div>
          </dl>
          <div v-if="proofUrls.length" class="sd-proofs">
            <div class="sd-proofs-title">付款凭证（{{ proofUrls.length }}）</div>
            <div class="sd-proofs-list">
              <el-image
                v-for="(url, index) in proofUrls"
                :key="index"
                :src="url"
                :preview-src-list="proofUrls"
                :initial-index="index"
                fit="cover"
                class="sd-proof"
                preview-teleported
              />
            </div>
          </div>
          <p v-else class="sd-muted">暂无付款凭证</p>
        </section>

        <!-- 退款记录 -->
        <section v-if="hasRefund" class="sd-section">
          <h3 class="sd-section-title">退款记录</h3>
          <dl class="sd-grid">
            <div><dt>退款状态</dt><dd><el-tag :type="refundTag" size="small" effect="plain">{{ refundStatusText }}</el-tag></dd></div>
            <div><dt>退款金额</dt><dd class="sd-total">¥{{ fmtMoney(detail.refund_amount) }}</dd></div>
            <div><dt>退款原因</dt><dd>{{ detail.refund_reason || '-' }}</dd></div>
            <div><dt>退款时间</dt><dd>{{ detail.refund_time ? formatTime(detail.refund_time) : '-' }}</dd></div>
            <div><dt>退款单号</dt><dd class="sd-mono">{{ detail.refund_out_no || detail.wechat_refund_id || '-' }}</dd></div>
            <div v-if="detail.refund_failure_reason"><dt>失败原因</dt><dd class="sd-danger">{{ detail.refund_failure_reason }}</dd></div>
          </dl>
        </section>

        <!-- 开票信息 -->
        <section class="sd-section">
          <h3 class="sd-section-title">开票信息</h3>
          <dl class="sd-grid">
            <div><dt>开票状态</dt><dd>{{ invoiceStatusText }}</dd></div>
            <div><dt>发票抬头</dt><dd>{{ invoice.title || '-' }}</dd></div>
            <div><dt>税号</dt><dd>{{ invoice.tax_no || '-' }}</dd></div>
            <div><dt>发票号码</dt><dd>{{ invoice.invoice_no || '-' }}</dd></div>
            <div><dt>开票日期</dt><dd>{{ invoice.invoice_date || '-' }}</dd></div>
            <div><dt>邮寄信息</dt><dd>{{ [invoice.mail_company, invoice.mail_no].filter(Boolean).join(' / ') || '-' }}</dd></div>
          </dl>
          <a v-if="invoicePdfUrl" :href="invoicePdfUrl" target="_blank" rel="noopener" class="sd-pdf-link">
            <el-icon><Document /></el-icon>查看发票原件
          </a>
        </section>

        <!-- 物流信息 -->
        <section class="sd-section">
          <h3 class="sd-section-title">物流信息</h3>
          <dl class="sd-grid">
            <div><dt>寄出</dt><dd>{{ [detail.logistics_company_out, detail.logistics_no_out].filter(Boolean).join(' / ') || '-' }}</dd></div>
            <div><dt>回寄</dt><dd>{{ [detail.logistics_company_back, detail.logistics_no_back].filter(Boolean).join(' / ') || '-' }}</dd></div>
          </dl>
        </section>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="goWorkOrder(detail)">去工单处理</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSettlementList } from '../api/settlement.js'
import { updatePaymentStatus } from '../api/order.js'
import { getSettings } from '../api/admin.js'
import CorporateAccountDetails from '../components/CorporateAccountDetails.vue'
import { Document } from '@element-plus/icons-vue'
import { getPaymentMethodLabel, resolveCorporateAccount } from '../config/corporateAccount.js'

const router = useRouter()
const rows = ref([])
const loading = ref(false)
const confirmingOrderId = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', paymentStatus: '', paymentMethod: '' })
const corporateAccount = ref(resolveCorporateAccount())
const getToken = () => localStorage.getItem('adminToken')

const paymentText = (status = 'pending') => ({ pending: '待付款', uploaded: '待核销', paid: '已付款', refunded: '已退款' }[status] || '待付款')
const paymentTag = (status = 'pending') => ({ pending: 'warning', uploaded: 'primary', paid: 'success', refunded: 'info' }[status] || 'warning')

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(Number(ts))
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 对账导出已统一到「财务中心 · 四流台账导出」（FinanceCenter.vue），此处不再单独导出

const loadSettlements = async () => {
  loading.value = true
  try {
    const data = await getSettlementList(getToken(), {
      keyword: filters.keyword,
      paymentStatus: filters.paymentStatus,
      paymentMethod: filters.paymentMethod,
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

const canConfirmCorporatePayment = (row = {}) => {
  return ['pending', 'uploaded', 'rejected'].includes(row.payment_status || 'pending')
    && row.payment_method !== 'wechat_pay'
}

const confirmCorporatePayment = async (row) => {
  const proofTip = (row.payment_proofs || []).length
    ? '请确认已核对客户凭证与银行对公流水。'
    : '该工单没有付款凭证，请确认已直接核对银行对公流水。'
  try {
    await ElMessageBox.confirm(
      `${proofTip}确认后将标记为“对公支付 · 已付款”，已签收或检测中的工单会直接进入“处理中”。`,
      '确认收款',
      {
        confirmButtonText: '确认已到账',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '确认收款已取消')
    return
  }

  confirmingOrderId.value = row._id
  try {
    const result = await updatePaymentStatus(getToken(), row._id, 'paid', { paymentMethod: 'offline_transfer' })
    Object.assign(row, {
      payment_status: result.payment_status || 'paid',
      payment_method: result.payment_method || 'offline_transfer',
      payment_paid_time: result.payment_paid_time || Date.now(),
      status: result.status || row.status
    })
    const successText = result.status === 'fixing' ? '收款已确认，工单已进入处理中' : '收款已确认'
    if (result.inventoryResult?.warning) {
      ElMessage.warning(`${successText}；${result.inventoryResult.reason || '配件未自动出库，请到库存管理核对'}`)
    } else {
      ElMessage.success(successText)
    }
  } catch (error) {
    if (!error.__displayed) ElMessage.error(error.message || '确认收款失败')
  } finally {
    confirmingOrderId.value = ''
  }
}

// ===== 结算详情抽屉 =====
const detailVisible = ref(false)
const detail = ref({})
const openDetail = (row) => {
  detail.value = row || {}
  detailVisible.value = true
}

const proofUrls = computed(() => (detail.value.payment_proofs || [])
  .map(proof => proof.url || proof.fileUrl || proof.previewUrl || '')
  .filter(Boolean))

const quoteBreakdown = computed(() => {
  const qd = detail.value.quote_detail
  if (!qd) return []
  const rows = []
  ;(qd.parts || []).forEach(item => rows.push({ typeLabel: '配件', name: item.name || item.part_name || '-', quantity: item.quantity, unit_price: item.unit_price, amount: item.amount }))
  ;(qd.services || []).forEach(item => rows.push({ typeLabel: '工时', name: item.name || '-', quantity: item.quantity, unit_price: item.unit_price, amount: item.amount }))
  ;(qd.others || []).forEach(item => rows.push({ typeLabel: '其他', name: item.name || '-', quantity: item.quantity, unit_price: item.unit_price, amount: item.amount }))
  return rows
})

const hasRefund = computed(() => {
  const d = detail.value
  return Boolean(d.refund_status) || Number(d.refund_amount || 0) > 0
})
const refundStatusText = computed(() => ({ processing: '退款处理中', refunded: '已退款', failed: '退款失败' }[detail.value.refund_status] || detail.value.refund_status || '-'))
const refundTag = computed(() => ({ processing: 'warning', refunded: 'success', failed: 'danger' }[detail.value.refund_status] || 'info'))

const invoice = computed(() => detail.value.invoice_info || {})
const invoiceStatusText = computed(() => invoice.value.status || (invoice.value.need_invoice ? '待开票' : '无需开票'))
const invoicePdfUrl = computed(() => invoice.value.invoice_url || invoice.value.pdf_url || invoice.value.file_url || '')

const fmtMoney = (value) => Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const loadCorporateAccount = async () => {
  try {
    corporateAccount.value = resolveCorporateAccount(await getSettings(getToken()))
  } catch (error) {
    corporateAccount.value = resolveCorporateAccount()
  }
}

watch([page, pageSize], loadSettlements)
onMounted(() => {
  loadCorporateAccount()
  loadSettlements()
})
</script>

<style scoped>
.settlement-page { min-height: 520px; }
.settlement-account { margin-top: 16px; }
.settlement-toolbar { display: flex; align-items: center; gap: 10px; margin: 16px 0 18px; flex-wrap: wrap; }
.settlement-export-hint { font-size: 12px; color: #909399; cursor: help; padding: 0 4px; }
.pager { margin-top: 16px; justify-content: flex-end; }

/* 结算详情抽屉 */
.sd-head-title { display: flex; align-items: center; gap: 8px; }
.sd-head-title strong { font-size: 16px; color: #1f2d3d; }
.sd-head-sub { margin-top: 4px; font-size: 13px; color: #86909c; }
.sd-body { display: flex; flex-direction: column; gap: 16px; }
.sd-section { padding: 14px 16px; border: 1px solid #edf1f7; border-radius: 10px; background: #fafbfc; }
.sd-section-title { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #1f2d3d; }
.sd-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
.sd-summary div { display: flex; flex-direction: column; gap: 4px; padding: 10px; border-radius: 8px; background: #fff; border: 1px solid #edf1f7; }
.sd-summary span { font-size: 12px; color: #86909c; }
.sd-summary strong { font-size: 16px; color: #1f2d3d; }
.sd-summary .sd-total { color: #16a34a; }
.sd-table-wrap { overflow: hidden; border-radius: 8px; }
.sd-remark { margin: 10px 0 0; font-size: 12px; color: #6b7785; line-height: 1.6; }
.sd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin: 0; }
.sd-grid div { min-width: 0; }
.sd-grid dt { margin-bottom: 3px; color: #86909c; font-size: 12px; }
.sd-grid dd { margin: 0; color: #1d2129; font-size: 13px; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
.sd-mono { font-family: Consolas, "Courier New", monospace; }
.sd-total { color: #16a34a; }
.sd-danger { color: #dc2626; }
.sd-muted { margin: 0; font-size: 12px; color: #c0c4cc; }
.sd-proofs-title { margin-bottom: 8px; font-size: 12px; color: #6b7785; }
.sd-proofs-list { display: flex; flex-wrap: wrap; gap: 8px; }
.sd-proof { width: 76px; height: 76px; border-radius: 8px; border: 1px solid #e5eaf1; cursor: zoom-in; }
.sd-pdf-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 13px; color: #1677ff; text-decoration: none; }
.sd-pdf-link:hover { text-decoration: underline; }
@media (max-width: 520px) {
  .sd-summary { grid-template-columns: repeat(2, 1fr); }
  .sd-grid { grid-template-columns: 1fr; }
}
</style>
