<template>
  <div class="glass-card">
    <div class="section-title">
      <div>
        <span>用户管理</span>
        <p class="section-desc">管理后台账号、角色权限、负责品类和工程师服务范围。</p>
      </div>
      <div class="title-actions">
        <el-button type="primary" size="small" @click="openUserDialog(null)">
          <el-icon><Plus /></el-icon> 新增用户
        </el-button>
      </div>
    </div>
    <div class="table-responsive">
      <el-table :data="users" class="modern-table" style="width:100%;" v-loading="loading">
        <template #empty>
          <div class="table-empty-guide">
            <strong>暂无后台用户</strong>
            <span>点击“新增用户”创建管理员、工程师、财务或客服账号。</span>
          </div>
        </template>
        <el-table-column prop="name" label="姓名" width="120">
          <template #default="{ row }"><span class="cell-primary">{{ row.name || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="username" label="账号" width="140"></el-table-column>
        <el-table-column prop="phone" label="手机号" width="150"></el-table-column>
        <el-table-column prop="roleDisplay" label="角色" show-overflow-tooltip></el-table-column>
        <el-table-column label="负责品类" show-overflow-tooltip>
          <template #default="{row}">{{ (row.device_categories || []).join('、') || '—' }}</template>
        </el-table-column>
        <el-table-column label="负责区域" show-overflow-tooltip>
          <template #default="{row}">{{ (row.service_areas || []).join('、') || '—' }}</template>
        </el-table-column>
        <el-table-column label="本月完工" width="100" align="center">
          <template #default="{row}">{{ row.completed_count != null ? row.completed_count : '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="160" align="right">
          <template #default="{row}">
            <el-tag v-if="isCurrentUser(row)" type="info" effect="plain">当前账号</el-tag>
            <el-switch v-else v-model="row.active" active-text="启用" inactive-text="禁用" @change="toggleUserStatus(row)"></el-switch>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right" align="right">
          <template #default="{row}">
            <el-button type="primary" link @click="openUserDialog(row)">编辑</el-button>
            <span class="risk-actions">
              <el-button type="danger" link :disabled="row.username === 'admin_root'" @click="confirmResetPassword(row)">重置密码</el-button>
              <el-popconfirm v-if="!isCurrentUser(row)" title="确定要禁用该账号吗？" @confirm="deleteUser(row._id)">
                <template #reference>
                  <el-button type="danger" link :disabled="row.username === 'admin_root'">禁用</el-button>
                </template>
              </el-popconfirm>
            </span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>

  <el-dialog v-model="userDialogVisible" :title="isEditUser ? '编辑用户' : '新增用户'" width="460px" align-center>
    <el-form :model="userForm" label-width="90px">
      <el-form-item label="登录账号" v-if="!isEditUser">
        <el-input v-model.trim="userForm.username" placeholder="请输入登录账号"></el-input>
      </el-form-item>
      <el-form-item label="登录密码">
        <el-input v-model="userForm.password" type="password" show-password :placeholder="isEditUser ? '留空则不修改密码' : '请输入登录密码'"></el-input>
      </el-form-item>
      <el-form-item label="姓名">
        <el-input v-model.trim="userForm.name" placeholder="请输入姓名"></el-input>
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model.trim="userForm.phone" placeholder="请输入手机号"></el-input>
      </el-form-item>
      <el-form-item label="角色">
        <el-select v-model="userForm.role" style="width:100%;">
          <el-option label="超级管理员" value="超级管理员"></el-option>
          <el-option label="管理员" value="管理员"></el-option>
          <el-option label="工程师" value="工程师"></el-option>
          <el-option label="财务" value="财务"></el-option>
          <el-option label="客服" value="客服"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="负责品类">
        <el-select v-model="userForm.device_categories" multiple filterable allow-create default-first-option
          placeholder="输入后回车添加，如：综合治疗机" style="width:100%;"></el-select>
      </el-form-item>
      <el-form-item label="负责区域">
        <el-select v-model="userForm.service_areas" multiple filterable allow-create default-first-option
          placeholder="输入后回车添加，如：华东区" style="width:100%;"></el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="userDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveUser" :loading="loading">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getStaffList, addStaff, editStaff, disableStaff, resetUserPassword } from '../api/admin.js'
import { getEngineerPerformance } from '../api/performance.js'

const users = ref([])
const loading = ref(false)

const roleMap = {
  superadmin: '超级管理员',
  admin: '管理员',
  engineer: '工程师',
  finance: '财务',
  support: '客服'
}
const roleMapReverse = {
  超级管理员: 'superadmin',
  管理员: 'admin',
  工程师: 'engineer',
  财务: 'finance',
  客服: 'support'
}

const userDialogVisible = ref(false)
const isEditUser = ref(false)
const userForm = reactive({
  _id: null,
  username: '',
  password: '',
  name: '',
  phone: '',
  role: '工程师',
  device_categories: [],
  service_areas: []
})

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('adminUser') || '{}')
  } catch (error) {
    return {}
  }
}

const isCurrentUser = (user = {}) => {
  const currentUser = getCurrentUser()
  return Boolean(
    (currentUser._id && user._id === currentUser._id) ||
    (currentUser.username && user.username === currentUser.username)
  )
}

const sortCurrentUserFirst = (list = []) => {
  return [...list].sort((a, b) => {
    if (isCurrentUser(a)) return -1
    if (isCurrentUser(b)) return 1
    return 0
  })
}

const loadUsers = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getStaffList(token)
    const perfMap = {}
    try {
      const perf = await getEngineerPerformance({})
      ;(perf.list || []).forEach(p => { perfMap[p.engineer_id] = p.completed_count })
    } catch (e) {
      // 绩效统计失败不应阻断员工列表加载
    }
    users.value = sortCurrentUserFirst(data.map(u => ({
      ...u,
      roleDisplay: roleMap[u.role] || u.role,
      active: !u.disabled,
      completed_count: perfMap[u._id]
    })))
  } catch (error) {
    ElMessage.error(error.message || '加载员工列表失败')
  } finally {
    loading.value = false
  }
}

const openUserDialog = (user) => {
  isEditUser.value = Boolean(user)
  userForm._id = user ? user._id : null
  userForm.username = user ? user.username : ''
  userForm.password = ''
  userForm.name = user ? user.name : ''
  userForm.phone = user ? user.phone : ''
  userForm.role = user ? user.roleDisplay : '工程师'
  userForm.device_categories = user && Array.isArray(user.device_categories) ? [...user.device_categories] : []
  userForm.service_areas = user && Array.isArray(user.service_areas) ? [...user.service_areas] : []
  userDialogVisible.value = true
}

const saveUser = async () => {
  if (!userForm.name || !userForm.phone) {
    ElMessage.warning('请完整填写用户信息')
    return
  }
  if (!isEditUser.value && !userForm.username) {
    ElMessage.warning('请输入登录账号')
    return
  }
  if (!isEditUser.value && !userForm.password) {
    ElMessage.warning('请输入登录密码')
    return
  }

  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const staff = {
      username: userForm.username,
      name: userForm.name,
      phone: userForm.phone,
      role: roleMapReverse[userForm.role] || 'engineer',
      device_categories: userForm.device_categories,
      service_areas: userForm.service_areas
    }
    if (userForm.password) staff.password = userForm.password
    if (isEditUser.value) staff._id = userForm._id

    if (isEditUser.value) {
      await editStaff(token, staff)
      ElMessage.success('用户信息已更新')
    } else {
      await addStaff(token, staff)
      ElMessage.success('用户已新增')
    }
    userDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    loading.value = false
  }
}

const deleteUser = async (userId) => {
  const targetUser = users.value.find(user => user._id === userId)
  if (isCurrentUser(targetUser)) {
    ElMessage.warning('当前登录账号不能禁用自身')
    return
  }

  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    await disableStaff(token, userId, true)
    ElMessage.success('账号已禁用')
    await loadUsers()
  } catch (error) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    loading.value = false
  }
}

const confirmResetPassword = async (user) => {
  if (!user) return
  try {
    await ElMessageBox.confirm(
      `确定将 ${user.roleDisplay || '账号'} [${user.name || user.username}] 的密码重置为系统默认密码 123456 吗？`,
      '重置密码确认',
      {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    const token = localStorage.getItem('adminToken')
    await resetUserPassword(token, user._id)
    ElMessage.success('密码已重置为 123456，请提醒用户登录后立即修改密码')
    await loadUsers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '重置密码失败')
    }
  } finally {
    loading.value = false
  }
}

const toggleUserStatus = async (user) => {
  if (isCurrentUser(user)) {
    user.active = true
    ElMessage.warning('当前登录账号不能更改自身状态')
    return
  }

  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    await disableStaff(token, user._id, !user.active)
    ElMessage.success(user.active ? '已启用' : '已禁用')
    await loadUsers()
  } catch (error) {
    ElMessage.error(error.message || '操作失败')
    user.active = !user.active
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)
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
