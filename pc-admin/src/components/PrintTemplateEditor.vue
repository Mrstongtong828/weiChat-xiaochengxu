<template>
  <div class="print-template-editor">
    <div class="print-editor-toolbar">
      <div>
        <h2>打印模板</h2>
        <p>选择单据后直接调整项目，右侧修改会立即显示在中间预览中。</p>
      </div>
      <div class="print-editor-actions">
        <el-button plain @click="resetCurrentTemplate">
          <el-icon><RefreshRight /></el-icon>
          恢复默认
        </el-button>
        <el-button plain @click="testPrint">
          <el-icon><Printer /></el-icon>
          测试打印
        </el-button>
        <el-button type="primary" :loading="saving" @click="$emit('save')">
          <el-icon><CircleCheck /></el-icon>
          保存模板
        </el-button>
      </div>
    </div>

    <div class="print-editor-grid">
      <nav class="print-editor-nav" aria-label="单据类型">
        <p class="panel-label">单据类型</p>
        <button
          v-for="doc in documentTypes"
          :key="doc.key"
          type="button"
          class="document-nav-item"
          :class="{ 'is-active': activeDocType === doc.key }"
          :aria-pressed="activeDocType === doc.key"
          @click="activeDocType = doc.key"
        >
          <span>{{ doc.label }}</span>
          <small>{{ templates[doc.key]?.templateName || '标准模板' }}</small>
        </button>
      </nav>

      <section class="print-preview-workspace">
        <div class="preview-head">
          <div>
            <strong>{{ activeDocMeta.label }}预览</strong>
            <span>{{ currentTemplate.paperSize }} · {{ orientationLabel }}</span>
          </div>
          <span class="preview-status">实时预览</span>
        </div>
        <div class="preview-frame-wrap">
          <iframe
            :key="previewSignature"
            class="print-preview-frame"
            :srcdoc="previewHtml"
            :title="activeDocMeta.label + '打印预览'"
          ></iframe>
        </div>
      </section>

      <aside class="print-properties">
        <section class="property-section">
          <div class="property-section-head">
            <strong>基本设置</strong>
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="模板名称">
              <el-input v-model="currentTemplate.templateName" maxlength="30" />
            </el-form-item>
            <el-form-item label="单据标题">
              <el-input v-model="currentTemplate.title" maxlength="60" />
            </el-form-item>
            <el-form-item label="公司名称">
              <el-input v-model="currentTemplate.companyName" maxlength="80" />
            </el-form-item>
            <div class="property-grid">
              <el-form-item label="纸张">
                <el-select v-model="currentTemplate.paperSize">
                  <el-option label="A4" value="A4" />
                  <el-option label="A5" value="A5" />
                </el-select>
              </el-form-item>
              <el-form-item label="方向">
                <el-select v-model="currentTemplate.orientation">
                  <el-option label="横向" value="landscape" />
                  <el-option label="纵向" value="portrait" />
                </el-select>
              </el-form-item>
            </div>
            <div class="property-grid">
              <el-form-item label="打印份数">
                <el-input-number v-model="currentTemplate.copies" :min="1" :max="5" controls-position="right" />
              </el-form-item>
              <el-form-item v-if="['repair_order', 'inspection_report'].includes(activeDocType)" label="最少表格行数">
                <el-input-number v-model="currentTemplate.minRows" :min="1" :max="12" controls-position="right" />
              </el-form-item>
            </div>
            <div class="switch-row">
              <span>显示 Logo</span>
              <el-switch v-model="currentTemplate.showLogo" aria-label="显示 Logo" />
            </div>
            <div class="switch-row">
              <span>显示签字栏</span>
              <el-switch v-model="currentTemplate.showSignature" aria-label="显示签字栏" />
            </div>
            <el-form-item v-if="activeDocType === 'inspection_report'" label="底部说明">
              <el-input v-model="currentTemplate.notice" type="textarea" :rows="3" maxlength="1000" show-word-limit />
            </el-form-item>
          </el-form>
        </section>

        <section class="property-section fields-section">
          <div class="property-section-head">
            <div>
              <strong>打印项目</strong>
              <span>关闭项目后不会打印</span>
            </div>
            <el-button type="primary" link @click="addCustomField">
              <el-icon><Plus /></el-icon>
              添加项目
            </el-button>
          </div>

          <div class="field-editor-list">
            <div v-for="(item, index) in currentTemplate.fields" :key="item.key" class="field-editor-row">
              <div class="field-editor-main">
                <el-switch v-model="item.visible" size="small" :aria-label="item.label + '显示状态'" />
                <div class="field-editor-copy">
                  <el-input v-if="item.custom" v-model="item.label" size="small" maxlength="30" />
                  <div v-else class="field-label-locked">
                    <strong>{{ item.label }}</strong>
                    <small>系统字段</small>
                  </div>
                  <span>{{ groupLabel(item.group) }}{{ item.custom ? '' : ' · 名称和位置已锁定' }}</span>
                </div>
                <div v-if="item.custom" class="field-row-actions">
                  <el-tooltip content="上移" placement="top">
                    <el-button circle text size="small" :aria-label="'上移' + item.label" :disabled="!canMoveField(index, -1)" @click="moveField(index, -1)">
                      <el-icon><ArrowUp /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="下移" placement="top">
                    <el-button circle text size="small" :aria-label="'下移' + item.label" :disabled="!canMoveField(index, 1)" @click="moveField(index, 1)">
                      <el-icon><ArrowDown /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="删除项目" placement="top">
                    <el-button circle text type="danger" size="small" :aria-label="'删除' + item.label" @click="removeField(index)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
              <div v-if="item.custom && item.group === 'item'" class="field-editor-extra">
                <span>列宽</span>
                <el-input-number v-model="item.width" :min="4" :max="30" :step="1" controls-position="right" size="small" />
              </div>
              <div v-if="item.custom" class="field-editor-extra">
                <span>默认内容</span>
                <el-input v-model="item.defaultValue" size="small" placeholder="可留空，打印后手写" maxlength="100" />
              </div>
            </div>
          </div>
        </section>

        <section class="property-section">
          <div class="property-section-head">
            <strong>页脚与水印</strong>
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="页脚文字">
              <el-input v-model="currentTemplate.footer" type="textarea" :rows="2" maxlength="200" />
            </el-form-item>
            <div class="switch-row">
              <span>启用水印</span>
              <el-switch v-model="currentTemplate.watermarkEnabled" aria-label="启用水印" />
            </div>
            <el-form-item v-if="currentTemplate.watermarkEnabled" label="水印文字">
              <el-input v-model="currentTemplate.watermarkText" maxlength="60" />
            </el-form-item>
          </el-form>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Delete,
  Plus,
  Printer,
  RefreshRight
} from '@element-plus/icons-vue'
import {
  PRINT_DOC_TYPES,
  createPrintPreviewHtml,
  defaultPrintTemplate,
  openPrintWindow,
  parsePrintTemplates
} from '../utils/orderPrint.js'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  },
  saving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'save'])
const clone = (value) => JSON.parse(JSON.stringify(value))
const templates = ref(clone(parsePrintTemplates(props.modelValue)))
const activeDocType = ref('repair_order')
let localSignature = JSON.stringify(templates.value)

watch(
  () => props.modelValue,
  (value) => {
    const next = clone(parsePrintTemplates(value))
    const nextSignature = JSON.stringify(next)
    if (nextSignature === localSignature) return
    templates.value = next
    localSignature = nextSignature
  },
  { deep: true }
)

watch(
  templates,
  (value) => {
    localSignature = JSON.stringify(value)
    emit('update:modelValue', clone(value))
  },
  { deep: true }
)

const documentTypes = PRINT_DOC_TYPES
const activeDocMeta = computed(() => documentTypes.find(item => item.key === activeDocType.value) || documentTypes[0])
const currentTemplate = computed(() => templates.value[activeDocType.value])
const orientationLabel = computed(() => currentTemplate.value.orientation === 'landscape' ? '横向' : '纵向')

const sampleOrder = {
  id: 'SH20260074',
  clinicName: '德良口腔',
  customerName: '陈先生',
  phone: '138 0000 0000',
  address: '佛山市南海区',
  complaintCode: 'FK20260078',
  submitTime: '2026-05-30 09:30',
  receivedTime: '2026-05-30',
  completedTime: '2026-06-02',
  status: '已完成',
  paymentStatus: 'paid',
  paymentMethod: 'bank_transfer',
  invoiceStatus: '已开票',
  printRemark: '设备已完成检测、维修和功能复核。',
  itemsList: [
    {
      product_name: '根管预备机',
      product_model: 'T-Fine-II',
      unit: '支',
      quantity: 1,
      batch_no: '20E19 246',
      fault_desc: '不好充电，机芯卡',
      fix_solution: '更换机芯、充电顶针',
      coverage_result: 'free'
    }
  ],
  quoteDetail: {
    parts: [
      { name: '机芯组件', spec: 'T-Fine-II', unitPrice: 380, quantity: 1, amount: 380 }
    ],
    services: [
      { name: '拆机检测与维修', unitPrice: 200, quantity: 1, amount: 200 }
    ],
    others: [
      { name: '回寄运费', unitPrice: 20, quantity: 1, amount: 20 }
    ],
    parts_total: 380,
    services_total: 200,
    others_total: 20,
    final_price: 600,
    remark: '报价含检测、维修和回寄费用。'
  }
}

const previewHtml = computed(() => createPrintPreviewHtml(
  sampleOrder,
  currentTemplate.value,
  activeDocType.value
))
const previewSignature = computed(() => activeDocType.value + ':' + JSON.stringify(currentTemplate.value || {}))

const groupLabels = {
  meta: '单据信息',
  info: '基本信息',
  item: '明细表格',
  section: '费用明细',
  total: '金额合计',
  footer: '单据下方',
  signature: '签字栏',
  extra: '补充项目'
}

const groupLabel = (group) => groupLabels[group] || '打印项目'

const canMoveField = (index, offset) => {
  const fields = currentTemplate.value.fields || []
  const target = index + offset
  return Boolean(fields[index]?.custom && fields[target]?.custom)
}

const moveField = (index, offset) => {
  const fields = currentTemplate.value.fields
  const target = index + offset
  if (!canMoveField(index, offset)) return
  ;[fields[index], fields[target]] = [fields[target], fields[index]]
}

const addCustomField = () => {
  currentTemplate.value.fields.push({
    key: 'custom_' + Date.now(),
    label: '自定义项目',
    group: ['repair_order', 'inspection_report'].includes(activeDocType.value) ? 'item' : 'extra',
    visible: true,
    width: 10,
    defaultValue: '',
    custom: true
  })
}

const removeField = (index) => {
  const item = currentTemplate.value.fields[index]
  if (!item || !item.custom) return
  currentTemplate.value.fields.splice(index, 1)
}

const resetCurrentTemplate = () => {
  templates.value[activeDocType.value] = defaultPrintTemplate(activeDocType.value)
}

const testPrint = () => {
  openPrintWindow([sampleOrder], currentTemplate.value, activeDocType.value)
}
</script>

<style scoped>
.print-template-editor {
  margin-top: 20px;
  border: 1px solid #e5eefb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  container-type: inline-size;
}

.print-editor-toolbar {
  min-height: 72px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #e5eefb;
}

.print-editor-toolbar h2 {
  margin: 0;
  color: #1d2129;
  font-size: 18px;
  line-height: 1.35;
}

.print-editor-toolbar p {
  margin: 4px 0 0;
  color: #86909c;
  font-size: 12px;
}

.print-editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.print-editor-grid {
  display: grid;
  grid-template-columns: 132px minmax(360px, 1fr) minmax(272px, 304px);
  min-height: 760px;
}

.print-editor-nav {
  padding: 16px 10px;
  border-right: 1px solid #e5eefb;
  background: #fbfdff;
}

.panel-label {
  margin: 0 10px 10px;
  color: #86909c;
  font-size: 12px;
}

.document-nav-item {
  width: 100%;
  min-height: 58px;
  padding: 10px 12px;
  border: 0;
  border-left: 3px solid transparent;
  background: transparent;
  color: #4e5969;
  text-align: left;
  cursor: pointer;
}

.document-nav-item + .document-nav-item {
  border-top: 1px solid #f0f2f5;
}

.document-nav-item span,
.document-nav-item small {
  display: block;
}

.document-nav-item span {
  font-size: 14px;
  font-weight: 700;
}

.document-nav-item small {
  margin-top: 4px;
  color: #a8b1c0;
  font-size: 11px;
}

.document-nav-item.is-active {
  border-left-color: #165dff;
  background: #eef5ff;
  color: #165dff;
}

.print-preview-workspace {
  min-width: 0;
  background: #eef1f5;
}

.preview-head {
  height: 52px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #dce3ec;
  background: #f7f8fa;
}

.preview-head > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.preview-head strong {
  color: #1d2129;
  font-size: 14px;
}

.preview-head span {
  color: #86909c;
  font-size: 12px;
}

.preview-status {
  color: #165dff !important;
  font-weight: 600;
}

.preview-frame-wrap {
  height: 708px;
  padding: 14px;
}

.print-preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: #eef1f5;
}

.print-properties {
  height: 760px;
  overflow-y: auto;
  border-left: 1px solid #e5eefb;
  background: #fff;
}

.property-section {
  padding: 16px;
  border-bottom: 1px solid #e5eefb;
}

.property-section-head {
  margin-bottom: 14px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.property-section-head strong,
.property-section-head span {
  display: block;
}

.property-section-head strong {
  color: #1d2129;
  font-size: 14px;
}

.property-section-head span {
  margin-top: 3px;
  color: #86909c;
  font-size: 11px;
}

.property-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.property-grid :deep(.el-input-number),
.property-grid :deep(.el-select) {
  width: 100%;
}

.switch-row {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #4e5969;
  font-size: 13px;
}

.field-editor-list {
  display: flex;
  flex-direction: column;
}

.field-editor-row {
  padding: 10px 0;
  border-top: 1px solid #f0f2f5;
}

.field-editor-row:first-child {
  border-top: 0;
  padding-top: 0;
}

.field-editor-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.field-editor-copy {
  flex: 1;
  min-width: 0;
}

.field-label-locked {
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.field-label-locked strong {
  min-width: 0;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-label-locked small {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 999px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
}

.field-editor-copy span {
  display: block;
  margin-top: 3px;
  color: #a8b1c0;
  font-size: 10px;
}

.field-row-actions {
  display: flex;
  align-items: center;
  gap: 0;
}

.field-editor-extra {
  margin: 8px 0 0 38px;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: #86909c;
  font-size: 11px;
}

.field-editor-extra :deep(.el-input-number) {
  width: 100%;
}

@container (max-width: 820px) {
  .print-editor-grid {
    grid-template-columns: 124px minmax(360px, 1fr);
  }

  .print-properties {
    grid-column: 1 / -1;
    height: auto;
    border-top: 1px solid #e5eefb;
    border-left: 0;
  }
}

@container (max-width: 600px) {
  .print-editor-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .print-editor-actions {
    justify-content: flex-start;
  }

  .print-editor-grid {
    display: block;
  }

  .print-editor-nav {
    display: flex;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid #e5eefb;
  }

  .panel-label {
    display: none;
  }

  .document-nav-item {
    min-width: 132px;
    border-top: 0 !important;
    border-left: 0;
    border-bottom: 3px solid transparent;
  }

  .document-nav-item.is-active {
    border-bottom-color: #165dff;
  }

  .preview-frame-wrap {
    height: 560px;
    padding: 8px;
  }

  .property-grid {
    grid-template-columns: 1fr;
  }
}
</style>
