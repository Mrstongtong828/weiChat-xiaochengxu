<template>
  <div class="glass-card inventory-page">
    <div class="section-title">
      <div>
        <span>配件库存管理</span>
        <p class="section-desc">维护报价可选配件、库存预警和出入库流水，避免维修报价后才发现缺货。</p>
      </div>
      <div class="title-actions">
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
    </div>

    <div class="table-responsive">
      <el-table :data="parts" class="modern-table" style="width:100%;" v-loading="loading">
        <template #empty>
          <div class="table-empty-guide">
            <strong>暂无配件库存</strong>
            <span>点击“新增配件”录入常用维修配件，后续报价弹窗会自动引用库存和售价。</span>
          </div>
        </template>
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
import { reactive, ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getPartList, savePart, updatePartStatus, getInventoryFlows } from '../api/inventory.js'
import { getCurrentAdminRole } from '../config/menuAccess.js'

// 采购成本仅 admin/finance 可见可编辑（后端亦已对其他角色脱敏，前端同步隐藏）
const canViewCost = ['superadmin', 'admin', 'finance'].includes(getCurrentAdminRole())

const parts = ref([])
const flows = ref([])
const loading = ref(false)
const saving = ref(false)
const flowLoading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', stockStatus: '' })
const partDialogVisible = ref(false)
const flowDialogVisible = ref(false)
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
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
