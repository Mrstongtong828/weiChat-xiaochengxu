<template>
  <div class="invoice-mgmt">
    <el-card shadow="never" class="im-card">
      <div class="im-head">
        <div class="im-title"><el-icon><Tickets /></el-icon><span>开票管理</span></div>
        <div class="im-actions">
          <el-input v-model="filters.keyword" placeholder="工单号 / 客户 / 抬头 / 发票号" clearable size="small" style="width: 220px" @keyup.enter="reload" @clear="reload" />
          <el-select v-model="filters.status" placeholder="全部状态" clearable size="small" style="width: 120px" @change="reload">
            <el-option v-for="s in STATUS_OPTIONS" :key="s" :label="invoiceStatusLabel(s)" :value="s" />
          </el-select>
          <el-button type="primary" size="small" @click="reload">查询</el-button>
          <el-button size="small" @click="downloadTemplate"><el-icon><Download /></el-icon>导入模板</el-button>
          <el-button size="small" @click="importDialog = true"><el-icon><Upload /></el-icon>批量导入</el-button>
          <el-tooltip content="开票数据已统一到「财务中心 · 四流台账导出」" placement="top">
            <span class="im-export-hint">导出 → 四流台账</span>
          </el-tooltip>
        </div>
      </div>

      <el-table :data="rows" v-loading="loading" size="small" empty-text="暂无开票申请" stripe>
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="invoice-detail-panel">
              <div class="invoice-detail-block">
                <h4>开票资料</h4>
                <p><span>发票类型</span><strong>{{ row.invoice_type || '电子普通发票' }}</strong></p>
                <p><span>抬头</span><strong>{{ row.title || '待填写' }}</strong></p>
                <p><span>税号</span><strong>{{ row.tax_no || '待填写' }}</strong></p>
                <p><span>邮箱</span><strong>{{ row.email || '待填写' }}</strong></p>
              </div>
              <div v-if="isPaperSpecial(row)" class="invoice-detail-block">
                <h4>纸质专票信息</h4>
                <p><span>注册地址</span><strong>{{ row.register_address || '待填写' }}</strong></p>
                <p><span>注册电话</span><strong>{{ row.register_phone || '待填写' }}</strong></p>
                <p><span>开户行</span><strong>{{ row.bank_name || '待填写' }}</strong></p>
                <p><span>银行账号</span><strong>{{ row.bank_account || '待填写' }}</strong></p>
                <p><span>收票人</span><strong>{{ row.recipient_name || '待填写' }}</strong></p>
                <p><span>收票手机</span><strong>{{ row.recipient_phone || '待填写' }}</strong></p>
                <p><span>收票地址</span><strong>{{ row.recipient_address || '待填写' }}</strong></p>
              </div>
              <div class="invoice-detail-block">
                <h4>开具与寄送</h4>
                <p><span>发票号码</span><strong>{{ row.invoice_no || '待同步' }}</strong></p>
                <p><span>开票日期</span><strong>{{ row.invoice_date || '待同步' }}</strong></p>
                <p><span>PDF/链接</span><strong>{{ row.invoice_url || row.pdf_url || '待同步' }}</strong></p>
                <p v-if="isPaperSpecial(row)"><span>专票物流</span><strong>{{ row.mail_no ? `${row.mail_company || '物流'} ${row.mail_no}` : '待寄出' }}</strong></p>
                <p v-if="isPaperSpecial(row)"><span>寄出日期</span><strong>{{ row.mail_time || '待同步' }}</strong></p>
                <p v-if="isPaperSpecial(row)"><span>签收日期</span><strong>{{ row.received_time || '待签收' }}</strong></p>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="order_no" label="工单号" min-width="140" />
        <el-table-column prop="customer" label="客户" min-width="120" show-overflow-tooltip />
        <el-table-column label="金额" width="100">
          <template #default="{ row }">¥{{ Number(row.total_price || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="开票状态" width="100">
          <template #default="{ row }"><el-tag size="small" :type="statusTag(row.status)">{{ invoiceStatusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="发票类型" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="isPaperSpecial(row) ? 'warning' : 'info'">{{ row.invoice_type || '电子普通发票' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="抬头" min-width="160" show-overflow-tooltip />
        <el-table-column prop="tax_no" label="税号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="invoice_no" label="发票号码" min-width="160" show-overflow-tooltip />
        <el-table-column prop="invoice_date" label="开票日期" width="120" />
        <el-table-column label="发票PDF" width="80">
          <template #default="{ row }">
            <el-link v-if="row.invoice_url" type="primary" :href="row.invoice_url" target="_blank">查看</el-link>
            <span v-else class="im-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="专票邮寄" min-width="150">
          <template #default="{ row }">
            <span v-if="isPaperSpecial(row) && row.mail_no">{{ row.mail_company || '物流' }} · {{ row.mail_no }}</span>
            <span v-else-if="isPaperSpecial(row)" class="im-muted">待寄出</span>
            <span v-else class="im-muted">电子票无需邮寄</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openIssue(row)">登记开票</el-button>
            <el-button v-if="isPaperSpecial(row)" link type="primary" size="small" @click="openMail(row)">专票邮寄</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="im-pager">
        <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="page" :page-size="pageSize" @current-change="onPageChange" />
      </div>
    </el-card>

    <!-- 登记开票（含发票PDF上传） -->
    <el-dialog v-model="issueDialog" title="登记开票" width="480px">
      <el-form :model="issueForm" label-width="92px">
        <el-form-item label="工单号"><el-input v-model="issueForm.order_no" disabled /></el-form-item>
        <el-form-item label="开票状态">
          <el-select v-model="issueForm.status" style="width: 100%">
            <el-option v-for="s in STATUS_OPTIONS" :key="s" :label="invoiceStatusLabel(s)" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="发票号码"><el-input v-model="issueForm.invoice_no" placeholder="电子/纸质发票号码" /></el-form-item>
        <el-form-item label="开票日期"><el-date-picker v-model="issueForm.invoice_date" type="date" value-format="YYYY-MM-DD" placeholder="选择开票日期" style="width: 100%" /></el-form-item>
        <el-form-item label="发票PDF">
          <div class="im-pdf-row">
            <el-input v-model="issueForm.invoice_url" placeholder="可填链接，或点右侧上传 PDF" />
            <el-upload :show-file-list="false" :auto-upload="false" accept=".pdf" :on-change="onPickPdf">
              <el-button :loading="uploadingPdf" size="small"><el-icon><Upload /></el-icon>上传PDF</el-button>
            </el-upload>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="issueDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveIssue">保存</el-button>
      </template>
    </el-dialog>

    <!-- 专票邮寄录入 -->
    <el-dialog v-model="mailDialog" title="专票邮寄录入" width="440px">
      <el-form :model="mailForm" label-width="92px">
        <el-form-item label="工单号"><el-input v-model="mailForm.order_no" disabled /></el-form-item>
        <el-form-item label="快递公司"><el-input v-model="mailForm.mail_company" placeholder="如 顺丰速运" /></el-form-item>
        <el-form-item label="邮寄单号"><el-input v-model="mailForm.mail_no" placeholder="纸质专票快递单号" /></el-form-item>
        <el-form-item label="邮寄日期"><el-date-picker v-model="mailForm.mail_time" type="date" value-format="YYYY-MM-DD" placeholder="选择邮寄日期" style="width: 100%" /></el-form-item>
        <el-form-item label="邮寄状态">
          <el-select v-model="mailForm.status" style="width: 100%">
            <el-option label="已寄出" value="已寄出" />
            <el-option label="已签收" value="已签收" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="mailForm.status === '已签收'" label="签收日期"><el-date-picker v-model="mailForm.received_time" type="date" value-format="YYYY-MM-DD" placeholder="选择签收日期" style="width: 100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mailDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveMail">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入 -->
    <el-dialog v-model="importDialog" title="批量导入开票结果" width="460px">
      <el-upload drag :show-file-list="false" :auto-upload="false" accept=".xlsx,.xls" :on-change="onPickImport">
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽 Excel 到此处，或<em>点击选择</em></div>
        <template #tip><div class="el-upload__tip">请使用「导入模板」格式，按工单号回填发票号/日期/链接</div></template>
      </el-upload>
      <p v-if="importRows.length" class="im-import-tip">已解析 <strong>{{ importRows.length }}</strong> 条，确认后写入。</p>
      <div v-if="importSummary" class="im-import-summary">
        成功 <strong class="ok">{{ importSummary.success }}</strong> · 失败 <strong class="fail">{{ importSummary.fail }}</strong>
        <ul v-if="importSummary.errors && importSummary.errors.length" class="im-err-list">
          <li v-for="(e, i) in importSummary.errors.slice(0, 8)" :key="i">{{ e.orderNo }}：{{ e.reason }}</li>
        </ul>
      </div>
      <template #footer>
        <el-button @click="closeImport">关闭</el-button>
        <el-button type="primary" :loading="importing" :disabled="!importRows.length" @click="doImport">导入 {{ importRows.length || '' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getInvoiceApplications, batchImportInvoices, updateInvoiceStatus } from '../api/order.js'
import { uploadFileToCloud } from '../utils/upload.js'
import { downloadInvoiceTemplate, parseInvoiceExcelFile } from '../utils/invoiceExcel.js'

const getToken = () => localStorage.getItem('adminToken')
const STATUS_OPTIONS = ['待开票', '开具中', '已开具', '已寄出', '已签收', '无需开票']
const INVOICE_STATUS_LABELS = {
  待开票: '资料审核中',
  开具中: '开票中',
  已开具: '已开票',
  已寄出: '已寄出',
  已签收: '已签收',
  无需开票: '不可开票'
}
const invoiceStatusLabel = (s) => INVOICE_STATUS_LABELS[s] || s || '待同步'
const statusTag = (s) => ({ '待开票': 'warning', '开具中': 'primary', '已开具': 'success', '已寄出': 'primary', '已签收': 'success', '无需开票': 'info' }[s] || 'info')

const rows = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '' })
const saving = ref(false)
const isPaperSpecial = (row = {}) => row.invoice_type === '纸质专用发票'

const load = async () => {
  loading.value = true
  try {
    const data = await getInvoiceApplications(getToken(), { keyword: filters.keyword, status: filters.status, page: page.value, pageSize: pageSize.value })
    rows.value = (data && data.list) || []
    total.value = (data && data.total) || 0
  } catch (e) {
    ElMessage.error(e.message || '加载开票申请失败')
  } finally {
    loading.value = false
  }
}
const reload = () => { page.value = 1; load() }
const onPageChange = (p) => { page.value = p; load() }

// ===== 登记开票 + PDF 上传 =====
const issueDialog = ref(false)
const issueForm = reactive({ _id: '', order_no: '', status: '已开具', invoice_no: '', invoice_date: '', invoice_url: '' })
const uploadingPdf = ref(false)
const openIssue = (row) => {
  Object.assign(issueForm, {
    _id: row._id, order_no: row.order_no, status: row.status === '无需开票' ? '已开具' : row.status,
    invoice_no: row.invoice_no || '', invoice_date: row.invoice_date || '', invoice_url: row.invoice_url || ''
  })
  issueDialog.value = true
}
const onPickPdf = async (uploadFile) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  uploadingPdf.value = true
  try {
    const { fileUrl } = await uploadFileToCloud(raw, 'invoice/', 20 * 1024 * 1024)
    issueForm.invoice_url = fileUrl
    ElMessage.success('发票PDF已上传')
  } catch (e) {
    ElMessage.error(e.message || 'PDF上传失败')
  } finally {
    uploadingPdf.value = false
  }
}
const saveIssue = async () => {
  saving.value = true
  try {
    await updateInvoiceStatus(getToken(), issueForm._id, issueForm.status, {
      invoice_no: issueForm.invoice_no, invoice_date: issueForm.invoice_date, invoice_url: issueForm.invoice_url
    })
    ElMessage.success('已保存开票登记')
    issueDialog.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ===== 专票邮寄 =====
const mailDialog = ref(false)
const mailForm = reactive({ _id: '', order_no: '', status: '已寄出', mail_company: '', mail_no: '', mail_time: '', received_time: '' })
const openMail = (row) => {
  if (!isPaperSpecial(row)) {
    ElMessage.warning('电子普通发票无需登记邮寄物流')
    return
  }
  Object.assign(mailForm, { _id: row._id, order_no: row.order_no, status: row.status === '已签收' ? '已签收' : '已寄出', mail_company: row.mail_company || '', mail_no: row.mail_no || '', mail_time: row.mail_time || '', received_time: row.received_time || '' })
  mailDialog.value = true
}
const saveMail = async () => {
  if (!mailForm.mail_no) { ElMessage.warning('请填写邮寄单号'); return }
  saving.value = true
  try {
    await updateInvoiceStatus(getToken(), mailForm._id, mailForm.status === '已签收' ? '已签收' : '已寄出', {
      mail_company: mailForm.mail_company, mail_no: mailForm.mail_no, mail_time: mailForm.mail_time, received_time: mailForm.received_time
    })
    ElMessage.success('已登记专票邮寄')
    mailDialog.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ===== 批量导入 =====
const importDialog = ref(false)
const importRows = ref([])
const importing = ref(false)
const importSummary = ref(null)
const onPickImport = async (uploadFile) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  try {
    importRows.value = await parseInvoiceExcelFile(raw)
    importSummary.value = null
    if (!importRows.value.length) ElMessage.warning('未解析到有效数据，请检查模板格式')
  } catch (e) {
    ElMessage.error(e.message || '解析失败')
  }
}
const doImport = async () => {
  importing.value = true
  try {
    const data = await batchImportInvoices(getToken(), importRows.value)
    importSummary.value = data
    importRows.value = []
    ElMessage.success(`导入完成：成功 ${data.success} / 失败 ${data.fail}`)
    load()
  } catch (e) {
    ElMessage.error(e.message || '导入失败')
  } finally {
    importing.value = false
  }
}
const closeImport = () => { importDialog.value = false; importRows.value = []; importSummary.value = null }
const downloadTemplate = () => downloadInvoiceTemplate().catch(e => ElMessage.error(e.message || '下载失败'))

// 开票数据导出已统一到「财务中心 · 四流台账导出」（FinanceCenter.vue）

onMounted(load)
</script>

<style scoped>
.invoice-mgmt { display: flex; flex-direction: column; gap: 16px; }
.im-card { border-radius: 12px; }
.im-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
.im-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #1f2d3d; }
.im-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.im-pager { margin-top: 14px; display: flex; justify-content: flex-end; }
.im-muted { color: #c0c4cc; }
.im-export-hint { font-size: 12px; color: #909399; cursor: help; padding: 0 4px; }
.im-pdf-row { display: flex; gap: 8px; width: 100%; }
.invoice-detail-panel { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding: 8px 22px 14px; background: #f7f9fc; }
.invoice-detail-block { min-width: 0; padding: 14px; border-radius: 10px; background: #fff; border: 1px solid #edf1f7; }
.invoice-detail-block h4 { margin: 0 0 10px; color: #1f2d3d; font-size: 14px; }
.invoice-detail-block p { margin: 7px 0; display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; font-size: 13px; line-height: 1.45; }
.invoice-detail-block span { color: #909399; }
.invoice-detail-block strong { min-width: 0; color: #303133; font-weight: 600; word-break: break-all; }
.im-import-tip { margin: 12px 0 0; font-size: 13px; color: #606266; }
.im-import-summary { margin-top: 12px; font-size: 13px; color: #606266; }
.im-import-summary .ok { color: #52c41a; }
.im-import-summary .fail { color: #f56c6c; }
.im-err-list { margin: 8px 0 0; padding-left: 18px; color: #f56c6c; font-size: 12px; }
@media (max-width: 1280px) {
  .invoice-detail-panel { grid-template-columns: 1fr; }
}
</style>
