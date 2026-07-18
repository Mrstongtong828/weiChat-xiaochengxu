<template>
  <div class="faultdb-container">
    <div class="glass-card faultdb-sidebar">
      <div class="section-title">
        <div>
          <span>产品分类</span>
          <p class="section-desc">先选择分类，再维护故障知识。</p>
        </div>
        <div class="title-actions">
          <el-button type="primary" link @click="openCatDialog(null)"><el-icon><Plus /></el-icon></el-button>
        </div>
      </div>
      <div
        v-for="cat in categories"
        :key="cat._id"
        class="cat-item"
        :class="{ active: currentCategory && currentCategory._id === cat._id }"
        @click="currentCategory = cat"
      >
        <span>{{ cat.name }}</span>
        <span class="cat-actions">
          <el-button type="primary" link size="small" @click.stop="openCatDialog(cat)">编辑</el-button>
          <el-button type="danger" link size="small" @click.stop="deleteCategoryHandler(cat)">删除</el-button>
        </span>
      </div>
    </div>

    <div class="glass-card" style="flex:1;">
      <el-empty v-if="!currentCategory" description="请选择左侧产品分类，或先新增分类"></el-empty>
      <template v-else>
        <div class="section-title">
          <div>
            <span>「{{ currentCategory.name }}」故障库</span>
            <p class="section-desc">沉淀常见故障现象、确认方式和处理方案，便于客服和工程师快速定位。</p>
          </div>
          <div class="title-actions">
            <el-button type="primary" @click="openFaultDialog(null)" size="small"><el-icon><Plus /></el-icon> 录入</el-button>
          </div>
        </div>
        <div class="table-responsive">
          <el-table :data="currentFaultItems" class="modern-table" style="width:100%;" v-loading="loading">
            <template #empty>
              <div class="table-empty-guide">
                <strong>暂无故障知识</strong>
                <span>点击“录入”添加该分类的故障现象、排查步骤和处理方式。</span>
              </div>
            </template>
            <el-table-column prop="name" label="故障现象" width="150">
              <template #default="{ row }"><span class="cell-primary">{{ row.name || '-' }}</span></template>
            </el-table-column>
            <el-table-column prop="desc" label="相关问题" show-overflow-tooltip></el-table-column>
            <el-table-column prop="checkSteps" label="确认方式" show-overflow-tooltip></el-table-column>
            <el-table-column prop="solution" label="处理方式" show-overflow-tooltip></el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="160"></el-table-column>
            <el-table-column label="操作" width="130" align="right" fixed="right">
              <template #default="{row}">
                <el-button type="primary" link @click="openFaultDialog(row)">编辑</el-button>
                <el-button type="danger" link @click="deleteFaultHandler(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </div>
  </div>

  <el-dialog v-model="catDialogVisible" :title="isEdit ? '编辑分类' : '新增分类'" width="420px" align-center>
    <el-form :model="catForm" label-width="90px">
      <el-form-item label="分类名称"><el-input v-model.trim="catForm.name" placeholder="请输入分类名称"></el-input></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="catDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveCategory">确定</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="faultDialogVisible" :title="isEdit ? '编辑故障' : '新增故障'" width="560px" align-center>
    <el-form :model="faultForm" label-width="90px">
      <el-form-item label="故障现象"><el-input v-model.trim="faultForm.name" placeholder="请输入故障现象"></el-input></el-form-item>
      <el-form-item label="相关问题"><el-input v-model="faultForm.desc" type="textarea" :rows="3" placeholder="多个内容可用分号或换行分隔"></el-input></el-form-item>
      <el-form-item label="确认方式"><el-input v-model="faultForm.checkSteps" type="textarea" :rows="3" placeholder="请输入排查或确认步骤"></el-input></el-form-item>
      <el-form-item label="处理方式"><el-input v-model="faultForm.solution" type="textarea" :rows="4" placeholder="请输入处理方式"></el-input></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="faultDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveFault">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCategoryList, addCategory, editCategory, deleteCategory, getFaultList, addFault, editFault, deleteFault } from '../api/kb.js'

const loading = ref(false)
const categories = ref([])
const allFaultItems = ref([])
const currentCategory = ref(null)
const isEdit = ref(false)
const catDialogVisible = ref(false)
const faultDialogVisible = ref(false)
const catForm = reactive({ _id: null, name: '' })
const faultForm = reactive({ _id: null, name: '', desc: '', checkSteps: '', solution: '' })

const currentFaultItems = computed(() =>
  currentCategory.value ? allFaultItems.value.filter(f => f.catId === currentCategory.value._id) : []
)

const splitTextList = (value) => String(value || '').split(/\n|\uFF1B|;/).map(item => item.trim()).filter(Boolean)

const loadCategories = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getCategoryList(token)
    categories.value = data.map(c => ({ _id: c._id, name: c.category_name, status: c.status, sort: c.sort }))
    if (categories.value.length > 0 && !currentCategory.value) currentCategory.value = categories.value[0]
  } catch (error) {
    ElMessage.error(error.message || '加载分类失败')
  } finally {
    loading.value = false
  }
}

const loadFaults = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getFaultList(token)
    allFaultItems.value = data.map(f => ({
      _id: f._id,
      catId: f.category_id,
      name: f.fault_name,
      desc: f.related_questions?.join('；') || '',
      checkSteps: f.check_steps?.join('；') || '',
      solution: f.fix_solutions?.join('；') || '',
      createdAt: f.create_time ? new Date(f.create_time).toLocaleString() : ''
    }))
  } catch (error) {
    ElMessage.error(error.message || '加载故障库失败')
  } finally {
    loading.value = false
  }
}

const openCatDialog = (cat) => {
  isEdit.value = Boolean(cat)
  catForm._id = cat ? cat._id : null
  catForm.name = cat ? cat.name : ''
  catDialogVisible.value = true
}

const saveCategory = async () => {
  if (!catForm.name) { ElMessage.warning('请输入分类名称'); return }
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const data = { category_name: catForm.name, status: '上架', sort: 0 }
    if (isEdit.value) {
      await editCategory(token, catForm._id, data)
      ElMessage.success('分类编辑成功')
    } else {
      await addCategory(token, data)
      ElMessage.success('分类新增成功')
    }
    catDialogVisible.value = false
    await loadCategories()
  } catch (error) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    loading.value = false
  }
}

const deleteCategoryHandler = (cat) => {
  ElMessageBox.confirm(`确定删除分类“${cat.name}”吗？`, '删除确认', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    loading.value = true
    try {
      const token = localStorage.getItem('adminToken')
      await deleteCategory(token, cat._id)
      ElMessage.success('分类已删除')
      currentCategory.value = null
      await loadCategories()
      await loadFaults()
    } catch (error) {
      ElMessage.error(error.message || '删除失败')
    } finally {
      loading.value = false
    }
  }).catch(() => {})
}

const openFaultDialog = (fault) => {
  isEdit.value = Boolean(fault)
  faultForm._id = fault ? fault._id : null
  faultForm.name = fault ? fault.name : ''
  faultForm.desc = fault ? fault.desc : ''
  faultForm.checkSteps = fault ? fault.checkSteps : ''
  faultForm.solution = fault ? fault.solution : ''
  faultDialogVisible.value = true
}

const saveFault = async () => {
  if (!currentCategory.value) { ElMessage.warning('请先选择产品分类'); return }
  if (!faultForm.name) { ElMessage.warning('请输入故障现象'); return }
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const data = {
      category_id: currentCategory.value._id,
      fault_name: faultForm.name,
      related_questions: splitTextList(faultForm.desc),
      check_steps: splitTextList(faultForm.checkSteps),
      fix_solutions: splitTextList(faultForm.solution),
      is_recommend_repair: false
    }
    if (isEdit.value) {
      await editFault(token, faultForm._id, data)
      ElMessage.success('故障编辑成功')
    } else {
      await addFault(token, data)
      ElMessage.success('故障新增成功')
    }
    faultDialogVisible.value = false
    await loadFaults()
  } catch (error) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    loading.value = false
  }
}

const deleteFaultHandler = (fault) => {
  ElMessageBox.confirm(`确定删除故障“${fault.name}”吗？`, '删除确认', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    loading.value = true
    try {
      const token = localStorage.getItem('adminToken')
      await deleteFault(token, fault._id)
      ElMessage.success('故障已删除')
      await loadFaults()
    } catch (error) {
      ElMessage.error(error.message || '删除失败')
    } finally {
      loading.value = false
    }
  }).catch(() => {})
}

onMounted(() => {
  loadCategories()
  loadFaults()
})
</script>

<style scoped>
.faultdb-container { display: flex; gap: 20px; }
.faultdb-sidebar { width: 280px; flex-shrink: 0; }
.glass-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; }
.section-title { font-size: 16px; font-weight: 600; color: #1d2129; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
.cat-item { padding: 12px 16px; margin-bottom: 8px; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; background: #f7f8fa; color: #4e5969; }
.cat-item.active { background: #e8f3ff; color: #165DFF; font-weight: 600; }
.cat-actions { display:flex; gap:6px; }
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 800px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 12px 0; }
@media screen and (max-width: 768px) {
  .faultdb-container { flex-direction: column; }
  .faultdb-sidebar { width: 100% !important; margin-bottom: 16px; }
}
</style>
