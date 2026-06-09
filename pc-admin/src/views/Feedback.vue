<template>
  <div class="glass-card">
    <div class="section-title">
      <span>客户投诉与建议列表</span>
      <el-select v-model="feedbackFilter" placeholder="状态筛选" style="width: 140px;">
        <el-option label="全部" value="全部"></el-option>
        <el-option label="待处理" value="待处理"></el-option>
        <el-option label="已处理" value="已处理"></el-option>
      </el-select>
    </div>
    <div class="table-responsive">
      <el-table :data="filteredFeedbackList" class="modern-table" style="width: 100%;">
        <el-table-column prop="submitTime" label="提交时间" width="160"></el-table-column>
        <el-table-column prop="type" label="反馈类型" width="110">
          <template #default="{row}">
            <el-tag :type="row.type === '投诉' ? 'danger' : 'primary'" effect="light">{{row.type}}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户姓名" width="120"></el-table-column>
        <el-table-column prop="phone" label="联系电话" width="140"></el-table-column>
        <el-table-column prop="content" label="反馈内容" show-overflow-tooltip></el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status === '未读' ? 'warning' : 'success'" effect="light">{{row.status}}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right" align="right">
          <template #default="{row}">
            <el-button type="primary" link @click="openFeedbackDialog(row)">查看并处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>

  <el-dialog v-model="feedbackDialogVisible" title="反馈处理" width="560px" align-center>
    <template v-if="currentFeedback">
      <div style="background:#f7f8fa; border-radius:10px; padding:16px; margin-bottom:18px; line-height:1.8;">
        <div><span style="color:#86909c;">姓名：</span><span style="color:#1d2129; font-weight:600;">{{currentFeedback.customerName}}</span></div>
        <div><span style="color:#86909c;">电话：</span><span style="color:#1d2129;">{{currentFeedback.phone}}</span></div>
        <div><span style="color:#86909c;">完整内容：</span><span style="color:#1d2129;">{{currentFeedback.content}}</span></div>
      </div>
      <el-input v-model="replyText" type="textarea" :rows="4" placeholder="请填写跟进处理记录..."></el-input>
    </template>
    <template #footer>
      <el-button @click="feedbackDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="markFeedbackHandled">标记为已处理</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getFeedbackList } from '../api/admin.js'

const feedbackFilter = ref('全部')
const feedbackDialogVisible = ref(false)
const currentFeedback = ref(null)
const replyText = ref('')
const feedbackList = ref([])

const loadFeedbackList = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getFeedbackList(token, feedbackFilter.value === '全部' ? undefined : feedbackFilter.value)
    feedbackList.value = data.map(item => ({
      _id: item._id,
      id: item._id,
      submitTime: item.create_time ? new Date(item.create_time).toLocaleString('zh-CN', { hour12: false }) : '',
      type: item.type,
      customerName: item.contact_value || '未提供',
      phone: item.contact_value || '',
      content: item.content,
      status: item.status
    }))
  } catch (error) {
    ElMessage.error('加载反馈列表失败')
  }
}

const filteredFeedbackList = computed(() =>
  feedbackFilter.value === '全部' ? feedbackList.value : feedbackList.value.filter(f => f.status === feedbackFilter.value)
)

const openFeedbackDialog = (row) => {
  currentFeedback.value = row
  replyText.value = ''
  feedbackDialogVisible.value = true
}

const markFeedbackHandled = () => {
  if (currentFeedback.value) currentFeedback.value.status = '已处理'
  feedbackDialogVisible.value = false
  ElMessage.success('处理记录已保存')
}

onMounted(() => {
  loadFeedbackList()
})
</script>

<style scoped>
.glass-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; }
.section-title { font-size: 16px; font-weight: 600; color: #1d2129; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 800px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 12px 0; }
</style>
