<template>
  <div class="main-layout">
    <div class="mobile-mask" :class="{ show: isMobile && sidebarOpen }" @click="sidebarOpen = false"></div>

    <div class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-logo">
        <img src="/brand/cicada-admin-logo.png" alt="CICADA 思科达">
      </div>
      <el-menu :default-active="activeMenu" class="el-menu-vertical" @select="handleMenuSelect">
        <el-menu-item index="home"><el-icon><HomeFilled /></el-icon><span>工作台首页</span></el-menu-item>
        <el-menu-item index="workorder"><el-icon><Document /></el-icon><span>报修工单管理</span></el-menu-item>
        <el-menu-item index="faultdb"><el-icon><Warning /></el-icon><span>产品故障知识库</span></el-menu-item>
        <el-menu-item index="users"><el-icon><User /></el-icon><span>用户管理</span></el-menu-item>
        <el-menu-item index="feedback"><el-icon><ChatDotSquare /></el-icon><span>投诉与建议</span></el-menu-item>
        <el-menu-item index="summary"><el-icon><DataAnalysis /></el-icon><span>运营汇总看板</span></el-menu-item>
        <el-menu-item index="settings"><el-icon><Setting /></el-icon><span>小程序配置</span></el-menu-item>
      </el-menu>
    </div>

    <div class="main-container">
      <div class="top-header">
        <div class="header-left">
          <el-icon class="hamburger" @click="sidebarOpen = !sidebarOpen"><Fold /></el-icon>
          <div class="breadcrumb-title">{{ menuTitles[activeMenu] || '检修管理后台' }}</div>
        </div>
        <div class="header-actions">
          <el-button type="primary" plain round size="small" class="top-btn-text"><el-icon><Monitor /></el-icon> 访问小程序</el-button>
          <el-dropdown>
            <el-avatar size="32" src="https://dummyimage.com/64x64/e8f3ff/165DFF.png&text=Admin" style="cursor:pointer;"></el-avatar>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="profileDrawerVisible = true"><el-icon><User /></el-icon>个人信息</el-dropdown-item>
                <el-dropdown-item @click="openPwdDialog"><el-icon><Lock /></el-icon>修改密码</el-dropdown-item>
                <el-dropdown-item @click="handleLogout" style="color:#F56C6C;"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="content-area">
        <div class="content-wrapper">
          <router-view />
        </div>
      </div>
    </div>

    <el-drawer v-model="profileDrawerVisible" title="个人信息" direction="rtl" :size="isMobile ? '100%' : '400px'">
      <div class="profile-avatar">
        <el-avatar :size="80" src="https://dummyimage.com/64x64/e8f3ff/165DFF.png&text=Admin"></el-avatar>
      </div>
      <el-form :model="profileForm" label-width="90px">
        <el-form-item label="登录账号"><el-input v-model="profileForm.username" disabled></el-input></el-form-item>
        <el-form-item label="真实姓名"><el-input v-model="profileForm.realName" placeholder="请输入真实姓名"></el-input></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="profileForm.phone" placeholder="请输入联系电话"></el-input></el-form-item>
        <el-form-item label="系统角色"><el-input v-model="profileForm.role" disabled></el-input></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="profileDrawerVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProfile">保存修改</el-button>
      </template>
    </el-drawer>

    <el-dialog title="修改登录密码" v-model="pwdDialogVisible" width="400px" align-center>
      <el-form :model="pwdForm" label-width="100px">
        <el-form-item label="原密码"><el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入原密码"></el-input></el-form-item>
        <el-form-item label="新密码"><el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="请输入新密码"></el-input></el-form-item>
        <el-form-item label="确认新密码"><el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码"></el-input></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSaving" @click="saveNewPassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { changeMyPassword } from '../../api/admin.js'

const router = useRouter()
const route = useRoute()
const isMobile = ref(false)
const sidebarOpen = ref(false)

const menuTitles = {
  home: '工作台首页',
  workorder: '报修工单处理中心',
  faultdb: '产品分类与故障预设',
  users: '用户管理',
  settings: '小程序图文及政策配置',
  feedback: '客户投诉与建议列表',
  summary: '运营汇总看板'
}

const roleMap = { admin: '管理员', engineer: '工程师' }
const getMenuFromPath = () => route.path.replace(/^\//, '') || 'home'
const activeMenu = ref(getMenuFromPath())

const profileDrawerVisible = ref(false)
const profileForm = reactive({ username: '', realName: '', phone: '', role: '' })
const pwdDialogVisible = ref(false)
const pwdSaving = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) sidebarOpen.value = false
}

const syncProfileFromStorage = () => {
  try {
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}')
    profileForm.username = user.username || ''
    profileForm.realName = user.name || ''
    profileForm.phone = user.phone || ''
    profileForm.role = user.roleDisplay || roleMap[user.role] || ''
  } catch (error) {
    localStorage.removeItem('adminUser')
  }
}

const handleMenuSelect = (index) => {
  activeMenu.value = index
  router.push('/' + index)
  if (isMobile.value) sidebarOpen.value = false
}

const handleLogout = () => {
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminUser')
  ElMessage.success('已安全退出系统')
  router.push('/login')
}

const saveProfile = () => {
  profileDrawerVisible.value = false
  ElMessage.info('个人资料保存接口待补充，当前仅展示登录信息')
}

const openPwdDialog = () => {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
  pwdDialogVisible.value = true
}

const saveNewPassword = async () => {
  if (!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
    ElMessage.warning('请完整填写密码信息')
    return
  }
  if (pwdForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少需要 6 位')
    return
  }
  if (pwdForm.newPassword === pwdForm.oldPassword) {
    ElMessage.warning('新密码不能与原密码相同')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    ElMessage.error('两次输入的新密码不一致')
    return
  }

  pwdSaving.value = true
  try {
    const token = localStorage.getItem('adminToken')
    await changeMyPassword(token, pwdForm.oldPassword, pwdForm.newPassword)
    pwdDialogVisible.value = false
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    ElMessage.success('密码修改成功，请使用新密码重新登录')
    router.push('/login')
  } catch (error) {
    ElMessage.error(error.message || '密码修改失败')
  } finally {
    pwdSaving.value = false
  }
}

watch(() => route.path, () => { activeMenu.value = getMenuFromPath() })

onMounted(() => {
  checkMobile()
  syncProfileFromStorage()
  window.addEventListener('resize', checkMobile)
})
onUnmounted(() => { window.removeEventListener('resize', checkMobile) })
</script>

<style scoped>
.main-layout { display: flex; height: 100vh; width: 100%; position: relative; }
.mobile-mask { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; opacity: 0; transition: opacity 0.3s; }
.mobile-mask.show { display: block; opacity: 1; }
.sidebar { width: var(--sidebar-width, 220px); background: #fff; display: flex; flex-direction: column; box-shadow: 2px 0 8px rgba(0,0,0,0.02); z-index: 1001; transition: transform 0.3s ease; flex-shrink: 0; }
.sidebar-logo { height: var(--header-height, 64px); display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #f0f2f5; }
.sidebar-logo img { max-width: 150px; max-height: 40px; object-fit: contain; }
.el-menu-vertical { border-right: none; padding: 12px; }
.main-container { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #f5f7fb; }
.top-header { height: var(--header-height, 64px); background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); z-index: 10; flex-shrink: 0; }
.header-left, .header-actions { display: flex; align-items: center; gap: 16px; }
.hamburger { font-size: 22px; cursor: pointer; color: #4e5969; }
.breadcrumb-title { font-size: 16px; font-weight: 600; color: #1d2129; }
.content-area { flex: 1; overflow-y: auto; padding: 24px; }
.content-wrapper { max-width: 1600px; margin: 0 auto; }
.profile-avatar { display:flex; flex-direction:column; align-items:center; padding: 8px 0 24px; }
@media screen and (max-width: 768px) {
  .sidebar { position: fixed; top: 0; bottom: 0; left: 0; transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); }
  .top-header { padding: 0 16px; }
  .content-area { padding: 16px; }
}
</style>
