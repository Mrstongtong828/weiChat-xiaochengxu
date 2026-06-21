<template>
  <div class="glass-card">
    <div class="section-title">
      <div>
        <span>客户投诉与建议</span>
        <p class="section-desc">集中处理小程序反馈，优先识别高危投诉、超时未处理和关联工单问题。</p>
      </div>
    </div>

    <div class="filter-bar page-actions">
      <el-select v-model="filters.type" placeholder="类型" style="width: 110px;" @change="reload">
        <el-option label="全部类型" value="全部"></el-option>
        <el-option label="投诉" value="投诉"></el-option>
        <el-option label="建议" value="建议"></el-option>
      </el-select>
      <el-select v-model="filters.status" placeholder="状态" style="width: 120px;" @change="reload">
        <el-option label="全部状态" value="全部"></el-option>
        <el-option v-for="s in STATUS_OPTIONS" :key="s" :label="s" :value="s"></el-option>
      </el-select>
      <el-select v-model="filters.urgency" placeholder="紧急度" style="width: 110px;" @change="reload">
        <el-option label="全部紧急度" value="全部"></el-option>
        <el-option label="普通" value="普通"></el-option>
        <el-option label="重要" value="重要"></el-option>
        <el-option label="高危" value="高危"></el-option>
      </el-select>
      <el-input
        v-model="filters.keyword"
        placeholder="内容/工单号/联系方式"
        clearable
        style="width: 200px;"
        @keyup.enter="reload"
        @clear="reload"
      ></el-input>
      <el-button type="primary" @click="reload">查询</el-button>
    </div>

    <div class="legend">
      <span class="dot dot-highrisk"></span>高危
      <span class="dot dot-important"></span>重要
      <span class="dot dot-overdue"></span>超48h待处理
    </div>

    <div class="table-responsive">
      <el-table
        :data="feedbackList"
        v-loading="loading"
        class="modern-table"
        style="width: 100%;"
        :row-class-name="rowClassName"
      >
        <template #empty>
          <div class="table-empty-guide">
            <strong>暂无客户反馈</strong>
            <span>小程序端提交投诉或建议后会同步到这里；也可以调整筛选条件查看历史记录。</span>
          </div>
        </template>
        <el-table-column prop="submitTime" label="提交时间" width="160"></el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{row}">
            <el-tag :type="row.type === '投诉' ? 'danger' : 'primary'" effect="light">{{row.type}}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="紧急" width="80">
          <template #default="{row}">
            <el-tag :type="urgencyTag(row.urgency)" effect="light">{{row.urgency || '普通'}}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" width="110">
          <template #default="{ row }"><span class="cell-primary">{{ row.customerName || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="customerPhone" label="电话" width="130"></el-table-column>
        <el-table-column label="关联工单" width="160">
          <template #default="{row}">
            <el-button v-if="row.rel_order_no" type="primary" link @click="goToOrder(row.rel_order_no)">
              {{row.rel_order_no}}
            </el-button>
            <span v-else style="color:#c0c4cc;">未关联</span>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="反馈内容" min-width="200" show-overflow-tooltip></el-table-column>
        <el-table-column label="负责人" width="100">
          <template #default="{row}">
            <span v-if="row.handler_name">{{row.handler_name}}</span>
            <span v-else style="color:#c0c4cc;">未分配</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{row}">
            <el-tag :type="statusTag(row.status)" effect="light">{{row.status}}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" align="right">
          <template #default="{row}">
            <el-button type="primary" link @click="openDialog(row)">查看并处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pager">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="onPageChange"
      />
    </div>
  </div>

  <el-dialog v-model="dialogVisible" title="反馈处理" width="640px" align-center top="6vh">
    <template v-if="current">
      <!-- 反馈原始信息 -->
      <div class="block">
        <div class="block-title">反馈信息</div>
        <div class="info-grid">
          <div><label>客户</label><span>{{current.customerName || '未提供'}}</span></div>
          <div><label>电话</label><span>{{current.customerPhone || current.contact_value || '—'}}</span></div>
          <div><label>类型</label><span>{{current.type}}</span></div>
          <div><label>提交时间</label><span>{{current.submitTime}}</span></div>
          <div><label>联系方式</label><span>{{current.contact_type}} {{current.contact_value}}</span></div>
          <div>
            <label>关联工单</label>
            <el-button v-if="current.rel_order_no" type="primary" link @click="goToOrder(current.rel_order_no)">
              {{current.rel_order_no}} →
            </el-button>
            <span v-else style="color:#c0c4cc;">未关联</span>
          </div>
        </div>
        <div class="content-box">{{current.content}}</div>
        <div v-if="current.images && current.images.length" class="img-row">
          <el-image
            v-for="(img, i) in current.images"
            :key="i"
            :src="img"
            :preview-src-list="current.images"
            :initial-index="i"
            fit="cover"
            class="thumb"
          />
        </div>
      </div>

      <!-- 内部处理 -->
      <div class="block">
        <div class="block-title">内部处理</div>
        <div class="form-row">
          <label>负责人</label>
          <el-select v-model="form.handlerId" placeholder="选择负责人" clearable style="width: 220px;">
            <el-option
              v-for="s in staffOptions"
              :key="s._id"
              :label="`${s.name || s.nickname || s.username}（${roleLabel(s.role)}）`"
              :value="s._id"
            ></el-option>
          </el-select>
          <label style="margin-left:16px;">紧急等级</label>
          <el-select v-model="form.urgency" style="width: 120px;">
            <el-option label="普通" value="普通"></el-option>
            <el-option label="重要" value="重要"></el-option>
            <el-option label="高危" value="高危"></el-option>
          </el-select>
        </div>
        <div class="form-row">
          <label>关联工单</label>
          <el-input v-model="form.relOrderNo" placeholder="填写工单号绑定，清空后保存即解绑" style="width:220px;"></el-input>
          <el-button :loading="linking" style="margin-left:12px;" @click="saveLinkOrder">保存关联</el-button>
        </div>
        <div class="form-row">
          <label>核实结果</label>
          <el-input v-model="form.processResult" placeholder="如：设备质量问题 / 人为损坏 / 物流问题" style="flex:1;"></el-input>
        </div>
        <div class="form-row col">
          <label>官方回复<span class="hint">（小程序端客户可见）</span></label>
          <el-input v-model="form.reply" type="textarea" :rows="2" placeholder="给客户的处理结果与答复..."></el-input>
        </div>
        <div class="form-row col">
          <label>内部备注<span class="hint">（仅后台可见）</span></label>
          <el-input v-model="form.processNote" type="textarea" :rows="2" placeholder="跨部门协同备注，如同步研发/生产质量问题..."></el-input>
        </div>
        <el-button type="primary" :loading="saving" @click="saveProcess">保存处理记录</el-button>
      </div>

      <!-- 回访 -->
      <div class="block">
        <div class="block-title">
          回访登记
          <span v-if="current.visit_satisfaction" class="visited">已回访 · {{current.visit_satisfaction}}</span>
        </div>
        <div class="form-row">
          <label>满意度</label>
          <el-radio-group v-model="form.satisfaction">
            <el-radio label="满意">满意</el-radio>
            <el-radio label="一般">一般</el-radio>
            <el-radio label="不满意">不满意</el-radio>
          </el-radio-group>
        </div>
        <div class="form-row col">
          <label>客户意见</label>
          <el-input v-model="form.visitOpinion" type="textarea" :rows="2" placeholder="客户对处理结果的最终意见..."></el-input>
        </div>
        <el-button :loading="visiting" @click="saveVisit">登记回访</el-button>
      </div>
    </template>

    <template #footer>
      <el-button type="warning" plain @click="doUpgrade">升级投诉</el-button>
      <el-button type="success" :loading="closing" @click="doClose">结案</el-button>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getFeedbackList, getStaffList,
  assignFeedback, setFeedbackUrgency, replyFeedback, linkFeedbackOrder,
  recordFeedbackVisit, closeFeedback, upgradeFeedback
} from '../api/admin.js'

const STATUS_OPTIONS = ['待处理', '处理中', '已回复', '已结案', '已升级']
const ROLE_LABELS = { admin: '管理员', engineer: '工程师', finance: '财务', support: '客服', superadmin: '超管' }
const OVERDUE_MS = 48 * 3600 * 1000

const loading = ref(false)
const saving = ref(false)
const visiting = ref(false)
const closing = ref(false)
const linking = ref(false)
const feedbackList = ref([])
const staffOptions = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

const filters = reactive({ status: '全部', type: '全部', urgency: '全部', keyword: '' })

const dialogVisible = ref(false)
const current = ref(null)
const form = reactive({
  handlerId: '', urgency: '普通', processResult: '', reply: '', processNote: '',
  satisfaction: '', visitOpinion: '', relOrderNo: ''
})

const router = useRouter()
const token = () => localStorage.getItem('adminToken')
const roleLabel = (r) => ROLE_LABELS[r] || r

// 跳转到关联工单（WorkOrder 页按关键词搜索 order_no）
const goToOrder = (orderNo) => {
  if (!orderNo) return
  router.push({ name: 'WorkOrder', query: { keyword: orderNo } })
}
const urgencyTag = (u) => (u === '高危' ? 'danger' : u === '重要' ? 'warning' : 'info')
const statusTag = (s) => ({
  '待处理': 'warning', '处理中': 'primary', '已回复': 'success',
  '已结案': 'info', '已升级': 'danger', '已处理': 'success'
}[s] || 'info')

const formatTime = (ms) => (ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '')

const rowClassName = ({ row }) => {
  if (row.urgency === '高危') return 'row-highrisk'
  if (row.urgency === '重要') return 'row-important'
  if (row.status === '待处理' && row.create_time && (Date.now() - row.create_time > OVERDUE_MS)) return 'row-overdue'
  return ''
}

const mapRow = (item) => ({
  ...item,
  submitTime: formatTime(item.create_time)
})

const loadList = async () => {
  loading.value = true
  try {
    const params = {
      status: filters.status,
      type: filters.type,
      urgency: filters.urgency,
      keyword: filters.keyword.trim(),
      page: page.value,
      pageSize: pageSize.value
    }
    const data = await getFeedbackList(token(), params)
    feedbackList.value = (data.list || []).map(mapRow)
    total.value = data.total || 0
  } catch (e) {
    // 错误已由拦截器提示
  } finally {
    loading.value = false
  }
}

const reload = () => { page.value = 1; loadList() }
const onPageChange = (p) => { page.value = p; loadList() }

const loadStaff = async () => {
  try {
    const data = await getStaffList(token())
    staffOptions.value = (data || []).filter(s => !s.disabled)
  } catch (e) { /* ignore */ }
}

const openDialog = (row) => {
  current.value = row
  form.handlerId = row.handler_id || ''
  form.urgency = row.urgency || '普通'
  form.processResult = row.process_result || ''
  form.reply = row.reply || ''
  form.processNote = row.process_note || ''
  form.satisfaction = row.visit_satisfaction || ''
  form.visitOpinion = row.visit_opinion || ''
  form.relOrderNo = row.rel_order_no || ''
  dialogVisible.value = true
}

const saveLinkOrder = async () => {
  if (!current.value) return
  linking.value = true
  try {
    await linkFeedbackOrder(token(), current.value._id, form.relOrderNo.trim())
    ElMessage.success(form.relOrderNo.trim() ? '已关联工单' : '已解除工单关联')
    await refreshCurrent()
  } catch (e) { /* interceptor toasts */ } finally {
    linking.value = false
  }
}

const refreshCurrent = async () => {
  const id = current.value && current.value._id
  await loadList()
  if (id) {
    const fresh = feedbackList.value.find(f => f._id === id)
    if (fresh) openDialog(fresh)
  }
}

const saveProcess = async () => {
  if (!current.value) return
  saving.value = true
  try {
    const id = current.value._id
    if (form.handlerId !== (current.value.handler_id || '')) {
      await assignFeedback(token(), id, form.handlerId)
    }
    if (form.urgency !== (current.value.urgency || '普通')) {
      await setFeedbackUrgency(token(), id, form.urgency)
    }
    await replyFeedback(token(), {
      id,
      reply: form.reply.trim(),
      process_result: form.processResult.trim(),
      process_note: form.processNote.trim()
    })
    ElMessage.success('处理记录已保存')
    await refreshCurrent()
  } catch (e) { /* interceptor toasts */ } finally {
    saving.value = false
  }
}

const saveVisit = async () => {
  if (!current.value) return
  if (!form.satisfaction) { ElMessage.warning('请选择满意度'); return }
  visiting.value = true
  try {
    await recordFeedbackVisit(token(), {
      id: current.value._id,
      satisfaction: form.satisfaction,
      opinion: form.visitOpinion.trim()
    })
    ElMessage.success('回访已登记')
    await refreshCurrent()
  } catch (e) { /* */ } finally {
    visiting.value = false
  }
}

const doClose = async () => {
  if (!current.value) return
  if (!current.value.visit_time) { ElMessage.warning('请先完成回访登记再结案'); return }
  closing.value = true
  try {
    await closeFeedback(token(), current.value._id)
    ElMessage.success('已结案')
    dialogVisible.value = false
    await loadList()
  } catch (e) { /* */ } finally {
    closing.value = false
  }
}

const doUpgrade = async () => {
  if (!current.value) return
  try {
    const { value } = await ElMessageBox.prompt('请填写升级原因（将流转至售后主管/厂商）', '升级投诉', {
      confirmButtonText: '确认升级',
      cancelButtonText: '取消',
      inputType: 'textarea'
    })
    await upgradeFeedback(token(), current.value._id, value || '')
    ElMessage.success('已标记升级投诉')
    dialogVisible.value = false
    await loadList()
  } catch (e) { /* cancel or error */ }
}

onMounted(() => {
  loadList()
  loadStaff()
})
</script>

<style scoped>
.glass-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; }
.section-title { font-size: 16px; font-weight: 600; color: #1d2129; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.filter-bar { display: flex; gap: 8px; flex-wrap: wrap; }
.legend { font-size: 12px; color: #86909c; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
.legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-left: 10px; }
.dot-highrisk { background: #fde2e2; border: 1px solid #f56c6c; }
.dot-important { background: #fdf6ec; border: 1px solid #e6a23c; }
.dot-overdue { background: #fef0e6; border: 1px solid #f08c3a; }
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 1100px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 12px 0; }
.modern-table :deep(.row-highrisk) { background-color: #fef0f0 !important; }
.modern-table :deep(.row-important) { background-color: #fdf6ec !important; }
.modern-table :deep(.row-overdue) { background-color: #fef4ec !important; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }

.block { border: 1px solid #f0f2f5; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.block-title { font-weight: 600; color: #1d2129; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
.visited { font-size: 12px; color: #67c23a; font-weight: 400; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 10px; }
.info-grid label { color: #86909c; margin-right: 6px; }
.info-grid span { color: #1d2129; }
.content-box { background: #f7f8fa; border-radius: 8px; padding: 10px 12px; color: #1d2129; line-height: 1.7; }
.img-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.thumb { width: 64px; height: 64px; border-radius: 6px; }
.form-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.form-row.col { flex-direction: column; align-items: stretch; }
.form-row label { color: #4e5969; font-size: 13px; min-width: 64px; }
.form-row .hint { color: #c0c4cc; font-weight: 400; font-size: 12px; }
</style>
