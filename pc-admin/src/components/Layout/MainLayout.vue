<template>
  <div class="main-layout">
    <div class="mobile-mask" :class="{ show: isMobile && sidebarOpen }" @click="sidebarOpen = false"></div>

    <div class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-logo">
        <div class="logo-card">
          <img src="/brand/cicada-admin-logo.png" alt="CICADA 思科达">
        </div>
      </div>
      <div class="nav-label">MAIN NAVIGATION</div>
      <el-menu :default-active="activeMenu" class="el-menu-vertical" @select="handleMenuSelect">
        <el-menu-item v-if="canAccessMenu('home')" index="home"><el-icon><HomeFilled /></el-icon><span>工作台首页</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('workorder')" index="workorder"><el-icon><Document /></el-icon><span>报修工单管理</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('settlement')" index="settlement"><el-icon><Money /></el-icon><span>结算管理</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('inventory')" index="inventory"><el-icon><Box /></el-icon><span>配件库存管理</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('customers')" index="customers"><el-icon><Avatar /></el-icon><span>客户管理</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('faultdb')" index="faultdb"><el-icon><Warning /></el-icon><span>产品故障知识库</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('feedback')" index="feedback"><el-icon><ChatDotSquare /></el-icon><span>投诉与建议</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('audit')" index="audit"><el-icon><Tickets /></el-icon><span>操作审计日志</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('users')" index="users"><el-icon><User /></el-icon><span>用户管理</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('summary')" index="summary"><el-icon><DataAnalysis /></el-icon><span>运营统计</span></el-menu-item>
        <el-menu-item v-if="canAccessMenu('settings')" index="settings"><el-icon><Setting /></el-icon><span>小程序配置</span></el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <div class="status-card">
          <div class="status-row">
            <span class="status-dot"><i></i></span>
            <div>
              <strong>系统在线</strong>
              <small>服务台运行正常</small>
            </div>
          </div>
          <span class="admin-chip">Admin 控制台</span>
        </div>
      </div>
    </div>

    <div class="main-container">
      <div class="top-header">
        <div class="header-left">
          <el-icon class="hamburger" @click="sidebarOpen = !sidebarOpen"><Fold /></el-icon>
          <div class="breadcrumb-title">{{ menuTitles[activeMenu] || '检修管理后台' }}</div>
        </div>
        <div class="header-actions">
          <el-button type="primary" plain round size="small" class="visit-miniapp-btn" @click="openMiniappDialog"><el-icon><Monitor /></el-icon><span>访问小程序</span></el-button>
          <el-dropdown>
            <el-avatar :size="40" class="admin-avatar" src="https://dummyimage.com/80x80/e8f3ff/165DFF.png&text=Admin"></el-avatar>
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

    <el-dialog title="访问小程序（扫码预览）" v-model="miniappDialogVisible" width="380px" align-center>
      <div v-loading="miniappLoading" class="miniapp-qr-box">
        <template v-if="miniappQrUrl">
          <img :src="miniappQrUrl" class="miniapp-qr-img" alt="小程序二维码" />
          <p class="miniapp-qr-tip">请用<strong>微信</strong>扫描上方二维码，在手机上预览客户端小程序。</p>
          <p class="miniapp-qr-note">体验版需先在微信公众平台「成员管理」把你的微信加为体验成员；正式发布后此处可替换为正式版小程序码。</p>
        </template>
        <template v-else-if="!miniappLoading">
          <el-empty description="尚未配置小程序二维码">
            <p class="miniapp-qr-note">请在「系统设置 → 隐私与合规 → 小程序体验版二维码」上传后，此处即可扫码预览。</p>
            <el-button v-if="canManageSettings" type="primary" @click="goSettings">前往设置上传</el-button>
          </el-empty>
        </template>
      </div>
    </el-dialog>

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
import { changeMyPassword, getSettings, getTempFileURL } from '../../api/admin.js'
import { canAccessMenu, getCurrentAdminRole } from '../../config/menuAccess.js'

const router = useRouter()
const route = useRoute()
const isMobile = ref(false)
const sidebarOpen = ref(false)

const menuTitles = {
  home: '工作台首页',
  workorder: '报修工单处理中心',
  inventory: '配件库存管理',
  settlement: '结算管理',
  faultdb: '产品分类与故障预设',
  users: '用户管理',
  settings: '小程序图文及政策配置',
  feedback: '客户投诉与建议列表',
  summary: '运营汇总看板',
  audit: '工单操作审计日志（合规备查）'
}

const roleMap = { superadmin: '超级管理员', admin: '管理员', engineer: '工程师', finance: '财务', support: '客服' }
const getMenuFromPath = () => route.path.replace(/^\//, '') || 'home'
const activeMenu = ref(getMenuFromPath())

const profileDrawerVisible = ref(false)
const profileForm = reactive({ username: '', realName: '', phone: '', role: '' })
const pwdDialogVisible = ref(false)
const pwdSaving = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

// 访问小程序（扫码预览）
const miniappDialogVisible = ref(false)
const miniappLoading = ref(false)
const miniappQrUrl = ref('')
let miniappQrLoaded = false
const canManageSettings = ['superadmin', 'admin'].includes(getCurrentAdminRole())
const isWebUrl = (v) => /^https?:\/\//i.test(String(v || ''))

const openMiniappDialog = async () => {
  miniappDialogVisible.value = true
  if (miniappQrLoaded) return // 已加载过则直接复用
  miniappLoading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const settings = await getSettings(token)
    const qr = (settings && settings.miniapp_preview_qr) || ''
    if (qr && isWebUrl(qr)) {
      miniappQrUrl.value = qr
    } else if (qr) {
      const map = await getTempFileURL(token, [qr])
      miniappQrUrl.value = (map && map[qr]) || ''
    } else {
      miniappQrUrl.value = ''
    }
    miniappQrLoaded = true
  } catch (error) {
    ElMessage.error(error.message || '获取小程序二维码失败')
  } finally {
    miniappLoading.value = false
  }
}

const goSettings = () => {
  miniappDialogVisible.value = false
  router.push('/settings')
}

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
.main-layout { display: flex; height: 100vh; width: 100%; position: relative; background: hsl(var(--background)); }
.mobile-mask { display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.42); z-index: 1000; opacity: 0; transition: opacity 0.3s; }
.mobile-mask.show { display: block; opacity: 1; }
.sidebar {
  width: var(--sidebar-width, 292px);
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 26% 0%, rgba(219, 234, 254, 0.95), transparent 20rem),
    radial-gradient(circle at 82% 100%, rgba(224, 242, 254, 0.95), transparent 17rem),
    rgba(248, 251, 255, 0.96);
  border-right: 1px solid hsl(var(--border));
  display: flex;
  flex-direction: column;
  z-index: 1001;
  transition: transform 0.3s ease;
  flex-shrink: 0;
  backdrop-filter: blur(18px);
}
.sidebar::before {
  content: '';
  position: absolute;
  width: 360px;
  height: 360px;
  left: -148px;
  top: 116px;
  border-radius: 999px;
  background: rgba(219, 234, 254, 0.72);
}
.sidebar::after {
  content: '';
  position: absolute;
  width: 292px;
  height: 292px;
  right: -98px;
  bottom: -70px;
  border-radius: 999px;
  background: rgba(224, 242, 254, 0.72);
}
.sidebar-logo {
  position: relative;
  z-index: 1;
  padding: 22px 22px 18px;
  flex-shrink: 0;
}
.logo-card {
  height: 74px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(219, 234, 254, 0.9);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-card img { width: 204px; max-height: 42px; object-fit: contain; }
.nav-label {
  position: relative;
  z-index: 1;
  padding: 16px 32px 8px;
  color: #64748b;
  font-size: 10px;
  line-height: 1;
  font-weight: 600;
  flex-shrink: 0;
}
.el-menu-vertical {
  position: relative;
  z-index: 1;
  border-right: none;
  padding: 0 22px 10px;
  background: transparent;
  display: grid;
  gap: 7px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}
.el-menu-vertical::-webkit-scrollbar {
  width: 6px;
}
.el-menu-vertical::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.52);
}
.el-menu-vertical::-webkit-scrollbar-track {
  background: transparent;
}
:deep(.el-menu-item) {
  height: 60px;
  margin: 0;
  padding: 0 18px !important;
  border-radius: 10px;
  border: 1px solid #dbeafe;
  background: rgba(255, 255, 255, 0.88);
  color: #334155;
  font-size: 16px;
  font-weight: 500;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.75) inset;
}
:deep(.el-menu-item:hover) {
  background: #eff6ff;
  color: #2563eb;
}
:deep(.el-menu-item.is-active) {
  background: #e8f2ff;
  color: #2563eb;
  border-color: #93c5fd;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12);
}
:deep(.el-menu-item.is-active::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 13px;
  width: 4px;
  height: 34px;
  border-radius: 0 999px 999px 0;
  background: #2563eb;
}
:deep(.el-menu-item .el-icon) {
  width: 32px;
  height: 32px;
  margin-right: 12px;
  border-radius: 9px;
  background: #f1f5f9;
  color: #475569;
  font-size: 19px;
}
:deep(.el-menu-item.is-active .el-icon) {
  background: #2563eb;
  color: #ffffff;
}
:deep(.el-menu-item.is-active::after) {
  content: '';
  position: absolute;
  right: 14px;
  top: 50%;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #2563eb;
  transform: translateY(-50%);
}
.sidebar-footer {
  position: relative;
  z-index: 1;
  margin-top: auto;
  padding: 18px 22px 24px;
  flex-shrink: 0;
}
.status-card {
  padding: 20px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #dbeafe;
  box-shadow: 0 20px 42px rgba(15, 23, 42, 0.1);
}
.status-row { display: flex; align-items: center; gap: 12px; }
.status-row strong { display: block; color: #0f172a; font-size: 16px; font-weight: 700; }
.status-row small { display: block; margin-top: 3px; color: #64748b; font-size: 13px; }
.status-dot {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #dcfce7;
  display: grid;
  place-items: center;
}
.status-dot i {
  width: 13px;
  height: 13px;
  border-radius: 999px;
  border: 3px solid #22c55e;
  background: #ffffff;
}
.admin-chip {
  display: block;
  height: 22px;
  margin-top: 14px;
  border-radius: 999px;
  border: 1px solid #93c5fd;
  background: #eff6ff;
  color: #2563eb;
  text-align: center;
  font-size: 12px;
  line-height: 20px;
}
.main-container { flex: 1; display: flex; flex-direction: column; min-width: 0; background: transparent; }
.top-header {
  height: var(--header-height, 82px);
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px 0 30px;
  box-shadow: none;
  backdrop-filter: blur(16px);
  z-index: 10;
  flex-shrink: 0;
}
.header-left, .header-actions { display: flex; align-items: center; gap: 18px; }
.hamburger { font-size: 24px; cursor: pointer; color: #475569; }
.breadcrumb-title { font-size: 24px; font-weight: 800; color: hsl(var(--foreground)); }
.visit-miniapp-btn { height: 28px; padding: 0 12px; border-color: #bfdbfe; background: #eff6ff; }
.visit-miniapp-btn :deep(span) { display: inline-flex; align-items: center; gap: 4px; color: #2563eb; }
.miniapp-qr-box { min-height: 180px; text-align: center; }
.miniapp-qr-img { width: 220px; height: 220px; object-fit: contain; border: 1px solid #eef2f7; border-radius: 8px; padding: 8px; background: #fff; }
.miniapp-qr-tip { margin: 14px 0 4px; font-size: 14px; color: #1f2937; }
.miniapp-qr-note { margin: 4px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.6; }
.admin-avatar { cursor: pointer; border: 1px solid #bfdbfe; background: #eff6ff; }
.content-area { flex: 1; overflow-y: auto; padding: 30px 28px 44px; }
.content-wrapper { width: 100%; max-width: none; margin: 0; }
.profile-avatar { display:flex; flex-direction:column; align-items:center; padding: 8px 0 24px; }
@media screen and (max-width: 768px) {
  .sidebar { position: fixed; top: 0; bottom: 0; left: 0; transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); }
  .top-header { padding: 0 16px; }
  .breadcrumb-title { font-size: 20px; }
  .content-area { padding: 16px; }
}
</style>
