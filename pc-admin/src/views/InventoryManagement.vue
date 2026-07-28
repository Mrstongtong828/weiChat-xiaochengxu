<template>
  <div class="glass-card inventory-page">
    <div class="section-title">
      <div>
        <span>配件库存管理</span>
        <p class="section-desc">维护报价可选配件、库存预警和出入库流水，避免维修报价后才发现缺货。</p>
      </div>
      <div class="title-actions">
        <el-button size="small" @click="downloadTemplate">
          下载模板
        </el-button>
        <el-button size="small" :loading="exporting" @click="exportInventory">
          <el-icon><Download /></el-icon> 导出库存
        </el-button>
        <el-button size="small" type="primary" plain @click="openImportDialog">
          <el-icon><Upload /></el-icon> 批量导入
        </el-button>
        <el-button size="small" plain :loading="importingSamples" @click="importSampleParts">
          <el-icon><Upload /></el-icon> 导入示例配件
        </el-button>
        <el-button type="primary" size="small" @click="openPartDialog(null)">
          <el-icon><Plus /></el-icon> 新增配件
        </el-button>
      </div>
    </div>

    <div class="inventory-toolbar">
      <el-input v-model="filters.keyword" clearable placeholder="搜索编码 / 名称 / 型号" style="width: 260px;" @keyup.enter="loadParts"></el-input>
      <el-select v-model="filters.stockStatus" clearable placeholder="库存状态" style="width: 140px;">
        <el-option label="低库存" value="low"></el-option>
        <el-option label="无库存" value="out"></el-option>
      </el-select>
      <el-button type="primary" plain @click="loadParts">查询</el-button>
      <span v-if="selectedParts.length" class="selection-count">已选 {{ selectedParts.length }} 个</span>
      <el-button
        type="warning"
        plain
        :disabled="!selectedEnabledParts.length"
        :loading="batchUpdating"
        @click="disableSelectedParts"
      >
        <el-icon><CircleClose /></el-icon> 批量禁用
      </el-button>
    </div>

    <div class="table-responsive">
      <el-table :data="parts" class="modern-table" style="width:100%;" v-loading="loading" @selection-change="handleSelectionChange">
        <template #empty>
          <div class="table-empty-guide">
            <strong>暂无配件库存</strong>
            <span>点击“新增配件”手工录入，或导入常用牙科仪器检修配件示例，后续报价弹窗会自动引用库存和售价。</span>
          </div>
        </template>
        <el-table-column type="selection" width="46"></el-table-column>
        <el-table-column prop="part_code" label="配件编码" width="180" show-overflow-tooltip></el-table-column>
        <el-table-column prop="part_name" label="配件名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }"><span class="cell-primary">{{ row.part_name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="model" label="型号" width="130" show-overflow-tooltip></el-table-column>
        <el-table-column label="适配机型" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ (row.compatible_models || row.compatibleModels || []).join('、') || '-' }}</template>
        </el-table-column>
        <el-table-column label="销售单价" width="120">
          <template #default="{ row }">¥{{ Number(row.sale_price || row.salePrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="库存" width="130">
          <template #default="{ row }">
            <el-tag :type="row.lowStock ? 'warning' : (Number(row.stock || 0) <= 0 ? 'danger' : 'success')" effect="plain">
              {{ row.stock || 0 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预警阈值" width="110">
          <template #default="{ row }">{{ row.warning_threshold || row.warningThreshold || 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="130">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" active-text="启用" inactive-text="禁用" @change="togglePart(row)"></el-switch>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="right" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openPartDialog(row)">编辑</el-button>
            <el-button type="info" link @click="openFlowDialog(row)">流水</el-button>
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

    <el-dialog v-model="partDialogVisible" :title="partForm._id ? '编辑配件' : '新增配件'" width="620px" align-center>
      <el-form :model="partForm" label-width="96px">
        <el-form-item label="配件编码"><el-input v-model.trim="partForm.part_code" placeholder="如 PART-HANDPIECE-BEARING"></el-input></el-form-item>
        <el-form-item label="配件名称"><el-input v-model.trim="partForm.part_name" placeholder="请输入配件名称"></el-input></el-form-item>
        <el-form-item label="型号"><el-input v-model.trim="partForm.model" placeholder="请输入型号"></el-input></el-form-item>
        <el-form-item label="适配机型">
          <el-select v-model="partForm.compatible_models" multiple filterable allow-create default-first-option style="width:100%;" placeholder="输入后回车添加"></el-select>
        </el-form-item>
        <el-form-item v-if="canViewCost" label="采购成本"><el-input-number v-model="partForm.purchase_cost" :min="0" :precision="2" controls-position="right" style="width:100%;"></el-input-number></el-form-item>
        <el-form-item label="销售单价"><el-input-number v-model="partForm.sale_price" :min="0" :precision="2" controls-position="right" style="width:100%;"></el-input-number></el-form-item>
        <el-form-item label="当前库存"><el-input-number v-model="partForm.stock" :min="0" :precision="0" controls-position="right" style="width:100%;"></el-input-number></el-form-item>
        <el-form-item label="预警阈值"><el-input-number v-model="partForm.warning_threshold" :min="0" :precision="0" controls-position="right" style="width:100%;"></el-input-number></el-form-item>
        <el-form-item label="备注"><el-input v-model="partForm.remark" type="textarea" :rows="2"></el-input></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="partDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitPart">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="批量导入配件库存" width="760px" align-center @closed="resetImportDialog">
      <div class="import-tip">
        <el-button link type="primary" @click="downloadTemplate">下载导入模板</el-button>
        <span class="muted">按配件编码识别；库存覆盖只在“库存盘点覆盖”模式生效。</span>
      </div>
      <el-radio-group v-model="importMode" class="import-mode-group">
        <el-radio-button label="insert_only">仅新增</el-radio-button>
        <el-radio-button label="upsert">新增并更新资料</el-radio-button>
        <el-radio-button label="stocktake">库存盘点覆盖</el-radio-button>
      </el-radio-group>
      <el-alert
        class="import-mode-alert"
        :title="importModeHelp"
        type="info"
        :closable="false"
        show-icon
      />
      <el-upload drag :auto-upload="false" :show-file-list="true" :limit="1" accept=".xlsx,.xls" :on-change="onImportFile">
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽 Excel 到此处，或<em>点击选择文件</em></div>
      </el-upload>
      <div v-if="importPreview.length" class="import-preview-summary">
        已解析 <strong>{{ importPreview.length }}</strong> 条，预览前 8 条。
      </div>
      <el-table v-if="importPreview.length" :data="importPreview.slice(0, 8)" size="small" max-height="240" class="import-preview-table">
        <el-table-column prop="row" label="行号" width="70" />
        <el-table-column prop="part_code" label="配件编码" min-width="180" show-overflow-tooltip />
        <el-table-column prop="part_name" label="配件名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="sale_price" label="销售单价" width="100" />
        <el-table-column prop="stock" label="库存" width="80" />
      </el-table>
      <div v-if="importResult" class="import-result">
        <el-alert
          :title="`导入完成：新增 ${importResult.created} 条，更新 ${importResult.updated} 条，跳过 ${importResult.skipped} 条，失败 ${importResult.failed.length} 条`"
          :type="importResult.failed.length ? 'warning' : 'success'"
          :closable="false"
        />
        <el-table v-if="importResult.failed.length" :data="importResult.failed" size="small" max-height="220" class="import-preview-table">
          <el-table-column prop="row" label="行号" width="70" />
          <el-table-column prop="part_code" label="配件编码" min-width="160" show-overflow-tooltip />
          <el-table-column prop="part_name" label="配件名称" min-width="130" show-overflow-tooltip />
          <el-table-column prop="reason" label="失败原因" min-width="180" show-overflow-tooltip />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importing" :disabled="!importPreview.length" @click="submitImport">开始导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="flowDialogVisible" title="库存流水" width="760px" align-center>
      <el-table :data="flows" v-loading="flowLoading" style="width:100%;">
        <el-table-column prop="flow_type" label="类型" width="100"></el-table-column>
        <el-table-column prop="order_no" label="工单号" width="150" show-overflow-tooltip></el-table-column>
        <el-table-column prop="quantity" label="数量" width="90"></el-table-column>
        <el-table-column label="库存变化" width="140">
          <template #default="{ row }">{{ row.before_stock }} → {{ row.after_stock }}</template>
        </el-table-column>
        <el-table-column prop="operator_name" label="操作人" width="120"></el-table-column>
        <el-table-column prop="remark" label="备注" show-overflow-tooltip></el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchImportParts, batchUpdatePartStatus, exportParts, getPartList, savePart, updatePartStatus, getInventoryFlows } from '../api/inventory.js'
import { getCurrentAdminRole } from '../config/menuAccess.js'
import { downloadPartImportTemplate, exportPartsWorkbook, parsePartExcelFile } from '../utils/inventoryExcel.js'

// 采购成本仅 admin/finance 可见可编辑（后端亦已对其他角色脱敏，前端同步隐藏）
const canViewCost = ['superadmin', 'admin', 'finance'].includes(getCurrentAdminRole())

const parts = ref([])
const flows = ref([])
const loading = ref(false)
const saving = ref(false)
const importingSamples = ref(false)
const importing = ref(false)
const exporting = ref(false)
const batchUpdating = ref(false)
const flowLoading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', stockStatus: '' })
const selectedParts = ref([])
const partDialogVisible = ref(false)
const importDialogVisible = ref(false)
const flowDialogVisible = ref(false)
const importMode = ref('upsert')
const importPreview = ref([])
const importResult = ref(null)
const partForm = reactive({
  _id: '',
  part_code: '',
  part_name: '',
  model: '',
  compatible_models: [],
  purchase_cost: 0,
  sale_price: 0,
  stock: 0,
  warning_threshold: 0,
  remark: ''
})

const sampleParts = [
  { part_code: 'DENT-HP-CARTRIDGE-HS', part_name: '高速手机机芯', model: 'HS-STD', compatible_models: ['高速气涡轮手机', 'NSK Pana-Max', 'KaVo 高速手机'], purchase_cost: 95, sale_price: 180, stock: 12, warning_threshold: 3, remark: '常见于高速手机异响、转速下降、夹针不稳维修' },
  { part_code: 'DENT-HP-BEARING-3.175', part_name: '高速手机陶瓷轴承', model: '3.175mm', compatible_models: ['高速气涡轮手机', '45度手机'], purchase_cost: 18, sale_price: 45, stock: 40, warning_threshold: 10, remark: '适用于手机噪音大、发热、转动阻滞' },
  { part_code: 'DENT-HP-ORING-KIT', part_name: '手机密封圈套装', model: 'O-RING-KIT', compatible_models: ['高速手机', '低速手机', '弯机', '直机'], purchase_cost: 8, sale_price: 25, stock: 60, warning_threshold: 15, remark: '含常用水气路密封圈，处理漏水漏气' },
  { part_code: 'DENT-CA-GEAR-SET', part_name: '弯手机齿轮组', model: 'CA-1:1', compatible_models: ['低速弯手机', '1:1弯机'], purchase_cost: 55, sale_price: 120, stock: 10, warning_threshold: 3, remark: '用于弯机打滑、卡滞、传动异响' },
  { part_code: 'DENT-CA-CHUCK', part_name: '弯手机夹头组件', model: 'CA-CHUCK', compatible_models: ['低速弯手机', '抛光弯机'], purchase_cost: 38, sale_price: 85, stock: 12, warning_threshold: 3, remark: '用于车针夹持不牢、取针困难' },
  { part_code: 'DENT-SCALER-HANDPIECE', part_name: '洁牙机手柄', model: 'SC-H1', compatible_models: ['超声洁牙机', 'EMS兼容洁牙机'], purchase_cost: 85, sale_price: 180, stock: 8, warning_threshold: 2, remark: '用于手柄发热、不震动、接触不良' },
  { part_code: 'DENT-SCALER-CABLE', part_name: '洁牙机手柄线', model: 'SC-CABLE-4P', compatible_models: ['超声洁牙机', '牙周治疗仪'], purchase_cost: 28, sale_price: 70, stock: 15, warning_threshold: 4, remark: '用于线缆断芯、接口接触不良' },
  { part_code: 'DENT-SCALER-TIP-G1', part_name: '洁牙机工作尖', model: 'G1', compatible_models: ['EMS兼容洁牙机', '啄木鸟洁牙机'], purchase_cost: 9, sale_price: 30, stock: 50, warning_threshold: 12, remark: '常规龈上洁治工作尖' },
  { part_code: 'DENT-CURING-BATTERY', part_name: '光固化机锂电池', model: '18650-2200mAh', compatible_models: ['无线光固化机', 'LED光固化灯'], purchase_cost: 32, sale_price: 85, stock: 16, warning_threshold: 4, remark: '用于续航短、无法开机、充电异常' },
  { part_code: 'DENT-CURING-LED-MODULE', part_name: '光固化机LED灯珠模块', model: '5W-450nm', compatible_models: ['LED光固化机', '无线光固化灯'], purchase_cost: 48, sale_price: 110, stock: 8, warning_threshold: 2, remark: '用于光强不足、灯珠不亮' },
  { part_code: 'DENT-CURING-LIGHTGUIDE', part_name: '光固化机导光棒', model: '8mm', compatible_models: ['光固化机', 'LED固化灯'], purchase_cost: 22, sale_price: 65, stock: 10, warning_threshold: 3, remark: '用于导光棒破损、透光率下降' },
  { part_code: 'DENT-CHAIR-SOLENOID-24V', part_name: '牙椅水气电磁阀', model: 'DC24V', compatible_models: ['综合治疗椅', '牙椅水路气路'], purchase_cost: 45, sale_price: 110, stock: 10, warning_threshold: 3, remark: '用于水气不通、关不严、阀体漏气' },
  { part_code: 'DENT-CHAIR-FOOTSWITCH', part_name: '牙椅脚踏开关组件', model: 'FS-4WAY', compatible_models: ['综合治疗椅', '脚踏控制器'], purchase_cost: 75, sale_price: 160, stock: 6, warning_threshold: 2, remark: '用于脚踏失灵、按键无反馈、线缆损坏' },
  { part_code: 'DENT-3WAY-VALVECORE', part_name: '三用枪阀芯', model: '3WAY-CORE', compatible_models: ['三用枪', '牙椅水气枪'], purchase_cost: 18, sale_price: 55, stock: 24, warning_threshold: 6, remark: '用于三用枪漏水、漏气、按压不回弹' },
  { part_code: 'DENT-SUCTION-FILTER', part_name: '强弱吸过滤网', model: 'SUCTION-FILTER', compatible_models: ['强吸系统', '弱吸系统', '综合治疗椅'], purchase_cost: 6, sale_price: 20, stock: 80, warning_threshold: 20, remark: '耗材类库存，用于吸力下降、管路堵塞维护' },
  { part_code: 'DENT-AUTOCLAVE-GASKET', part_name: '灭菌器门密封圈', model: '18L/23L', compatible_models: ['台式压力蒸汽灭菌器', '18L灭菌器', '23L灭菌器'], purchase_cost: 42, sale_price: 95, stock: 10, warning_threshold: 3, remark: '用于门封老化、漏汽、压力保持失败' },
  { part_code: 'DENT-AUTOCLAVE-HEATER', part_name: '灭菌器加热管', model: '1500W', compatible_models: ['台式灭菌器', '压力蒸汽灭菌器'], purchase_cost: 88, sale_price: 180, stock: 5, warning_threshold: 2, remark: '用于升温慢、不加热、灭菌失败' },
  { part_code: 'DENT-AUTOCLAVE-TEMP-SENSOR', part_name: '灭菌器温度传感器', model: 'PT100', compatible_models: ['台式灭菌器', '高压蒸汽灭菌器'], purchase_cost: 35, sale_price: 90, stock: 8, warning_threshold: 2, remark: '用于温度异常、报警、显示偏差' },
  { part_code: 'DENT-ULTRASONIC-TRANSDUCER', part_name: '超声清洗机换能器', model: '40KHz', compatible_models: ['超声清洗机', '器械清洗槽'], purchase_cost: 55, sale_price: 130, stock: 6, warning_threshold: 2, remark: '用于清洗力度下降、不起振' },
  { part_code: 'DENT-MICROMOTOR-BRUSH', part_name: '微电机碳刷', model: 'MM-BRUSH', compatible_models: ['有刷微电机', '打磨机马达'], purchase_cost: 10, sale_price: 35, stock: 30, warning_threshold: 8, remark: '用于微电机转速不稳、启动困难' }
]

const importModeHelp = computed(() => {
  const map = {
    insert_only: '仅新增：已存在的配件编码会跳过，适合第一次初始化库存。',
    upsert: '新增并更新资料：已有配件会更新名称、型号、价格、阈值、启用状态和备注，但不会覆盖当前库存。',
    stocktake: '库存盘点覆盖：已有配件会按 Excel 当前库存覆盖，并自动生成库存调整流水。'
  }
  return map[importMode.value] || map.upsert
})

const selectedEnabledParts = computed(() => selectedParts.value.filter(row => row.enabled !== false))

const getToken = () => localStorage.getItem('adminToken')
const formatTime = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'

const resetForm = (row = null) => {
  partForm._id = row?._id || ''
  partForm.part_code = row?.part_code || ''
  partForm.part_name = row?.part_name || ''
  partForm.model = row?.model || ''
  partForm.compatible_models = Array.isArray(row?.compatible_models) ? [...row.compatible_models] : []
  partForm.purchase_cost = Number(row?.purchase_cost || 0)
  partForm.sale_price = Number(row?.sale_price || 0)
  partForm.stock = Number(row?.stock || 0)
  partForm.warning_threshold = Number(row?.warning_threshold || 0)
  partForm.remark = row?.remark || ''
}

const loadParts = async () => {
  selectedParts.value = []
  loading.value = true
  try {
    const data = await getPartList(getToken(), {
      keyword: filters.keyword,
      stockStatus: filters.stockStatus,
      page: page.value,
      pageSize: pageSize.value
    })
    parts.value = data.list || []
    total.value = Number(data.total || 0)
  } catch (error) {
    ElMessage.error(error.message || '配件列表加载失败')
  } finally {
    loading.value = false
  }
}

const handleSelectionChange = (rows) => {
  selectedParts.value = rows
}

const disableSelectedParts = async () => {
  const targets = selectedEnabledParts.value
  if (!targets.length) return
  try {
    await ElMessageBox.confirm(
      `确认禁用选中的 ${targets.length} 个配件？禁用后不会出现在报价可选配件中，历史工单和库存流水不受影响。`,
      '批量禁用确认',
      { type: 'warning', confirmButtonText: '确认禁用', cancelButtonText: '取消' }
    )
  } catch (error) {
    return
  }

  batchUpdating.value = true
  try {
    const data = await batchUpdatePartStatus(getToken(), targets.map(row => row._id), false)
    selectedParts.value = []
    await loadParts()
    if (data.failed && data.failed.length) {
      ElMessage.warning(`已禁用 ${data.updated} 个，${data.failed.length} 个处理失败`)
    } else {
      ElMessage.success(`已批量禁用 ${data.updated} 个配件`)
    }
  } catch (error) {
    ElMessage.error(error.message || '批量禁用失败')
  } finally {
    batchUpdating.value = false
  }
}

const downloadTemplate = () => {
  downloadPartImportTemplate().catch(error => ElMessage.error(error.message || '模板下载失败'))
}

const exportInventory = async () => {
  exporting.value = true
  try {
    const data = await exportParts(getToken(), {
      keyword: filters.keyword,
      stockStatus: filters.stockStatus
    })
    const list = data.list || []
    if (!list.length) {
      ElMessage.warning('当前筛选条件下暂无可导出的配件')
      return
    }
    await exportPartsWorkbook(list, { canViewCost })
    if (data.truncated) ElMessage.warning('导出已达到 1000 条上限，如需更多请细化筛选条件')
    else ElMessage.success(`已导出 ${list.length} 条配件库存`)
  } catch (error) {
    ElMessage.error(error.message || '库存导出失败')
  } finally {
    exporting.value = false
  }
}

const openPartDialog = (row) => {
  resetForm(row)
  partDialogVisible.value = true
}

const submitPart = async () => {
  if (!partForm.part_code || !partForm.part_name) {
    ElMessage.warning('请填写配件编码和名称')
    return
  }
  saving.value = true
  try {
    await savePart(getToken(), { ...partForm })
    ElMessage.success('配件已保存')
    partDialogVisible.value = false
    await loadParts()
  } catch (error) {
    ElMessage.error(error.message || '配件保存失败')
  } finally {
    saving.value = false
  }
}

const openImportDialog = () => {
  importDialogVisible.value = true
}

const resetImportDialog = () => {
  importPreview.value = []
  importResult.value = null
  importMode.value = 'upsert'
}

const onImportFile = async (uploadFile) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  try {
    importPreview.value = await parsePartExcelFile(raw)
    importResult.value = null
    if (!importPreview.value.length) ElMessage.warning('未解析到有效配件数据，请检查模板格式')
  } catch (error) {
    ElMessage.error(error.message || 'Excel 解析失败')
  }
}

const submitImport = async () => {
  importing.value = true
  try {
    const data = await batchImportParts(getToken(), importPreview.value, importMode.value)
    importResult.value = { ...data, failed: data.failed || [] }
    importPreview.value = []
    ElMessage.success(`导入完成：新增 ${data.created}，更新 ${data.updated}，跳过 ${data.skipped}，失败 ${(data.failed || []).length}`)
    await loadParts()
  } catch (error) {
    ElMessage.error(error.message || '批量导入失败')
  } finally {
    importing.value = false
  }
}

const importSampleParts = async () => {
  try {
    await ElMessageBox.confirm(
      '将导入常用牙科仪器检修配件示例。已存在的配件编码会自动跳过，不会覆盖现有库存。确定继续？',
      '导入示例配件',
      { type: 'info' }
    )
  } catch (error) {
    return
  }

  importingSamples.value = true
  try {
    const token = getToken()
    const existing = await getPartList(token, { page: 1, pageSize: 100 })
    const existingCodes = new Set((existing.list || []).map(item => item.part_code || item.partCode).filter(Boolean))
    let created = 0
    let skipped = 0
    let failed = 0

    for (const sample of sampleParts) {
      if (existingCodes.has(sample.part_code)) {
        skipped += 1
        continue
      }
      const payload = canViewCost ? { ...sample } : { ...sample, purchase_cost: 0 }
      try {
        await savePart(token, payload)
        existingCodes.add(sample.part_code)
        created += 1
      } catch (error) {
        if (String(error.message || '').includes('配件编码已存在')) {
          skipped += 1
        } else {
          failed += 1
        }
      }
    }

    filters.keyword = ''
    filters.stockStatus = ''
    page.value = 1
    await loadParts()
    const summary = `已导入 ${created} 个示例配件，跳过 ${skipped} 个已存在配件`
    if (failed) ElMessage.warning(`${summary}，${failed} 个导入失败`)
    else ElMessage.success(summary)
  } catch (error) {
    ElMessage.error(error.message || '示例配件导入失败')
  } finally {
    importingSamples.value = false
  }
}

const togglePart = async (row) => {
  try {
    await updatePartStatus(getToken(), row._id, row.enabled)
    ElMessage.success(row.enabled ? '配件已启用' : '配件已禁用')
  } catch (error) {
    row.enabled = !row.enabled
    ElMessage.error(error.message || '状态更新失败')
  }
}

const openFlowDialog = async (row) => {
  flowDialogVisible.value = true
  flowLoading.value = true
  try {
    const data = await getInventoryFlows(getToken(), { part_id: row._id, page: 1, pageSize: 50 })
    flows.value = data.list || []
  } catch (error) {
    ElMessage.error(error.message || '库存流水加载失败')
  } finally {
    flowLoading.value = false
  }
}

watch([page, pageSize], loadParts)
onMounted(loadParts)
</script>

<style scoped>
.inventory-page { min-height: 520px; }
.inventory-toolbar { display: flex; align-items: center; gap: 10px; margin: 16px 0 18px; flex-wrap: wrap; }
.selection-count { color: #1769aa; font-size: 12px; font-weight: 600; }
.pager { margin-top: 16px; justify-content: flex-end; }
.import-tip { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.muted { color: #86909c; font-size: 12px; }
.import-mode-group { margin-bottom: 10px; }
.import-mode-alert { margin-bottom: 12px; }
.import-preview-summary { margin: 12px 0 8px; color: #4e5969; font-size: 13px; }
.import-preview-table { margin-top: 8px; }
.import-result { margin-top: 12px; }
</style>
