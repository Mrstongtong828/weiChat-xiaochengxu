<template>
  <div class="glass-card">
    <div class="section-title">
      <div>
        <span>用户管理</span>
        <p class="section-desc">管理后台账号、角色权限、负责品类和工程师服务范围。</p>
      </div>
      <div class="title-actions">
        <el-button v-if="canCreateStaff" type="primary" size="small" @click="openUserDialog(null)">
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
        <el-table-column prop="email" label="邮箱" min-width="200" show-overflow-tooltip></el-table-column>
        <el-table-column prop="roleDisplay" label="角色" show-overflow-tooltip></el-table-column>
        <el-table-column label="权限" min-width="150" show-overflow-tooltip>
          <template #default="{row}">{{ permissionSummary(row) }}</template>
        </el-table-column>
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
            <el-switch v-else-if="canToggleStaff" v-model="row.active" active-text="启用" inactive-text="禁用" @change="toggleUserStatus(row)"></el-switch>
            <el-tag v-else :type="row.active ? 'success' : 'danger'" effect="plain">{{ row.active ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right" align="right">
          <template #default="{row}">
            <el-button v-if="canEditStaff" type="primary" link @click="openUserDialog(row)">编辑</el-button>
            <span class="risk-actions">
              <el-button v-if="canResetStaffPassword" type="danger" link :disabled="row.username === 'admin_root'" @click="confirmResetPassword(row)">重置密码</el-button>
              <el-popconfirm v-if="canToggleStaff && !isCurrentUser(row)" title="确定要禁用该账号吗？" @confirm="deleteUser(row._id)">
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

  <el-dialog v-model="userDialogVisible" :title="isEditUser ? '编辑用户与权限' : '新增用户与权限'" width="min(960px, 94vw)" align-center>
    <el-form :model="userForm" label-width="90px" class="account-form">
      <div class="account-fields">
      <el-form-item label="登录账号" v-if="!isEditUser">
        <el-input v-model.trim="userForm.username" placeholder="请输入登录账号"></el-input>
      </el-form-item>
      <el-form-item v-if="!isEditUser || canResetStaffPassword" label="登录密码">
        <el-input v-model="userForm.password" type="password" show-password :placeholder="isEditUser ? '留空则不修改密码' : '请输入登录密码'"></el-input>
      </el-form-item>
      <el-form-item label="姓名">
        <el-input v-model.trim="userForm.name" placeholder="请输入姓名"></el-input>
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model.trim="userForm.phone" placeholder="请输入手机号"></el-input>
      </el-form-item>
      <el-form-item label="邮箱">
        <el-input v-model.trim="userForm.email" type="email" placeholder="用于登录密码找回"></el-input>
      </el-form-item>
      <el-form-item label="角色">
        <el-select v-model="userForm.role" style="width:100%;" @change="applyRoleTemplate">
          <el-option v-if="isCurrentSuperadmin" label="超级管理员" value="超级管理员"></el-option>
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
      </div>
      <section class="permission-panel">
        <div class="permission-heading">
          <div><strong>账号权限</strong><span>已选择 {{ userForm.permissions.length }} 项</span></div>
          <el-alert v-if="['管理员', '超级管理员'].includes(userForm.role)" title="管理员固定拥有全部权限" type="info" :closable="false" show-icon />
        </div>
        <div class="permission-groups">
          <article v-for="group in permissionGroups" :key="group.name" class="permission-group">
            <header>
              <strong>{{ group.name }}</strong>
              <div>
                <el-button link type="primary" size="small" :disabled="isFullAccessRole" @click="setGroupPermissions(group, true)">全选</el-button>
                <el-button link size="small" :disabled="isFullAccessRole" @click="setGroupPermissions(group, false)">清空</el-button>
              </div>
            </header>
            <el-checkbox-group v-model="userForm.permissions" class="permission-options">
              <el-checkbox v-for="permission in group.permissions" :key="permission.key" :value="permission.key" :disabled="isFullAccessRole">
                {{ permission.label }}<el-tag v-if="permission.risk" size="small" type="warning" effect="plain">敏感</el-tag>
              </el-checkbox>
            </el-checkbox-group>
          </article>
        </div>
      </section>
    </el-form>
    <template #footer>
      <el-button @click="userDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveUser" :loading="loading">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getStaffList, getPermissionCatalog, addStaff, editStaff, disableStaff, resetUserPassword } from '../api/admin.js'
import { getEngineerPerformance } from '../api/performance.js'
import { hasPermission } from '../utils/permissions.js'

const users = ref([])
const loading = ref(false)
const permissionCatalog = ref({ groups: [], roleTemplates: {} })
const permissionGroups = computed(() => permissionCatalog.value.groups || [])
const isCurrentSuperadmin = (() => {
  try { return JSON.parse(localStorage.getItem('adminUser') || '{}').role === 'superadmin' } catch (error) { return false }
})()
const canCreateStaff = hasPermission('create_staff')
const canEditStaff = hasPermission('edit_staff')
const canToggleStaff = hasPermission('toggle_staff')
const canResetStaffPassword = hasPermission('reset_staff_password')
const canViewEngineerPerformance = hasPermission('view_engineer_performance')

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
  email: '',
  role: '工程师',
  permissions: [],
  device_categories: [],
  service_areas: []
})

const isFullAccessRole = computed(() => ['管理员', '超级管理员'].includes(userForm.role))

const currentRoleKey = () => roleMapReverse[userForm.role] || 'engineer'

const applyRoleTemplate = () => {
  const template = permissionCatalog.value.roleTemplates?.[currentRoleKey()] || []
  userForm.permissions = [...template]
}

const setGroupPermissions = (group, selected) => {
  const keys = (group.permissions || []).map(item => item.key)
  const next = new Set(userForm.permissions)
  keys.forEach(key => selected ? next.add(key) : next.delete(key))
  userForm.permissions = [...next]
}

const permissionSummary = (user = {}) => {
  if (['admin', 'superadmin'].includes(user.role)) return '全部权限'
  const count = Array.isArray(user.permissions) ? user.permissions.length : 0
  return count ? `${count} 项权限` : '无业务权限'
}

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
    if (canViewEngineerPerformance) {
      try {
        const perf = await getEngineerPerformance({})
        ;(perf.list || []).forEach(p => { perfMap[p.engineer_id] = p.completed_count })
      } catch (e) {
        // 绩效统计失败不应阻断员工列表加载
      }
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

const loadPermissionCatalog = async () => {
  const token = localStorage.getItem('adminToken')
  permissionCatalog.value = await getPermissionCatalog(token)
}

const openUserDialog = (user) => {
  isEditUser.value = Boolean(user)
  userForm._id = user ? user._id : null
  userForm.username = user ? user.username : ''
  userForm.password = ''
  userForm.name = user ? user.name : ''
  userForm.phone = user ? user.phone : ''
  userForm.email = user ? user.email : ''
  userForm.role = user ? user.roleDisplay : '工程师'
  userForm.permissions = user && Array.isArray(user.permissions) ? [...user.permissions] : []
  userForm.device_categories = user && Array.isArray(user.device_categories) ? [...user.device_categories] : []
  userForm.service_areas = user && Array.isArray(user.service_areas) ? [...user.service_areas] : []
  if (!user) applyRoleTemplate()
  userDialogVisible.value = true
}

const saveUser = async () => {
  if (!userForm.name || !userForm.phone || !userForm.email) {
    ElMessage.warning('请完整填写用户信息')
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
    ElMessage.warning('请输入有效的邮箱地址')
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
  if (userForm.password && (userForm.password.length < 10 || !/[A-Za-z]/.test(userForm.password) || !/\d/.test(userForm.password))) {
    ElMessage.warning('登录密码至少需要 10 位，并同时包含字母和数字')
    return
  }

  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const staff = {
      username: userForm.username,
      name: userForm.name,
      phone: userForm.phone,
      email: userForm.email.toLowerCase(),
      role: roleMapReverse[userForm.role] || 'engineer',
      permissions: [...userForm.permissions],
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
      `确定将 ${user.roleDisplay || '账号'} [${user.name || user.username}] 的密码重置为一次性临时密码吗？`,
      '重置密码确认',
      {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    const token = localStorage.getItem('adminToken')
    const result = await resetUserPassword(token, user._id)
    await ElMessageBox.alert(
      `临时密码：${result.temporaryPassword}\n\n该密码仅在此处显示，请通过安全渠道交给用户，并提醒其登录后立即修改。`,
      '密码已重置',
      { confirmButtonText: '我已记录', type: 'success' }
    )
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

onMounted(async () => {
  loading.value = true
  try {
    await loadPermissionCatalog()
    await loadUsers()
  } finally {
    loading.value = false
  }
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
.account-form { display: grid; grid-template-columns: minmax(260px, 0.72fr) minmax(420px, 1.28fr); gap: 24px; align-items: start; }
.account-fields { padding: 18px 18px 6px; border: 1px solid #e5e6eb; border-radius: 10px; background: #f7f8fa; }
.permission-panel { min-width: 0; }
.permission-heading { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.permission-heading > div { display: flex; align-items: baseline; justify-content: space-between; color: #1d2129; }
.permission-heading span { color: #86909c; font-size: 13px; }
.permission-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-height: 58vh; overflow: auto; padding-right: 4px; }
.permission-group { border: 1px solid #e5e6eb; border-radius: 10px; padding: 12px; background: #fff; }
.permission-group header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #f2f3f5; }
.permission-options { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding-top: 10px; }
.permission-options :deep(.el-checkbox) { margin-right: 0; height: auto; white-space: normal; }
.permission-options :deep(.el-tag) { margin-left: 6px; }
@media (max-width: 760px) {
  .account-form { grid-template-columns: 1fr; }
  .permission-groups { grid-template-columns: 1fr; max-height: none; }
}
</style>
