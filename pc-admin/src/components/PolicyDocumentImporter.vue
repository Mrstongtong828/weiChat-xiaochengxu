<template>
  <section class="policy-importer">
    <div class="policy-importer-head">
      <div>
        <strong>{{ title }}</strong>
        <p>{{ description }}</p>
      </div>
      <el-upload
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        accept=".docx"
        :disabled="importing"
        :on-change="handleImport"
      >
        <el-button type="primary" :loading="importing">
          <el-icon><Upload /></el-icon>{{ modelValue ? '替换 Word' : '一键导入 Word' }}
        </el-button>
      </el-upload>
    </div>

    <el-progress
      v-if="importing"
      class="policy-import-progress"
      :percentage="progress.percent"
      :status="progress.percent >= 100 ? 'success' : ''"
    />
    <div v-if="importing" class="policy-import-status">{{ progress.label }}</div>

    <div v-if="modelValue" class="policy-import-result">
      <div class="policy-import-file">
        <el-icon><Document /></el-icon>
        <div>
          <strong>{{ modelValue.source?.fileName || '已导入文档' }}</strong>
          <span>版本 {{ modelValue.version || 1 }} · {{ pageCount }} 页<span v-if="updatedAt"> · {{ updatedAt }}</span></span>
        </div>
      </div>
      <div class="policy-import-actions">
        <el-button plain @click="openPreview('mobile')"><el-icon><View /></el-icon>手机排版</el-button>
        <el-button plain :disabled="!pageCount" @click="openPreview('original')"><el-icon><Document /></el-icon>原稿</el-button>
        <el-button type="danger" link @click="removeDocument">移除</el-button>
      </div>
    </div>
    <div v-else-if="!importing" class="policy-import-empty">
      上传 DOCX 后自动生成手机适配内容、逐页原稿和 PDF；未上传时继续使用下方图文内容。
    </div>

    <el-dialog v-model="previewVisible" :title="`${title}预览`" width="760px" append-to-body>
      <div class="policy-preview-switch">
        <el-radio-group v-model="previewMode" size="small">
          <el-radio-button label="mobile">手机适配</el-radio-button>
          <el-radio-button label="original" :disabled="!pageCount">原稿</el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="previewMode === 'mobile'" class="policy-mobile-shell">
        <div class="policy-mobile-preview" v-html="modelValue?.mobileHtml"></div>
      </div>
      <div v-else class="policy-original-preview">
        <div v-if="previewLoading" class="policy-preview-loading">正在加载原稿页面…</div>
        <img v-for="(url, index) in pagePreviewUrls" :key="url + index" :src="url" :alt="`第 ${index + 1} 页`" />
        <div v-if="!previewLoading && !pagePreviewUrls.length" class="policy-preview-loading">原稿页面暂不可用</div>
      </div>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getTempFileURL } from '../api/admin.js'
import { uploadFileToCloud } from '../utils/upload.js'
import {
  convertPolicyDocument,
  createPolicyDocumentManifest
} from '../utils/policyDocument.js'

const props = defineProps({
  modelValue: { type: Object, default: null },
  documentKey: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const importing = ref(false)
const previewVisible = ref(false)
const previewMode = ref('mobile')
const previewLoading = ref(false)
const pagePreviewUrls = ref([])
const progress = reactive({ percent: 0, label: '' })

const pageCount = computed(() => props.modelValue?.original?.pages?.length || 0)
const updatedAt = computed(() => {
  const timestamp = Number(props.modelValue?.updatedAt)
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { hour12: false })
})

const resolvePagePreviews = async () => {
  const pages = props.modelValue?.original?.pages || []
  if (!pages.length) {
    pagePreviewUrls.value = []
    return
  }
  const cloudIds = pages.filter(url => /^cloud:\/\//i.test(String(url || '')))
  const directUrls = new Set(pages.filter(url => /^https?:\/\//i.test(String(url || ''))))
  if (!cloudIds.length) {
    pagePreviewUrls.value = pages.filter(Boolean)
    return
  }
  previewLoading.value = true
  try {
    const map = await getTempFileURL(localStorage.getItem('adminToken'), cloudIds)
    pagePreviewUrls.value = pages
      .map(url => directUrls.has(url) ? url : (map && map[url]) || '')
      .filter(Boolean)
  } catch (error) {
    pagePreviewUrls.value = []
  } finally {
    previewLoading.value = false
  }
}

watch(() => props.modelValue, resolvePagePreviews, { immediate: true, deep: true })

const uploadArtifacts = async (artifacts) => {
  const baseDir = `policy-documents/${props.documentKey}`
  progress.percent = 90
  progress.label = '上传 Word 原件'
  const source = await uploadFileToCloud(artifacts.sourceFile, `${baseDir}/source/`, 15 * 1024 * 1024)

  progress.percent = 92
  progress.label = '上传原稿 PDF'
  const pdf = await uploadFileToCloud(artifacts.pdfFile, `${baseDir}/pdf/`, 25 * 1024 * 1024)

  const pages = []
  const previews = []
  for (let index = 0; index < artifacts.pageFiles.length; index += 1) {
    progress.percent = 93 + Math.round(((index + 1) / artifacts.pageFiles.length) * 6)
    progress.label = `上传原稿页面 ${index + 1}/${artifacts.pageFiles.length}`
    const uploaded = await uploadFileToCloud(artifacts.pageFiles[index], `${baseDir}/pages/`, 6 * 1024 * 1024)
    pages.push(uploaded)
    previews.push(uploaded.tempUrl || uploaded.fileUrl)
  }
  return { source, pdf, pages, previews }
}

const handleImport = async (uploadFile) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw || importing.value) return
  importing.value = true
  progress.percent = 0
  progress.label = '准备导入'
  try {
    const artifacts = await convertPolicyDocument(raw, (state) => {
      progress.percent = state.percent
      progress.label = state.label
    })
    const uploaded = await uploadArtifacts(artifacts)
    const manifest = createPolicyDocumentManifest({
      previous: props.modelValue,
      source: { ...uploaded.source, fileName: raw.name, fileType: raw.type },
      pdf: uploaded.pdf,
      pages: uploaded.pages,
      mobileHtml: artifacts.mobileHtml
    })
    pagePreviewUrls.value = uploaded.previews
    progress.percent = 100
    progress.label = '导入完成，保存配置后发布到小程序'
    emit('update:modelValue', manifest)
    ElMessage.success(`已生成 ${artifacts.pageFiles.length} 页原稿和手机适配版`)
  } catch (error) {
    progress.percent = 0
    ElMessage.error(error.message || 'Word 文档导入失败')
  } finally {
    importing.value = false
  }
}

const openPreview = async (mode) => {
  previewMode.value = mode
  previewVisible.value = true
  if (mode === 'original' && !pagePreviewUrls.value.length) await resolvePagePreviews()
}

const removeDocument = async () => {
  try {
    await ElMessageBox.confirm('移除后，小程序会继续展示下方图文内容。已上传原件不会立即删除。', '移除导入文档', {
      type: 'warning',
      confirmButtonText: '确认移除',
      cancelButtonText: '取消'
    })
    emit('update:modelValue', null)
    pagePreviewUrls.value = []
  } catch (error) {
    // User cancelled.
  }
}
</script>

<style scoped>
.policy-importer { margin: 14px 0 20px; padding: 18px; border: 1px solid #dce6f3; border-radius: 8px; background: #f8fbff; }
.policy-importer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.policy-importer-head strong { display: block; color: #17233b; font-size: 15px; }
.policy-importer-head p { margin: 5px 0 0; color: #6b7c97; font-size: 13px; line-height: 1.6; }
.policy-import-progress { margin-top: 16px; }
.policy-import-status { margin-top: 6px; color: #52657f; font-size: 12px; }
.policy-import-result { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #e1e9f3; }
.policy-import-file { display: flex; align-items: center; gap: 10px; min-width: 0; color: #315d9d; }
.policy-import-file > .el-icon { flex: 0 0 28px; font-size: 28px; }
.policy-import-file div { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.policy-import-file strong { overflow: hidden; color: #1d2b42; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.policy-import-file span { color: #7a899e; font-size: 12px; }
.policy-import-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.policy-import-empty { margin-top: 14px; padding-top: 12px; border-top: 1px dashed #d8e2ef; color: #7a899e; font-size: 12px; line-height: 1.6; }
.policy-preview-switch { display: flex; justify-content: center; margin-bottom: 16px; }
.policy-mobile-shell { width: 390px; max-width: 100%; margin: 0 auto; padding: 18px; background: #f2f5f9; box-sizing: border-box; }
.policy-mobile-preview { min-height: 520px; padding: 20px 18px; border-radius: 8px; background: #fff; overflow: hidden; box-sizing: border-box; }
.policy-original-preview { max-height: 70vh; padding: 14px; overflow-y: auto; background: #dfe4ea; }
.policy-original-preview img { display: block; width: 100%; height: auto; margin: 0 0 14px; background: #fff; box-shadow: 0 2px 10px rgba(15, 31, 58, 0.12); }
.policy-original-preview img:last-child { margin-bottom: 0; }
.policy-preview-loading { padding: 80px 20px; color: #7a899e; text-align: center; }
@media (max-width: 720px) {
  .policy-importer-head, .policy-import-result { align-items: stretch; flex-direction: column; }
  .policy-import-actions { justify-content: flex-start; }
}
</style>
