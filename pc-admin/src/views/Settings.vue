<template>
  <div class="glass-card">
    <el-tabs v-model="activeContentTab" class="modern-tabs">
      <el-tab-pane label="保修与收费" name="policy">
        <el-row :gutter="20" style="margin-top:20px;">
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px;">
            <div class="field-title">保修政策文本</div>
            <el-input v-model="config.warranty" type="textarea" :rows="8"></el-input>
          </el-col>
          <el-col :xs="24" :sm="12">
            <div class="field-title">收费办法说明</div>
            <el-input v-model="config.feePolicy" type="textarea" :rows="8"></el-input>
          </el-col>
        </el-row>
        <div class="save-row"><el-button type="primary" @click="saveConfig">保存配置</el-button></div>
      </el-tab-pane>

      <el-tab-pane label="打印配置" name="print">
        <el-alert
          title="浏览器网页只能打开打印对话框，不能静默指定物理打印机。这里保存默认打印模板、纸张和份数，实际打印机仍在系统打印弹窗中选择。"
          type="info"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />
        <el-form :model="printConfig" label-width="130px" class="print-form">
          <el-form-item label="打印单标题">
            <el-input v-model="printConfig.title" placeholder="例如：设备维修回寄单"></el-input>
          </el-form-item>
          <el-form-item label="纸张规格">
            <el-select v-model="printConfig.paperSize" style="width: 220px;">
              <el-option label="A4" value="A4"></el-option>
              <el-option label="A5" value="A5"></el-option>
              <el-option label="热敏小票 80mm" value="receipt-80"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="默认份数">
            <el-input-number v-model="printConfig.copies" :min="1" :max="5"></el-input-number>
          </el-form-item>
          <el-form-item label="显示签名栏">
            <el-switch v-model="printConfig.showSignature"></el-switch>
          </el-form-item>
          <el-form-item label="页脚提示">
            <el-input v-model="printConfig.footer" type="textarea" :rows="3" placeholder="打印单底部展示给客户的提示"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveConfig">保存打印配置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="操作教程" name="guide">
        <el-alert
          title="快速指南、报修指南、查询指南、开票指南四个栏目固定展示；上传 PDF、图片或 Word 文档后，小程序端会在对应栏目展示并支持打开浏览。"
          type="info"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />
        <div class="table-responsive" style="margin-top:20px;">
          <el-table :data="guideItems" class="modern-table" style="width:100%;">
            <el-table-column prop="category" label="教程栏目" width="120"></el-table-column>
            <el-table-column prop="desc" label="功能说明" show-overflow-tooltip></el-table-column>
            <el-table-column label="当前文档" min-width="180" show-overflow-tooltip>
              <template #default="{row}">
                <span :class="{ 'empty-file': !row.file }">{{ row.file || '未上传' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="120"></el-table-column>
            <el-table-column label="操作" width="190" align="right">
              <template #default="{row}">
                <el-button type="primary" link @click="openUploadDialog(row)">上传替换</el-button>
                <el-button type="primary" link @click="openGuidePreview(row)">预览</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>

  <el-dialog v-model="uploadDialogVisible" title="上传替换教程文档" width="560px" align-center>
    <div class="upload-title">正在为「{{ currentGuide?.category }}」上传新文档</div>
    <el-upload
      drag
      action="#"
      :auto-upload="false"
      :limit="1"
      :on-change="handleFileChange"
      :on-exceed="handleFileExceed"
      :file-list="uploadFileList"
      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
    >
      <el-icon><UploadFilled /></el-icon>
      <div class="el-upload__text">将文件拖到此处，或 <em>点击上传</em></div>
      <template #tip>
        <div class="upload-tip">支持 PDF、Word 和常见图片格式，建议单个文件不超过 10MB。</div>
      </template>
    </el-upload>
    <template #footer>
      <el-button @click="uploadDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="uploadingGuide" @click="confirmUpload">确认上传</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="guidePreviewVisible" :title="guidePreviewTarget ? guidePreviewTarget.category + ' - 预览' : '操作指南预览'" width="560px" align-center>
    <template v-if="guidePreviewTarget">
      <div class="preview-box">
        <p class="preview-title">{{guidePreviewTarget.category}}</p>
        <p>功能说明：{{guidePreviewTarget.desc}}</p>
        <p>当前文档：{{guidePreviewTarget.file}}</p>
        <p>更新时间：{{guidePreviewTarget.updatedAt}}</p>
        <div v-if="guidePreviewTarget.fileUrl" class="preview-actions">
          <el-button type="primary" @click="openGuideFile(guidePreviewTarget)">打开文档</el-button>
          <span v-if="!isWebUrl(guidePreviewTarget.fileUrl)" class="preview-hint">云存储文件会在小程序端打开，后台仅展示上传记录。</span>
        </div>
        <div v-else class="preview-placeholder">还未上传文档，请先点击“上传替换”。</div>
      </div>
    </template>
    <template #footer>
      <el-button @click="guidePreviewVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { saveSettings, getSettings, getGuides, updateGuide, uploadGuideFile } from '../api/admin.js'

const defaultPrintConfig = () => ({
  title: '设备维修回寄单',
  paperSize: 'A4',
  copies: 1,
  showSignature: true,
  footer: '感谢您的信任！为了您的设备健康，建议定期维护保养。'
})

const activeContentTab = ref('policy')
const config = reactive({ warranty: '', feePolicy: '' })
const printConfig = reactive(defaultPrintConfig())
const guideDefaults = [
  { type: 'quick', category: '快速指南', desc: '跳转到图文并茂的快速入门文档，帮助用户快速了解小程序售后流程。', sort: 1 },
  { type: 'repair', category: '报修指南', desc: '跳转到图文并茂的报修文档，说明报修流程、寄出注意事项和进度查询方式。', sort: 2 },
  { type: 'query', category: '查询指南', desc: '跳转到图文并茂的查询文档，说明工单、物流和维修进度查询方式。', sort: 3 },
  { type: 'invoice', category: '开票指南', desc: '跳转到图文并茂的开票文档，说明发票申请、资料填写和开票进度查看方式。', sort: 4 }
]
const guideAliases = {
  quick: ['快速指南', '快速入门'],
  repair: ['报修指南', '报修流程'],
  query: ['查询指南', '查询办法', '维修查询', '物流寄送'],
  invoice: ['开票指南', '发票开具']
}

const parsePrintConfig = (value) => {
  try {
    return { ...defaultPrintConfig(), ...(value ? JSON.parse(value) : {}) }
  } catch (error) {
    return defaultPrintConfig()
  }
}

const loadSettings = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getSettings(token)
    config.warranty = data.warranty_policy || ''
    config.feePolicy = data.fee_description || ''
    Object.assign(printConfig, parsePrintConfig(data.print_config))
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

const saveConfig = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    await saveSettings(token, {
      warranty_policy: config.warranty,
      fee_description: config.feePolicy,
      print_config: JSON.stringify(printConfig)
    })
    ElMessage.success('配置保存成功')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  }
}

const guideItems = ref([])
const detectGuideType = (item = {}) => {
  if (guideAliases[item.type]) return item.type
  const category = String(item.category || '')
  const matched = Object.entries(guideAliases).find(([, aliases]) => aliases.some(alias => category.includes(alias)))
  return matched ? matched[0] : ''
}

const normalizeGuideRow = (item = {}, fallback = {}) => ({
  _id: item._id || '',
  type: item.type || fallback.type || detectGuideType(item),
  category: fallback.category || item.category,
  desc: item.desc || fallback.desc || '',
  file: item.file_name || '',
  fileUrl: item.file_url || '',
  fileType: item.file_type || '',
  sort: item.sort || fallback.sort || 99,
  updatedAt: item.update_time ? new Date(item.update_time).toISOString().slice(0, 10) : ''
})

const mergeGuideRows = (rows = []) => guideDefaults.map(defaultGuide => {
  const matched = rows.find(item => detectGuideType(item) === defaultGuide.type)
  return normalizeGuideRow(matched || {}, defaultGuide)
})

const loadGuides = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getGuides(token)
    guideItems.value = mergeGuideRows(data || [])
  } catch (error) {
    console.error('加载教程列表失败:', error)
    guideItems.value = mergeGuideRows([])
  }
}

const uploadDialogVisible = ref(false)
const currentGuide = ref(null)
const uploadFileList = ref([])
const uploadingGuide = ref(false)

const openUploadDialog = (row) => {
  currentGuide.value = row
  uploadFileList.value = []
  uploadDialogVisible.value = true
}
const handleFileChange = (file, fileList) => { uploadFileList.value = fileList }
const handleFileExceed = () => {
  ElMessage.warning('每个教程栏目一次只能上传 1 个文档')
}
const confirmUpload = async () => {
  if (!uploadFileList.value.length) { ElMessage.warning('请先选择要上传的文件'); return }
  if (!currentGuide.value) return
  if (!currentGuide.value._id) { ElMessage.error('教程栏目尚未初始化，请刷新页面后重试'); return }

  const file = uploadFileList.value[0].raw
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('教程文档不能超过 10MB')
    return
  }
  const token = localStorage.getItem('adminToken')

  try {
    uploadingGuide.value = true
    const fileContent = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const uploadData = await uploadGuideFile(token, fileContent, file.name, file.type)
    await updateGuide(token, currentGuide.value._id, {
      file_name: file.name,
      file_url: uploadData.fileUrl,
      file_type: file.type,
      desc: currentGuide.value.desc
    })
    uploadDialogVisible.value = false
    ElMessage.success('文档上传成功')
    await loadGuides()
  } catch (error) {
    ElMessage.error(error.message || '上传失败')
  } finally {
    uploadingGuide.value = false
  }
}

const guidePreviewVisible = ref(false)
const guidePreviewTarget = ref(null)
const openGuidePreview = (row) => { guidePreviewTarget.value = row; guidePreviewVisible.value = true }
const isWebUrl = (url = '') => /^https?:\/\//i.test(url)
const openGuideFile = (row) => {
  if (!row.fileUrl) {
    ElMessage.warning('该教程还未上传文档')
    return
  }
  if (isWebUrl(row.fileUrl)) {
    window.open(row.fileUrl, '_blank', 'noopener,noreferrer')
    return
  }
  ElMessage.info('该文件已上传到云存储，请在小程序端打开查看')
}

onMounted(() => {
  loadSettings()
  loadGuides()
})
</script>

<style scoped>
.glass-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; }
.field-title { font-weight:600; margin-bottom:12px; }
.save-row { margin-top:20px; text-align:center; }
.print-form { max-width: 720px; margin-top: 20px; }
.upload-title { margin-bottom:16px; color:#165DFF; font-weight:600; }
.upload-tip { margin-top: 8px; font-size: 12px; color: #86909c; }
.preview-box { background:#f7f8fa; border-radius:10px; padding:20px; line-height:1.8; color:#4e5969; }
.preview-title { font-weight:600; color:#1d2129; margin:0 0 8px; }
.preview-placeholder { text-align:center; padding:32px 0 12px; color:#86909c; }
.preview-actions { display: flex; align-items: center; gap: 12px; padding-top: 16px; }
.preview-hint { color: #86909c; font-size: 12px; }
.empty-file { color: #c9cdd4; }
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 800px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 12px 0; }
.modern-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background-color: #f0f2f5; }
.modern-tabs :deep(.el-tabs__item) { font-size: 15px; padding: 0 20px; }
</style>
