<template>
  <div>
    <div class="vivid-banner">
      <h2>专业医疗设备维保</h2>
      <p>高效 · 精准 · 数字化服务体系</p>
    </div>

    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :md="8">
        <div class="glass-card clickable-card" @click="navigateTo('workorder', '')">
          <div class="section-title">待处理工单 <el-tag type="danger" round size="small">急</el-tag></div>
          <div style="font-size: 36px; font-weight: bold; color: #165DFF;">{{ stats.pendingCount }} <span style="font-size:14px;color:#86909c;font-weight:normal;">件</span></div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8">
        <div class="glass-card clickable-card" @click="navigateTo('workorder', '')">
          <div class="section-title">今日新增报修</div>
          <div style="font-size: 36px; font-weight: bold; color: #1d2129;">{{ stats.todayCount }} <span style="font-size:14px;color:#86909c;font-weight:normal;">件</span></div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8">
        <div class="glass-card clickable-card" @click="navigateTo('feedback', '')">
          <div class="section-title">未读投诉/建议</div>
          <div style="font-size: 36px; font-weight: bold; color: #FF7D00;">{{ stats.unreadCount }} <span style="font-size:14px;color:#86909c;font-weight:normal;">条</span></div>
        </div>
      </el-col>
    </el-row>

    <div class="todo-section">
      <div class="todo-header">
        <h3>待办中心</h3>
        <el-tag v-if="todoError" type="danger" effect="plain">{{ todoError }}</el-tag>
      </div>
      <el-row v-loading="todoLoading" :gutter="16">
        <el-col v-for="item in todoGroups" :key="item.key" :xs="24" :sm="12" :md="8">
          <div class="glass-card todo-card" @click="navigateTodo(item.key)">
            <div class="todo-title">
              <span>{{ item.title }}</span>
              <el-tag :type="item.count ? 'warning' : 'info'" round size="small">{{ item.count }} 件</el-tag>
            </div>
            <div class="todo-desc">{{ item.desc }}</div>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getStatistics, getTodoSummary } from '../api/order.js'
import { getFeedbackStats } from '../api/admin.js'

const router = useRouter()
const stats = ref({ pendingCount: 0, todayCount: 0, unreadCount: 0 })
const todoGroups = ref([])
const todoLoading = ref(false)
const todoError = ref('')

const loadStats = async () => {
  const token = localStorage.getItem('adminToken')
  if (!token) {
    router.push('/login')
    return
  }
  todoLoading.value = true
  todoError.value = ''
  try {
    const [orderStats, feedbackStats, todoSummary] = await Promise.all([
      getStatistics(token),
      getFeedbackStats(token),
      getTodoSummary(token)
    ])
    stats.value = {
      pendingCount: orderStats.pendingCount || 0,
      todayCount: orderStats.todayCount || 0,
      unreadCount: feedbackStats.unreadCount || 0
    }
    todoGroups.value = Array.isArray(todoSummary.groups) ? todoSummary.groups : []
  } catch (e) {
    console.error('加载统计数据失败:', e)
    todoError.value = e.message || '待办数据加载失败'
    ElMessage.error(todoError.value)
  } finally {
    todoLoading.value = false
  }
}

const navigateTo = (menu, filterValue) => {
  router.push({ path: '/' + menu, query: filterValue ? { filter: filterValue } : {} })
}

const navigateTodo = (todoType) => {
  router.push({ path: '/workorder', query: { todo: todoType } })
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.vivid-banner {
  background: linear-gradient(135deg, rgba(22, 93, 255, 0.85) 0%, rgba(106, 176, 255, 0.85) 100%),
              url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80') center/cover no-repeat;
  border-radius: 16px; padding: 40px; color: #fff; position: relative; overflow: hidden;
  box-shadow: 0 8px 20px rgba(22, 93, 255, 0.15); margin-bottom: 24px;
}
.vivid-banner h2 { margin: 0 0 12px; font-size: 28px; font-weight: 600; letter-spacing: 2px; }
.vivid-banner p { margin: 0; font-size: 15px; opacity: 0.9; }

.glass-card {
  background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; border: none;
}
.clickable-card { cursor: pointer; transition: all 0.3s ease; border: 1px solid transparent; }
.clickable-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(22, 93, 255, 0.12);
  border-color: var(--el-color-primary-light-9);
}
.section-title {
  font-size: 16px; font-weight: 600; color: #1d2129; margin-bottom: 16px;
  display: flex; align-items: center; justify-content: space-between;
}
.todo-section { margin-top: 4px; }
.todo-header {
  display: flex; align-items: center; justify-content: space-between;
  margin: 8px 0 16px;
}
.todo-header h3 { margin: 0; font-size: 18px; color: #1d2129; }
.todo-card { min-height: 112px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s ease; }
.todo-card:hover { transform: translateY(-2px); border-color: var(--el-color-primary-light-7); }
.todo-title {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 16px; font-weight: 600; color: #1d2129; margin-bottom: 12px;
}
.todo-desc { color: #86909c; line-height: 1.5; font-size: 13px; }

@media screen and (max-width: 768px) {
  .vivid-banner { padding: 24px 20px; }
  .vivid-banner h2 { font-size: 22px; letter-spacing: 1px; }
  .vivid-banner p { font-size: 13px; }
}
</style>
