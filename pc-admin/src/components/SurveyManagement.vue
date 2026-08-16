<template>
  <div class="survey-management">
    <el-alert
      title="维护小程序调研有礼页面，并处理客户提交的调研记录。保存后小程序会动态读取最新内容。"
      type="info"
      show-icon
      :closable="false"
      class="survey-alert"
    />
    <el-form :model="surveyConfig" label-width="120px" class="print-form">
      <el-form-item label="是否启用"><el-switch v-model="surveyConfig.enabled" active-text="启用" inactive-text="停用" /></el-form-item>
      <el-form-item label="页面标题"><el-input v-model="surveyConfig.title" placeholder="如 售后服务调研表" /></el-form-item>
      <el-form-item label="页面说明"><el-input v-model="surveyConfig.subtitle" type="textarea" :rows="2" placeholder="展示在标题下方的说明文案" /></el-form-item>
      <el-form-item label="福利说明"><el-input v-model="surveyConfig.giftText" placeholder="如 提交后由工作人员核对并登记福利" /></el-form-item>
      <el-form-item label="满意度选项"><el-input v-model="surveySatisfactionText" placeholder="用逗号分隔，如 满意,一般,不满意" /></el-form-item>
      <el-form-item label="解决状态选项"><el-input v-model="surveyResolvedText" placeholder="用逗号分隔，如 已解决,处理中,未解决" /></el-form-item>
      <el-form-item label="评分上限"><el-input-number v-model="surveyConfig.ratingMax" :min="1" :max="10" controls-position="right" /></el-form-item>
      <el-form-item label="成功标题"><el-input v-model="surveyConfig.successTitle" placeholder="如 提交成功" /></el-form-item>
      <el-form-item label="成功提示"><el-input v-model="surveyConfig.successMessage" type="textarea" :rows="2" placeholder="提交成功后弹窗展示的内容" /></el-form-item>
    </el-form>
    <div class="save-row"><el-button type="primary" :loading="savingSurvey" @click="saveSurveyConfig">保存调研配置</el-button></div>

    <el-divider />
    <div class="qual-head"><span>调研提交记录</span><div class="survey-record-actions"><el-button v-if="canDeleteSurvey" type="danger" plain :disabled="!selectedSurveyRows.length" :loading="deletingSurveys" @click="deleteSelectedSurveys">批量删除<span v-if="selectedSurveyRows.length">（{{ selectedSurveyRows.length }}）</span></el-button><el-button type="primary" link :loading="surveyLoading" @click="loadSurveyRecords">刷新记录</el-button></div></div>
    <div class="survey-toolbar">
      <el-input v-model="surveyQuery.keyword" clearable placeholder="搜索工单号 / 联系方式 / 内容" style="max-width:320px;" @keyup.enter="loadSurveyRecords" />
      <el-select v-model="surveyQuery.status" clearable placeholder="处理状态" style="width:160px;" @change="loadSurveyRecords">
        <el-option label="新提交" value="new" /><el-option label="已联系" value="contacted" /><el-option label="已关闭" value="closed" />
      </el-select>
      <el-button @click="loadSurveyRecords">查询</el-button>
    </div>
    <el-table :data="surveyRecords" v-loading="surveyLoading" class="modern-table" style="width:100%; margin-top:12px;" @selection-change="selectedSurveyRows = $event">
      <el-table-column v-if="canDeleteSurvey" type="selection" width="48" fixed="left" />
      <el-table-column prop="order_no" label="工单号 / SN" width="150" show-overflow-tooltip />
      <el-table-column prop="satisfaction" label="满意度" width="100" /><el-table-column prop="rating" label="评分" width="80" />
      <el-table-column prop="resolved" label="是否解决" width="110" /><el-table-column prop="comment" label="反馈内容" min-width="220" show-overflow-tooltip />
      <el-table-column prop="contact" label="联系方式" width="150" show-overflow-tooltip />
      <el-table-column label="提交时间" width="170"><template #default="{ row }">{{ formatSurveyTime(row.create_time) }}</template></el-table-column>
      <el-table-column label="状态" width="130"><template #default="{ row }"><el-select :model-value="row.status || 'new'" size="small" @change="(status) => changeSurveyStatus(row, status)"><el-option label="新提交" value="new" /><el-option label="已联系" value="contacted" /><el-option label="已关闭" value="closed" /></el-select></template></el-table-column>
    </el-table>
    <div class="survey-pagination"><el-pagination v-model:current-page="surveyQuery.page" v-model:page-size="surveyQuery.pageSize" :total="surveyTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @size-change="loadSurveyRecords" @current-change="loadSurveyRecords" /></div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSettings, saveSettings, getSurveyList, updateSurveyStatus, deleteSurveys } from '../api/admin.js'
import { getCurrentAdminRole } from '../config/menuAccess.js'

const token = () => localStorage.getItem('adminToken')
const surveyConfig = reactive({ enabled: true, title: '售后服务调研表', subtitle: '提交一次真实售后体验反馈，工作人员核对后为您登记调研福利。', giftText: '查看原调研有礼海报', ratingMax: 5, successTitle: '提交成功', successMessage: '感谢参与售后调研，工作人员会根据联系方式核对并登记福利。' })
const surveySatisfactionText = ref('满意,一般,不满意')
const surveyResolvedText = ref('已解决,处理中,未解决')
const surveyRecords = ref([])
const selectedSurveyRows = ref([])
const surveyLoading = ref(false)
const deletingSurveys = ref(false)
const savingSurvey = ref(false)
const surveyTotal = ref(0)
const surveyQuery = reactive({ keyword: '', status: '', page: 1, pageSize: 10 })
const canDeleteSurvey = ['admin', 'superadmin'].includes(getCurrentAdminRole())
const parseList = (value, fallback) => { const list = String(value || '').split(/[,\n，、]+/).map(item => item.trim()).filter(Boolean).slice(0, 8); return list.length ? list : fallback }
const applyConfig = (value) => { try { const parsed = value ? JSON.parse(value) : {}; if (!parsed || typeof parsed !== 'object') return; Object.assign(surveyConfig, { enabled: parsed.enabled !== false, title: parsed.title || surveyConfig.title, subtitle: parsed.subtitle || surveyConfig.subtitle, giftText: parsed.giftText || surveyConfig.giftText, ratingMax: Math.max(1, Math.min(10, Number(parsed.ratingMax) || 5)), successTitle: parsed.successTitle || surveyConfig.successTitle, successMessage: parsed.successMessage || surveyConfig.successMessage }); if (Array.isArray(parsed.satisfactionOptions)) surveySatisfactionText.value = parsed.satisfactionOptions.join(','); if (Array.isArray(parsed.resolvedOptions)) surveyResolvedText.value = parsed.resolvedOptions.join(',') } catch (error) { console.warn('parse survey config failed:', error) } }
const loadConfig = async () => { const data = await getSettings(token()); applyConfig(data && data.survey_config) }
const saveSurveyConfig = async () => { savingSurvey.value = true; try { await saveSettings(token(), { survey_config: JSON.stringify({ ...surveyConfig, ratingMax: Number(surveyConfig.ratingMax) || 5, satisfactionOptions: parseList(surveySatisfactionText.value, ['满意', '一般', '不满意']), resolvedOptions: parseList(surveyResolvedText.value, ['已解决', '处理中', '未解决']) }) }); ElMessage.success('调研配置保存成功') } finally { savingSurvey.value = false } }
const formatSurveyTime = (value) => { const d = new Date(Number(value)); if (!value || Number.isNaN(d.getTime())) return ''; const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
const loadSurveyRecords = async () => { if (surveyLoading.value) return; surveyLoading.value = true; try { const data = await getSurveyList(token(), { ...surveyQuery }); surveyRecords.value = data?.list || []; surveyTotal.value = data?.total || 0 } finally { surveyLoading.value = false } }
const changeSurveyStatus = async (row, status) => { try { await updateSurveyStatus(token(), row._id || row.id, status); row.status = status; ElMessage.success('状态已更新') } catch (error) { /* request interceptor displays the error */ } }
const deleteSelectedSurveys = async () => {
  const ids = selectedSurveyRows.value.map(row => row._id || row.id).filter(Boolean)
  if (!ids.length || !canDeleteSurvey) return
  try {
    await ElMessageBox.confirm(`确定永久删除选中的 ${ids.length} 条调研记录吗？此操作不可恢复。`, '批量删除确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    deletingSurveys.value = true
    const result = await deleteSurveys(token(), ids)
    ElMessage.success(`已删除 ${result.deleted || ids.length} 条调研记录`)
    selectedSurveyRows.value = []
    const maxPage = Math.max(1, Math.ceil(Math.max(0, surveyTotal.value - ids.length) / surveyQuery.pageSize))
    if (surveyQuery.page > maxPage) surveyQuery.page = maxPage
    await loadSurveyRecords()
  } catch (error) {
    if (error !== 'cancel' && error?.message !== 'cancel') ElMessage.error(error.message || '删除调研记录失败')
  } finally { deletingSurveys.value = false }
}
onMounted(async () => { await loadConfig(); await loadSurveyRecords() })
</script>

<style scoped>
.survey-alert { margin-bottom: 20px; }
.survey-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.survey-record-actions { display:flex; align-items:center; gap:10px; }
.survey-pagination { display:flex; justify-content:flex-end; margin-top:16px; }
</style>
