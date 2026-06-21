<template>
  <div class="glass-card">
    <div class="section-title">
      <div>
        <span>系统配置</span>
        <p class="section-desc">维护保修政策、收费办法、基础收费项、隐私合规文案和小程序联系方式。</p>
      </div>
    </div>
    <el-tabs v-model="activeContentTab" class="modern-tabs">
      <el-tab-pane label="保修与收费" name="policy">
        <div class="field-title" style="margin-top:20px;">保修政策总述</div>
        <div class="policy-document-card">
          <div class="policy-document-main">
            <el-icon class="policy-document-icon"><Document /></el-icon>
            <div class="policy-document-copy">
              <div class="policy-document-title">上传保修政策文件</div>
              <div class="policy-document-desc">支持 PDF、Word 文档；保存后作为小程序保修政策页的正式文件来源。</div>
              <div v-if="warrantyDocument.fileName" class="policy-document-file">
                <span>{{ warrantyDocument.fileName }}</span>
                <em v-if="warrantyDocument.updatedAt">更新于 {{ warrantyDocument.updatedAt }}</em>
              </div>
              <div v-else class="policy-document-empty">暂未上传保修政策文件</div>
            </div>
          </div>
          <div class="policy-document-actions">
            <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".pdf,.doc,.docx" :on-change="handleWarrantyDocumentUpload">
              <el-button type="primary" :loading="uploadingWarrantyDocument"><el-icon><Upload /></el-icon>{{ warrantyDocument.fileUrl ? '替换文件' : '上传文件' }}</el-button>
            </el-upload>
            <el-button v-if="warrantyDocument.fileUrl" plain @click="openWarrantyDocument"><el-icon><View /></el-icon>预览</el-button>
            <el-button v-if="warrantyDocument.fileUrl" type="danger" link @click="removeWarrantyDocument">移除</el-button>
          </div>
        </div>
        <el-alert
          v-if="config.warranty"
          title="检测到旧版富文本保修政策内容，保存后会继续保留为兼容内容；当前后台主入口已改为文档上传。"
          type="info"
          :closable="false"
          show-icon
          style="margin-top:12px;"
        />

        <div class="field-title" style="margin-top:24px;">收费办法说明</div>
        <div class="policy-document-card">
          <div class="policy-document-main">
            <el-icon class="policy-document-icon"><Document /></el-icon>
            <div class="policy-document-copy">
              <div class="policy-document-title">上传收费办法文件</div>
              <div class="policy-document-desc">支持 PDF、Word 文档；保存后作为小程序收费指南页的正式文件来源。</div>
              <div v-if="feeDocument.fileName" class="policy-document-file">
                <span>{{ feeDocument.fileName }}</span>
                <em v-if="feeDocument.updatedAt">更新于 {{ feeDocument.updatedAt }}</em>
              </div>
              <div v-else class="policy-document-empty">暂未上传收费办法文件</div>
            </div>
          </div>
          <div class="policy-document-actions">
            <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".pdf,.doc,.docx" :on-change="handleFeeDocumentUpload">
              <el-button type="primary" :loading="uploadingFeeDocument"><el-icon><Upload /></el-icon>{{ feeDocument.fileUrl ? '替换文件' : '上传文件' }}</el-button>
            </el-upload>
            <el-button v-if="feeDocument.fileUrl" plain @click="openFeeDocument"><el-icon><View /></el-icon>预览</el-button>
            <el-button v-if="feeDocument.fileUrl" type="danger" link @click="removeFeeDocument">移除</el-button>
          </div>
        </div>
        <el-alert
          v-if="config.feePolicy"
          title="检测到旧版文本收费办法内容，保存后会继续保留为兼容内容；当前后台主入口已改为文档上传。"
          type="info"
          :closable="false"
          show-icon
          style="margin-top:12px;"
        />

        <div class="qual-head">
          <span>过保收费阶梯模板</span>
          <el-button type="primary" link @click="addFeeTier">+ 新增收费项</el-button>
        </div>
        <div v-if="!feeTiers.length" class="empty-tip">预设检测费、基础维修费、加急服务费等标准价，报价弹窗可一键带出；小程序收费指南展示价格表。</div>
        <el-table v-else :data="feeTiers" class="modern-table" style="width:100%;">
          <el-table-column label="收费项" width="200">
            <template #default="{ row }"><el-input v-model="row.name" placeholder="如 检测费 / 加急服务费" /></template>
          </el-table-column>
          <el-table-column label="标准价(元)" width="160">
            <template #default="{ row }"><el-input-number v-model="row.price" :min="0" :step="10" controls-position="right" style="width:100%;" /></template>
          </el-table-column>
          <el-table-column label="单位" width="120">
            <template #default="{ row }"><el-input v-model="row.unit" placeholder="如 次 / 台" /></template>
          </el-table-column>
          <el-table-column label="备注">
            <template #default="{ row }"><el-input v-model="row.note" placeholder="选填说明" /></template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="right" fixed="right">
            <template #default="{ $index }"><el-button type="danger" link @click="feeTiers.splice($index, 1)">删除</el-button></template>
          </el-table-column>
        </el-table>

        <div class="save-row"><el-button type="primary" :loading="savingPolicy" @click="saveConfig">保存配置</el-button></div>
      </el-tab-pane>

      <el-tab-pane label="隐私与合规" name="compliance">
        <el-alert
          title="医疗器械小程序上线必备：隐私政策、账号注销规则、资质公示。保存后小程序端实时读取并展示。"
          type="warning"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />

        <div class="field-title">隐私政策</div>
        <RichEditor v-model="compliance.privacy_policy" upload-dir="compliance/" placeholder="完整隐私协议，支持图文，一键同步至小程序隐私弹窗（个人信息收集用途也写在此处即可）…" />

        <div class="field-title" style="margin-top:20px;">账号注销规则</div>
        <el-input v-model="compliance.account_cancellation_policy" type="textarea" :rows="3" placeholder="账号注销流程与数据删除规则（满足《个人信息保护法》），简要说明即可" />

        <div class="qual-head">
          <span>资质公示</span>
          <el-button type="primary" link @click="addQualification">+ 新增资质</el-button>
        </div>
        <div v-if="!qualifications.length" class="empty-tip">还没有资质，点击右上角“新增资质”。小程序「公司介绍 / 关于我们」会自动读取展示。</div>
        <div v-for="(item, index) in qualifications" :key="index" class="qual-card">
          <div class="qual-row">
            <el-input v-model="item.name" placeholder="资质名称，如《医疗器械生产许可证》" style="max-width:360px;" />
            <el-radio-group v-model="item.type">
              <el-radio-button label="image">图片</el-radio-button>
              <el-radio-button label="text">文本</el-radio-button>
            </el-radio-group>
            <el-button type="danger" link @click="qualifications.splice(index, 1)">删除</el-button>
          </div>
          <div v-if="item.type === 'image'" class="qual-img-row">
            <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="(f) => handleQualImage(f, item)">
              <el-button>{{ item.imageUrl ? '更换图片' : '上传图片' }}</el-button>
            </el-upload>
            <img v-if="qualPreview(item)" :src="qualPreview(item)" class="qual-thumb" />
            <span v-else-if="item.imageUrl" class="preview-hint">图片已上传（云存储）</span>
          </div>
          <el-input v-else v-model="item.text" type="textarea" :rows="3" placeholder="资质说明文本，如备案号、有效期等" />
        </div>

        <el-divider />

        <div class="qual-head">
          <span>小程序体验版二维码</span>
        </div>
        <div class="empty-tip">上传微信公众平台「版本管理」的体验版/开发版二维码。后台顶栏「访问小程序」按钮会弹出此码供员工扫码预览客户端；换版后重新上传即可（员工微信需先在公众平台「成员管理」加为体验成员）。</div>
        <div class="qual-img-row">
          <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="handleMiniappQr">
            <el-button>{{ miniappQr ? '更换二维码' : '上传二维码' }}</el-button>
          </el-upload>
          <img v-if="miniappQrPreview" :src="miniappQrPreview" class="qual-thumb" />
          <span v-else-if="miniappQr" class="preview-hint">二维码已上传（云存储）</span>
          <el-button v-if="miniappQr" type="danger" link @click="removeMiniappQr">移除</el-button>
        </div>

        <div class="save-row"><el-button type="primary" :loading="savingCompliance" @click="saveCompliance">保存隐私与合规配置</el-button></div>
      </el-tab-pane>

      <el-tab-pane label="联系与公众号" name="contact">
        <el-alert
          title="以下内容直接展示在小程序首页与「关于我们」：企业联系方式、在线客服和公众号二维码。保存后小程序端实时读取展示。"
          type="info"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />

        <div class="field-title">企业联系方式</div>
        <el-form :model="contactInfo" label-width="110px" class="print-form">
          <el-form-item label="公司名称"><el-input v-model="contactInfo.company_name" placeholder="如 XX 牙科设备维修中心" /></el-form-item>
          <el-form-item label="联系电话"><el-input v-model="contactInfo.contact_phone" placeholder="客服/售后电话" /></el-form-item>
          <el-form-item label="联系邮箱"><el-input v-model="contactInfo.contact_email" placeholder="选填" /></el-form-item>
          <el-form-item label="联系地址"><el-input v-model="contactInfo.contact_address" placeholder="寄修/办公地址" /></el-form-item>
          <el-form-item label="工作时间"><el-input v-model="contactInfo.work_time" placeholder="如 周一至周六 9:00-18:00" /></el-form-item>
        </el-form>

        <div class="field-title" style="margin-top:20px;">在线客服</div>
        <el-form :model="contactInfo" label-width="110px" class="print-form">
          <el-form-item label="客服标题"><el-input v-model="contactInfo.customer_service_title" placeholder="如 人工客服" /></el-form-item>
          <el-form-item label="客服说明"><el-input v-model="contactInfo.customer_service_desc" type="textarea" :rows="2" placeholder="客服介绍 / 服务时间" /></el-form-item>
          <el-form-item label="客服微信号"><el-input v-model="contactInfo.customer_service_wechat" placeholder="微信号，便于客户添加" /></el-form-item>
          <el-form-item label="客服二维码">
            <div class="logo-row">
              <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="(f) => handleQrUpload(f, 'customer_service_qrcode')">
                <el-button>{{ contactInfo.customer_service_qrcode ? '更换二维码' : '上传二维码' }}</el-button>
              </el-upload>
              <img v-if="qrPreview('customer_service_qrcode')" :src="qrPreview('customer_service_qrcode')" class="qual-thumb" />
              <el-button v-if="contactInfo.customer_service_qrcode" type="danger" link @click="contactInfo.customer_service_qrcode = ''">移除</el-button>
            </div>
          </el-form-item>
        </el-form>

        <div class="field-title" style="margin-top:20px;">公众号</div>
        <el-form :model="contactInfo" label-width="110px" class="print-form">
          <el-form-item label="公众号名称"><el-input v-model="contactInfo.wechat_name" placeholder="公众号名称" /></el-form-item>
          <el-form-item label="公众号简介"><el-input v-model="contactInfo.wechat_desc" type="textarea" :rows="2" placeholder="关注引导文案" /></el-form-item>
          <el-form-item label="公众号二维码">
            <div class="logo-row">
              <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="(f) => handleQrUpload(f, 'wechat_qrcode')">
                <el-button>{{ contactInfo.wechat_qrcode ? '更换二维码' : '上传二维码' }}</el-button>
              </el-upload>
              <img v-if="qrPreview('wechat_qrcode')" :src="qrPreview('wechat_qrcode')" class="qual-thumb" />
              <el-button v-if="contactInfo.wechat_qrcode" type="danger" link @click="contactInfo.wechat_qrcode = ''">移除</el-button>
            </div>
          </el-form-item>
        </el-form>

        <div class="save-row"><el-button type="primary" :loading="savingContact" @click="saveContact">保存联系与公众号配置</el-button></div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { saveSettings, getSettings, getTempFileURL } from '../api/admin.js'
import RichEditor from '../components/RichEditor.vue'
import { uploadFileToCloud } from '../utils/upload.js'

const activeContentTab = ref('policy')
const config = reactive({ warranty: '', feePolicy: '' })
const isWebUrl = (url = '') => /^https?:\/\//i.test(url)

// ===== 保修与收费 =====
const savingPolicy = ref(false)
const feeTiers = ref([])
const warrantyDocument = reactive({ fileName: '', fileUrl: '', fileType: '', updatedAt: '' })
const feeDocument = reactive({ fileName: '', fileUrl: '', fileType: '', updatedAt: '' })
const policyDocumentPreviewMap = reactive({})
const uploadingWarrantyDocument = ref(false)
const uploadingFeeDocument = ref(false)

const parseJsonArray = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

const parseJsonObject = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

const applyPolicyDocument = (target, value) => {
  const doc = parseJsonObject(value)
  target.fileName = doc.fileName || ''
  target.fileUrl = doc.fileUrl || ''
  target.fileType = doc.fileType || ''
  target.updatedAt = doc.updatedAt || ''
  resolvePolicyDocumentPreview(target)
}

const resolvePolicyDocumentPreview = async (target) => {
  if (!target.fileUrl || isWebUrl(target.fileUrl) || policyDocumentPreviewMap[target.fileUrl]) return
  const token = localStorage.getItem('adminToken')
  try {
    const map = await getTempFileURL(token, [target.fileUrl])
    if (map && map[target.fileUrl]) {
      policyDocumentPreviewMap[target.fileUrl] = map[target.fileUrl]
    }
  } catch (error) {
    console.error('解析政策文件地址失败:', error)
  }
}

const handlePolicyDocumentUpload = async (uploadFile, target, loading, dir, successMessage) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  if (!/\.(pdf|doc|docx)$/i.test(raw.name || '')) {
    ElMessage.warning('请上传 PDF 或 Word 文档')
    return
  }
  try {
    loading.value = true
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, dir, 20 * 1024 * 1024)
    target.fileName = raw.name
    target.fileUrl = fileUrl
    target.fileType = raw.type || ''
    target.updatedAt = new Date().toISOString().slice(0, 10)
    if (tempUrl) policyDocumentPreviewMap[fileUrl] = tempUrl
    ElMessage.success(successMessage)
  } catch (error) {
    ElMessage.error(error.message || '上传失败')
  } finally {
    loading.value = false
  }
}

const openPolicyDocument = async (target, emptyMessage) => {
  if (!target.fileUrl) {
    ElMessage.warning(emptyMessage)
    return
  }
  if (isWebUrl(target.fileUrl)) {
    window.open(target.fileUrl, '_blank', 'noopener,noreferrer')
    return
  }
  await resolvePolicyDocumentPreview(target)
  const url = policyDocumentPreviewMap[target.fileUrl]
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  ElMessage.info('文件已上传到云存储，暂时无法生成后台预览链接')
}

const removePolicyDocument = (target) => {
  target.fileName = ''
  target.fileUrl = ''
  target.fileType = ''
  target.updatedAt = ''
}

const serializePolicyDocument = (target) => target.fileUrl ? JSON.stringify({
  fileName: target.fileName,
  fileUrl: target.fileUrl,
  fileType: target.fileType,
  updatedAt: target.updatedAt
}) : ''

const handleWarrantyDocumentUpload = (uploadFile) => handlePolicyDocumentUpload(uploadFile, warrantyDocument, uploadingWarrantyDocument, 'warranty/', '保修政策文件上传成功')
const handleFeeDocumentUpload = (uploadFile) => handlePolicyDocumentUpload(uploadFile, feeDocument, uploadingFeeDocument, 'fees/', '收费办法文件上传成功')
const openWarrantyDocument = () => openPolicyDocument(warrantyDocument, '请先上传保修政策文件')
const openFeeDocument = () => openPolicyDocument(feeDocument, '请先上传收费办法文件')
const removeWarrantyDocument = () => removePolicyDocument(warrantyDocument)
const removeFeeDocument = () => removePolicyDocument(feeDocument)

const addFeeTier = () => feeTiers.value.push({ name: '', price: 0, unit: '次', note: '' })

const loadSettings = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getSettings(token)
    config.warranty = data.warranty_policy || ''
    config.feePolicy = data.fee_description || ''
    applyPolicyDocument(warrantyDocument, data.warranty_policy_file)
    applyPolicyDocument(feeDocument, data.fee_policy_file)
    feeTiers.value = parseJsonArray(data.fee_tier_templates)
    applyCompliance(data)
    applyContactInfo(data)
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

const saveConfig = async () => {
  try {
    savingPolicy.value = true
    const token = localStorage.getItem('adminToken')
    const cleanFeeTiers = feeTiers.value.filter(t => t.name || t.price)
    await saveSettings(token, {
      warranty_policy: config.warranty,
      warranty_policy_file: serializePolicyDocument(warrantyDocument),
      fee_description: config.feePolicy,
      fee_policy_file: serializePolicyDocument(feeDocument),
      fee_tier_templates: JSON.stringify(cleanFeeTiers)
    })
    ElMessage.success('配置保存成功')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingPolicy.value = false
  }
}

// ===== 隐私与合规配置 =====
const compliance = reactive({
  privacy_policy: '',
  account_cancellation_policy: ''
})
const qualifications = ref([])
const qualPreviewMap = reactive({}) // fileID -> 临时预览地址
const savingCompliance = ref(false)
const miniappQr = ref('')          // 小程序体验版二维码（云存储 fileID 或外链）
const miniappQrPreview = ref('')   // 临时预览地址

const parseQualifications = (value) => {
  try {
    const list = value ? JSON.parse(value) : []
    return Array.isArray(list)
      ? list.map(it => ({ name: it.name || '', type: it.type === 'text' ? 'text' : 'image', imageUrl: it.imageUrl || '', text: it.text || '' }))
      : []
  } catch (error) {
    return []
  }
}

const resolveQualPreviews = async () => {
  const token = localStorage.getItem('adminToken')
  const ids = qualifications.value
    .filter(it => it.type === 'image' && it.imageUrl && !isWebUrl(it.imageUrl) && !qualPreviewMap[it.imageUrl])
    .map(it => it.imageUrl)
  if (!ids.length) return
  try {
    const map = await getTempFileURL(token, ids)
    Object.entries(map || {}).forEach(([id, url]) => { qualPreviewMap[id] = url })
  } catch (error) {
    console.error('解析资质图片地址失败:', error)
  }
}

const qualPreview = (item) => {
  if (!item || item.type !== 'image' || !item.imageUrl) return ''
  if (isWebUrl(item.imageUrl)) return item.imageUrl
  return qualPreviewMap[item.imageUrl] || ''
}

const addQualification = () => {
  qualifications.value.push({ name: '', type: 'image', imageUrl: '', text: '' })
}

const handleQualImage = async (uploadFile, item) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  try {
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, 'compliance/', 5 * 1024 * 1024)
    item.imageUrl = fileUrl
    if (tempUrl) qualPreviewMap[fileUrl] = tempUrl
    ElMessage.success('图片上传成功')
  } catch (error) {
    ElMessage.error(error.message || '图片上传失败')
  }
}

const handleMiniappQr = async (uploadFile) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  try {
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, 'miniapp/', 2 * 1024 * 1024)
    miniappQr.value = fileUrl
    miniappQrPreview.value = tempUrl || ''
    ElMessage.success('二维码上传成功')
  } catch (error) {
    ElMessage.error(error.message || '二维码上传失败')
  }
}

const removeMiniappQr = () => {
  miniappQr.value = ''
  miniappQrPreview.value = ''
}

const applyCompliance = (data = {}) => {
  compliance.privacy_policy = data.privacy_policy || ''
  compliance.account_cancellation_policy = data.account_cancellation_policy || ''
  qualifications.value = parseQualifications(data.qualifications)
  resolveQualPreviews()
  miniappQr.value = data.miniapp_preview_qr || ''
  resolveMiniappQrPreview()
}

const resolveMiniappQrPreview = async () => {
  const id = miniappQr.value
  if (!id) { miniappQrPreview.value = ''; return }
  if (isWebUrl(id)) { miniappQrPreview.value = id; return }
  try {
    const token = localStorage.getItem('adminToken')
    const map = await getTempFileURL(token, [id])
    miniappQrPreview.value = (map && map[id]) || ''
  } catch (error) {
    console.error('解析小程序二维码地址失败:', error)
  }
}

const saveCompliance = async () => {
  try {
    savingCompliance.value = true
    const token = localStorage.getItem('adminToken')
    const cleaned = qualifications.value
      .filter(it => it.name || it.imageUrl || it.text)
      .map(it => ({ name: it.name, type: it.type, imageUrl: it.type === 'image' ? it.imageUrl : '', text: it.type === 'text' ? it.text : '' }))
    await saveSettings(token, {
      privacy_policy: compliance.privacy_policy,
      account_cancellation_policy: compliance.account_cancellation_policy,
      // 已下线的字段：保存空串以清除历史内容，避免小程序端仍展示旧的更新公告/数据收集告知
      privacy_update_notice: '',
      data_collection_notice: '',
      qualifications: JSON.stringify(cleaned),
      miniapp_preview_qr: miniappQr.value || ''
    })
    ElMessage.success('隐私与合规配置已保存')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingCompliance.value = false
  }
}

// ===== 联系方式 / 在线客服 / 公众号 =====
const CONTACT_KEYS = [
  'company_name', 'contact_phone', 'contact_email', 'contact_address', 'work_time',
  'customer_service_title', 'customer_service_desc', 'customer_service_wechat', 'customer_service_qrcode',
  'wechat_name', 'wechat_desc', 'wechat_qrcode'
]
const CONTACT_QR_KEYS = ['customer_service_qrcode', 'wechat_qrcode']
const contactInfo = reactive(CONTACT_KEYS.reduce((acc, key) => { acc[key] = ''; return acc }, {}))
const contactQrPreviewMap = reactive({})
const savingContact = ref(false)

const qrPreview = (key) => {
  const value = contactInfo[key]
  if (!value) return ''
  if (isWebUrl(value)) return value
  return contactQrPreviewMap[value] || ''
}

const resolveContactQrPreviews = async () => {
  const token = localStorage.getItem('adminToken')
  const ids = CONTACT_QR_KEYS
    .map(key => contactInfo[key])
    .filter(value => value && !isWebUrl(value) && !contactQrPreviewMap[value])
  if (!ids.length) return
  try {
    const map = await getTempFileURL(token, ids)
    Object.entries(map || {}).forEach(([id, url]) => { contactQrPreviewMap[id] = url })
  } catch (error) {
    console.error('解析二维码预览失败:', error)
  }
}

const handleQrUpload = async (uploadFile, key) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  try {
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, 'contact/', 5 * 1024 * 1024)
    contactInfo[key] = fileUrl
    if (tempUrl) contactQrPreviewMap[fileUrl] = tempUrl
    ElMessage.success('二维码上传成功')
  } catch (error) {
    ElMessage.error(error.message || '二维码上传失败')
  }
}

const applyContactInfo = (data = {}) => {
  CONTACT_KEYS.forEach(key => { contactInfo[key] = data[key] || '' })
  resolveContactQrPreviews()
}

const saveContact = async () => {
  try {
    savingContact.value = true
    const token = localStorage.getItem('adminToken')
    const payload = {}
    CONTACT_KEYS.forEach(key => { payload[key] = contactInfo[key] || '' })
    await saveSettings(token, payload)
    ElMessage.success('联系与公众号配置已保存')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingContact.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.glass-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; }
.field-title { font-weight:600; margin-bottom:12px; }
.sub-label { font-size:13px; color:#4e5969; margin-bottom:8px; }
.save-row { margin-top:20px; text-align:center; }
.print-form { max-width: 720px; margin-top: 20px; }
.policy-document-card { display:flex; justify-content:space-between; gap:18px; align-items:center; border:1px solid #dce8ff; background:#f7fbff; border-radius:8px; padding:18px; }
.policy-document-main { display:flex; align-items:flex-start; gap:14px; min-width:0; }
.policy-document-icon { flex:0 0 42px; width:42px; height:42px; border-radius:8px; background:#e8f1ff; color:#165dff; font-size:22px; display:flex; align-items:center; justify-content:center; }
.policy-document-copy { min-width:0; }
.policy-document-title { font-weight:600; color:#1d2129; margin-bottom:6px; }
.policy-document-desc { color:#4e5969; font-size:13px; line-height:1.6; }
.policy-document-file { display:flex; align-items:center; gap:10px; margin-top:10px; color:#165dff; font-size:13px; min-width:0; }
.policy-document-file span { max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.policy-document-file em { color:#86909c; font-style:normal; white-space:nowrap; }
.policy-document-empty { margin-top:10px; color:#86909c; font-size:13px; }
.policy-document-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
.upload-title { margin-bottom:16px; color:#165DFF; font-weight:600; }
.upload-tip { margin-top: 8px; font-size: 12px; color: #86909c; }
.preview-box { background:#f7f8fa; border-radius:10px; padding:20px; line-height:1.8; color:#4e5969; }
.preview-title { font-weight:600; color:#1d2129; margin:0 0 8px; }
.preview-placeholder { text-align:center; padding:32px 0 12px; color:#86909c; }
.preview-actions { display: flex; align-items: center; gap: 12px; padding-top: 16px; }
.preview-hint { color: #86909c; font-size: 12px; }
.empty-file { color: #c9cdd4; }
.qual-head { display:flex; justify-content:space-between; align-items:center; font-weight:600; margin:24px 0 12px; }
.empty-tip { color:#86909c; font-size:13px; background:#f7f8fa; border-radius:8px; padding:16px; }
.package-card { border:1px solid #e5eefb; border-radius:8px; padding:14px; margin-bottom:12px; background:#fbfdff; }
.package-head { display:grid; grid-template-columns: minmax(180px, 1fr) minmax(160px, 220px) auto; gap:10px; align-items:center; margin-bottom:10px; }
.package-table { margin:8px 0; }
.qual-card { border:1px solid #f0f2f5; border-radius:10px; padding:16px; margin-bottom:12px; }
.qual-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.qual-img-row { display:flex; align-items:center; gap:12px; }
.qual-thumb { height:72px; border-radius:6px; border:1px solid #f0f2f5; object-fit:contain; }
.popup-row { display:flex; align-items:center; margin-bottom:12px; }
.media-list { margin-bottom:12px; }
.media-item { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#f7f8fa; border-radius:6px; margin-bottom:8px; font-size:13px; color:#4e5969; }
.logo-row { display:flex; align-items:center; gap:12px; }
.logo-thumb { height:44px; border:1px solid #f0f2f5; border-radius:6px; object-fit:contain; }
.watermark-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 800px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 12px 0; }
.modern-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background-color: #f0f2f5; }
.modern-tabs :deep(.el-tabs__item) { font-size: 15px; padding: 0 20px; }

@media (max-width: 768px) {
  .policy-document-card { align-items:flex-start; flex-direction:column; }
  .policy-document-actions { width:100%; justify-content:flex-start; }
  .policy-document-file { align-items:flex-start; flex-direction:column; gap:4px; }
  .policy-document-file span { max-width:100%; }
}
</style>
