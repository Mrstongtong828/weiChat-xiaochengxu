<template>
  <div class="main-layout">
    <div class="mobile-mask" :class="{ show: isMobile && sidebarOpen }" @click="sidebarOpen = false"></div>

    <div class="sidebar" :class="{ open: sidebarOpen, collapsed }">
      <div class="sidebar-logo">
        <div class="logo-card">
          <img src="/brand/cicada-admin-logo.png" alt="CICADA 思科达">
        </div>
      </div>
      <div class="nav-label">MAIN NAVIGATION</div>
      <el-menu :default-active="activeMenu" class="el-menu-vertical" :collapse="collapsed && !isMobile" :collapse-transition="false" @select="handleMenuSelect">
        <el-menu-item v-if="canAccessMenu('home')" index="home"><el-icon><HomeFilled /></el-icon><template #title>工作台首页</template></el-menu-item>
        <el-menu-item v-if="canAccessMenu('workorder')" index="workorder"><el-icon><Document /></el-icon><template #title>报修工单管理</template></el-menu-item>
        <el-menu-item v-if="canAccessMenu('finance')" index="finance"><el-icon><Money /></el-icon><template #title>财务中心</template></el-menu-item>
        <el-menu-item v-if="canAccessMenu('logistics')" index="logistics"><el-icon><Van /></el-icon><template #title>物流管理</template></el-menu-item>
        <el-menu-item v-if="canAccessMenu('inventory')" index="inventory"><el-icon><Box /></el-icon><template #title>配件库存管理</template></el-menu-item>
        <el-menu-item v-if="canAccessMenu('customers')" index="customers"><el-icon><Avatar /></el-icon><template #title>客户管理</template></el-menu-item>
        <el-menu-item v-if="canAccessMenu('faultdb')" index="faultdb"><el-icon><Warning /></el-icon><template #title>产品故障知识库</template></el-menu-item>
        <el-menu-item v-if="canAccessMenu('feedback')" index="feedback"><el-icon><ChatDotSquare /></el-icon><template #title>投诉与建议</template></el-menu-item>
        <el-menu-item v-if="canAccessMenu('settings')" index="settings"><el-icon><Setting /></el-icon><template #title>小程序配置</template></el-menu-item>
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
          <el-icon class="hamburger" @click="toggleSidebar"><Expand v-if="collapsed" /><Fold v-else /></el-icon>
          <div class="breadcrumb-title">{{ menuTitles[activeMenu] || '检修管理后台' }}</div>
        </div>
        <div class="header-actions">
          <el-popover v-model:visible="notificationVisible" placement="bottom-end" :width="isMobile ? 296 : 440" trigger="click" @show="loadNotifications()">
            <template #reference>
              <el-badge :value="notificationTotal" :max="99" :hidden="!notificationTotal" class="notification-badge">
                <el-button circle text class="notification-trigger" aria-label="打开提醒中心">
                  <el-icon :size="20"><Bell /></el-icon>
                </el-button>
              </el-badge>
            </template>
            <div v-loading="notificationLoading" class="notification-panel">
              <div class="notification-panel-head">
                <div><strong>提醒中心</strong><span>{{ notificationTotal ? `共 ${notificationTotal} 项待处理` : '当前没有待处理提醒' }}</span></div>
                <el-tooltip content="刷新提醒" placement="top">
                  <el-button circle text size="small" aria-label="刷新提醒" @click="loadNotifications(true)"><el-icon><Refresh /></el-icon></el-button>
                </el-tooltip>
              </div>
              <el-alert v-if="notificationUnavailable.length" type="warning" :closable="false" show-icon class="notification-alert"
                :title="`${notificationUnavailable.join('、')}暂时无法加载，其他提醒仍可使用`" />
              <el-empty v-if="!notificationLoading && !notificationGroups.length" :image-size="72" description="当前没有待处理提醒" />
              <div v-else class="notification-groups">
                <section v-for="group in notificationGroups" :key="group.key" class="notification-group" :class="`notification-group--${group.severity}`">
                  <button class="notification-group-head" type="button" @click="goNotification(group.key)">
                    <span class="notification-severity"></span>
                    <strong>{{ group.title }}</strong>
                    <el-tag size="small" :type="notificationTagType(group.severity)">{{ group.count }}</el-tag>
                    <el-icon class="notification-go"><ArrowRight /></el-icon>
                  </button>
                  <button v-for="sample in group.samples" :key="`${group.key}-${sample.id}-${sample.title}`" type="button" class="notification-sample" @click="goNotification(group.key)">
                    <strong>{{ sample.title }}</strong><span>{{ sample.desc }}</span>
                  </button>
                  <el-button type="primary" link size="small" class="notification-more" @click="goNotification(group.key)">查看全部</el-button>
                </section>
              </div>
            </div>
          </el-popover>
          <el-button type="primary" plain round size="small" class="visit-miniapp-btn" @click="openMiniappDialog"><el-icon><Monitor /></el-icon><span>访问小程序</span></el-button>
          <el-dropdown>
            <el-avatar :size="40" :src="profileAvatarUrl" class="admin-avatar" :aria-label="profileEntryLabel" :title="profileEntryLabel"><el-icon :size="20"><User /></el-icon></el-avatar>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="canAccessMenu('users')" @click="handleMenuSelect('users')"><el-icon><Setting /></el-icon>用户管理</el-dropdown-item>
                <el-dropdown-item v-if="canAccessMenu('audit')" @click="handleMenuSelect('audit')"><el-icon><Files /></el-icon>操作审计日志</el-dropdown-item>
                <el-dropdown-item :divided="canAccessMenu('users') || canAccessMenu('audit')" @click="openProfileDrawer"><el-icon><User /></el-icon>个人信息</el-dropdown-item>
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

    <el-drawer v-model="profileDrawerVisible" title="个人信息" direction="rtl" :size="isMobile ? '100%' : '400px'" class="profile-drawer" @closed="resetProfileDraft">
      <div class="profile-content">
        <div class="profile-avatar">
          <div class="profile-avatar-picker">
            <el-avatar :size="88" :src="profileAvatarDisplay" class="admin-avatar"><el-icon :size="40"><User /></el-icon></el-avatar>
            <el-upload accept="image/jpeg,image/png,image/webp" :auto-upload="false" :show-file-list="false" :on-change="handleAvatarSelect" class="avatar-upload">
              <el-tooltip content="更换头像" placement="top">
                <el-button circle type="primary" class="avatar-edit-button" aria-label="更换头像"><el-icon><Camera /></el-icon></el-button>
              </el-tooltip>
            </el-upload>
            <el-tooltip v-if="profileAvatarDisplay || profileForm.avatar" content="恢复默认头像" placement="top">
              <el-button circle class="avatar-remove-button" aria-label="恢复默认头像" @click="removeAvatar"><el-icon><Delete /></el-icon></el-button>
            </el-tooltip>
          </div>
          <strong>{{ profileForm.realName || profileForm.username || '管理员' }}</strong>
          <span>{{ profileForm.role || '后台账号' }}</span>
          <small>支持 JPG、PNG、WebP，文件不超过 2MB</small>
        </div>
        <el-form :model="profileForm" label-position="top" class="profile-form" @submit.prevent="saveProfile">
          <el-form-item label="登录账号"><el-input v-model="profileForm.username" disabled></el-input></el-form-item>
          <el-form-item label="真实姓名" required><el-input v-model="profileForm.realName" maxlength="50" show-word-limit placeholder="请输入真实姓名"></el-input></el-form-item>
          <el-form-item label="联系电话"><el-input v-model="profileForm.phone" maxlength="32" placeholder="手机号或座机号"></el-input></el-form-item>
          <el-form-item label="系统角色"><el-input v-model="profileForm.role" disabled></el-input></el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="profile-actions">
          <el-button :disabled="profileSaving" @click="profileDrawerVisible = false">取消</el-button>
          <el-button type="primary" :loading="profileSaving" :disabled="profileSaving" @click="saveProfile">保存修改</el-button>
        </div>
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
            <p class="miniapp-qr-note">请在「系统设置 → 联系与公众号 → 小程序体验版二维码」上传后，此处即可扫码预览。</p>
            <el-button v-if="canManageSettings" type="primary" @click="goSettings">前往设置上传</el-button>
          </el-empty>
        </template>
      </div>
    </el-dialog>

    <el-dialog title="修改登录密码" v-model="pwdDialogVisible" width="400px" align-center :show-close="!forcedPasswordChange" :close-on-click-modal="!forcedPasswordChange" :close-on-press-escape="!forcedPasswordChange">
      <el-form :model="pwdForm" label-width="100px">
        <el-form-item label="原密码"><el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入原密码"></el-input></el-form-item>
        <el-form-item label="新密码"><el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="请输入新密码"></el-input></el-form-item>
        <el-form-item label="确认新密码"><el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码"></el-input></el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="!forcedPasswordChange" @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSaving" @click="saveNewPassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { changeMyPassword, getSettings, getTempFileURL, updateMyProfile } from '../../api/admin.js'
import { getNotificationSummary } from '../../api/order.js'
import { getWarrantyAlerts } from '../../api/customer.js'
import { canAccessMenu, getCurrentAdminRole } from '../../config/menuAccess.js'
import { uploadAvatarToCloud } from '../../utils/upload.js'

const router = useRouter()
const route = useRoute()
const isMobile = ref(false)
const sidebarOpen = ref(false)
const collapsed = ref(localStorage.getItem('adminSidebarCollapsed') === '1')
const notificationVisible = ref(false)
const notificationLoading = ref(false)
const notificationGroups = ref([])
const notificationUnavailable = ref([])
const notificationTotal = computed(() => notificationGroups.value.reduce((sum, group) => sum + Number(group.count || 0), 0))
let notificationLoadedAt = 0
let notificationRefreshTimer = null

const menuTitles = {
  home: '工作台首页',
  workorder: '报修工单处理中心',
  inventory: '配件库存管理',
  finance: '财务中心（对账流水 · 开票管理）',
  settlement: '结算管理',
  logistics: '物流管理（批量导入 · 异常预警 · 台账）',
  invoices: '开票管理（申请·开票·专票邮寄）',
  faultdb: '产品分类与故障预设',
  users: '用户管理',
  settings: '小程序图文及政策配置',
  feedback: '客户投诉与建议列表',
  audit: '工单操作审计日志（合规备查）'
}

const roleMap = { superadmin: '超级管理员', admin: '管理员', engineer: '工程师', finance: '财务', support: '客服' }
const canLoadWarrantyNotifications = () => ['superadmin', 'admin', 'support'].includes(getCurrentAdminRole())
const notificationTagType = (severity) => ({ critical: 'danger', warning: 'warning', info: 'primary' }[severity] || 'info')
const notificationRoutes = {
  warranty_missing: { path: '/customers', query: { alert: 'missing' } },
  warranty_expiring: { path: '/customers', query: { alert: 'expiring' } },
  warranty_expired: { path: '/customers', query: { alert: 'expired' } },
  logistics: { path: '/logistics', query: { tab: 'exception' } },
  quote: { path: '/workorder', query: { todo: 'quote' } },
  payment: { path: '/workorder', query: { todo: 'payment' } },
  invoice: { path: '/invoices', query: { status: 'pending' } },
  sla_warning: { path: '/workorder', query: { sla: 'warning' } },
  sla_critical: { path: '/workorder', query: { sla: 'critical' } }
}
const warrantyNotificationMeta = {
  missing: { title: '保修资料待补充', severity: 'info', key: 'warranty_missing', desc: item => `${item.customer_name || '客户'} · ${item.product_name || '设备'}，请补充质保资料` },
  expiring: { title: '保修即将到期', severity: 'warning', key: 'warranty_expiring', desc: item => `${item.customer_name || '客户'} · ${item.product_name || '设备'}，到期日 ${item.effective_expire || '-'}` },
  expired: { title: '保修已过期', severity: 'warning', key: 'warranty_expired', desc: item => `${item.customer_name || '客户'} · ${item.product_name || '设备'}，请核对是否延保` }
}
const getMenuFromPath = () => route.path.replace(/^\//, '') || 'home'
const activeMenu = ref(getMenuFromPath())

const profileDrawerVisible = ref(false)
const profileForm = reactive({ username: '', realName: '', phone: '', role: '', avatar: '' })
const profileSaving = ref(false)
const profileAvatarUrl = ref('')
const pendingAvatarPreview = ref('')
const avatarRemovalPending = ref(false)
let pendingAvatarFile = null
const profileAvatarDisplay = computed(() => pendingAvatarPreview.value || (avatarRemovalPending.value ? '' : profileAvatarUrl.value))
const profileEntryLabel = computed(() => `当前账号：${profileForm.realName || profileForm.username || '管理员'}`)
const pwdDialogVisible = ref(false)
const forcedPasswordChange = ref(localStorage.getItem('adminMustChangePassword') === '1')
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

const toggleSidebar = () => {
  if (isMobile.value) {
    sidebarOpen.value = !sidebarOpen.value
  } else {
    collapsed.value = !collapsed.value
    try { localStorage.setItem('adminSidebarCollapsed', collapsed.value ? '1' : '0') } catch (e) { /* ignore */ }
  }
}

const syncProfileFromStorage = () => {
  try {
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}')
    profileForm.username = user.username || ''
    profileForm.realName = user.name || ''
    profileForm.phone = user.phone || ''
    profileForm.role = user.roleDisplay || roleMap[user.role] || ''
    profileForm.avatar = user.avatar || ''
    profileAvatarUrl.value = user.avatarPreview || (/^https?:\/\//i.test(user.avatar || '') ? user.avatar : '')
  } catch (error) {
    localStorage.removeItem('adminUser')
  }
}

const resolveProfileAvatar = async () => {
  const avatar = profileForm.avatar
  if (!avatar) {
    profileAvatarUrl.value = ''
    return
  }
  if (/^https?:\/\//i.test(avatar)) {
    profileAvatarUrl.value = avatar
    return
  }
  if (!avatar.startsWith('cloud://')) return
  try {
    const map = await getTempFileURL(localStorage.getItem('adminToken'), [avatar])
    if (profileForm.avatar === avatar) profileAvatarUrl.value = map?.[avatar] || ''
  } catch (error) {
    profileAvatarUrl.value = ''
  }
}

const revokePendingAvatar = () => {
  if (pendingAvatarPreview.value.startsWith('blob:')) URL.revokeObjectURL(pendingAvatarPreview.value)
  pendingAvatarPreview.value = ''
  pendingAvatarFile = null
}

const handleAvatarSelect = (uploadFile) => {
  const raw = uploadFile?.raw
  if (!raw) return
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(raw.type) || !/\.(jpe?g|png|webp)$/i.test(raw.name || '')) {
    ElMessage.warning('头像仅支持 JPG、PNG 或 WebP 图片')
    return
  }
  if (raw.size > 2 * 1024 * 1024) {
    ElMessage.warning('头像图片不能超过 2MB')
    return
  }
  revokePendingAvatar()
  avatarRemovalPending.value = false
  pendingAvatarFile = raw
  pendingAvatarPreview.value = URL.createObjectURL(raw)
}

const removeAvatar = () => {
  revokePendingAvatar()
  profileForm.avatar = ''
  avatarRemovalPending.value = true
}

const resetProfileDraft = () => {
  revokePendingAvatar()
  avatarRemovalPending.value = false
  syncProfileFromStorage()
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

const saveProfile = async () => {
  if (profileSaving.value) return
  const name = profileForm.realName.trim()
  const phone = profileForm.phone.trim()
  if (!name) {
    ElMessage.warning('请输入真实姓名')
    return
  }
  if (name.length > 50) {
    ElMessage.warning('真实姓名不能超过 50 个字符')
    return
  }
  const isMobilePhone = /^1[3-9]\d{9}$/.test(phone)
  const isLandlinePhone = /^(?:0\d{2,3}[- ]?)?\d{7,8}(?:[- ]?\d{1,6})?$/.test(phone)
  if (phone && !isMobilePhone && !isLandlinePhone) {
    ElMessage.warning('请输入有效的手机号或座机号')
    return
  }

  profileSaving.value = true
  try {
    const token = localStorage.getItem('adminToken')
    let avatar = profileForm.avatar
    let avatarPreview = profileAvatarUrl.value
    if (pendingAvatarFile) {
      const uploaded = await uploadAvatarToCloud(pendingAvatarFile)
      avatar = uploaded.fileUrl
      avatarPreview = uploaded.tempUrl || pendingAvatarPreview.value
    }
    const res = await updateMyProfile(token, { name, phone, avatar })
    const profile = res?.data || res || { name, phone, avatar }
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}')
    localStorage.setItem('adminUser', JSON.stringify({
      ...user,
      name: profile.name || name,
      phone: profile.phone ?? phone,
      avatar: profile.avatar ?? avatar,
      avatarPreview: profile.avatar || avatar ? avatarPreview : ''
    }))
    profileForm.realName = profile.name || name
    profileForm.phone = profile.phone ?? phone
    profileForm.avatar = profile.avatar ?? avatar
    profileAvatarUrl.value = profileForm.avatar ? avatarPreview : ''
    avatarRemovalPending.value = false
    revokePendingAvatar()
    if (profileForm.avatar && !profileAvatarUrl.value) await resolveProfileAvatar()
    profileDrawerVisible.value = false
    ElMessage.success('个人资料已保存')
  } catch (error) {
    ElMessage.error(error.message || '个人资料保存失败')
  } finally {
    profileSaving.value = false
  }
}

const openProfileDrawer = () => {
  syncProfileFromStorage()
  resolveProfileAvatar()
  profileDrawerVisible.value = true
}

const loadNotifications = async (force = false) => {
  const now = Date.now()
  if (notificationLoading.value || (!force && notificationLoadedAt && now - notificationLoadedAt < 30000)) return
  const token = localStorage.getItem('adminToken')
  if (!token) return
  notificationLoading.value = true
  try {
    const requests = [getNotificationSummary(token)]
    if (canLoadWarrantyNotifications()) requests.push(getWarrantyAlerts({ page: 1, pageSize: 5 }))
    const results = await Promise.allSettled(requests)
    const groups = []
    const unavailable = []
    const orderResult = results[0]
    if (orderResult.status === 'fulfilled') {
      const data = orderResult.value?.data || orderResult.value || {}
      groups.push(...(Array.isArray(data.groups) ? data.groups : []))
      unavailable.push(...(Array.isArray(data.unavailable) ? data.unavailable : []))
    } else {
      unavailable.push('工单提醒')
    }
    if (canLoadWarrantyNotifications()) {
      const warrantyResult = results[1]
      if (warrantyResult && warrantyResult.status === 'fulfilled') {
        const data = warrantyResult.value?.data || warrantyResult.value || {}
        const counts = data.counts || {}
        const samples = data.samples || {}
        Object.entries(warrantyNotificationMeta).forEach(([category, meta]) => {
          const count = Number(counts[category] || 0)
          if (!count) return
          groups.push({
            key: meta.key,
            title: meta.title,
            severity: meta.severity,
            count,
            samples: (samples[category] || []).map(item => ({
              id: item.device_id || '',
              title: `${item.customer_name || '客户'} · ${item.product_name || '设备'}`,
              desc: meta.desc(item)
            }))
          })
        })
      } else {
        unavailable.push('保修待办')
      }
    }
    const severityRank = { critical: 0, warning: 1, info: 2 }
    notificationGroups.value = groups.sort((a, b) => (severityRank[a.severity] - severityRank[b.severity]) || Number(b.count || 0) - Number(a.count || 0))
    notificationUnavailable.value = [...new Set(unavailable)]
    notificationLoadedAt = Date.now()
  } finally {
    notificationLoading.value = false
  }
}

const goNotification = (key) => {
  const target = notificationRoutes[key]
  if (!target) return
  notificationVisible.value = false
  router.push(target)
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') loadNotifications(true)
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
  if (pwdForm.newPassword.length < 10 || !/[A-Za-z]/.test(pwdForm.newPassword) || !/\d/.test(pwdForm.newPassword)) {
    ElMessage.warning('新密码至少需要 10 位，并同时包含字母和数字')
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
    localStorage.removeItem('adminMustChangePassword')
    ElMessage.success('密码修改成功，请使用新密码重新登录')
    router.push('/login')
  } catch (error) {
    ElMessage.error(error.message || '密码修改失败')
  } finally {
    pwdSaving.value = false
  }
}

watch(() => route.path, () => { activeMenu.value = getMenuFromPath() })
watch(() => route.fullPath, () => { loadNotifications() })

onMounted(() => {
  checkMobile()
  syncProfileFromStorage()
  resolveProfileAvatar()
  loadNotifications()
  notificationRefreshTimer = window.setInterval(() => loadNotifications(true), 60000)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (forcedPasswordChange.value) {
    ElMessage.warning('当前使用临时密码，请先修改登录密码')
    openPwdDialog()
  }
  window.addEventListener('resize', checkMobile)
})
onUnmounted(() => {
  revokePendingAvatar()
  if (notificationRefreshTimer) window.clearInterval(notificationRefreshTimer)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('resize', checkMobile)
})
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
  transition: transform 0.3s ease, width 0.3s ease;
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
@media screen and (min-width: 769px) {
  .sidebar.collapsed {
    width: var(--sidebar-collapsed-width, 80px);
  }
  .sidebar.collapsed .sidebar-logo,
  .sidebar.collapsed .nav-label,
  .sidebar.collapsed .sidebar-footer {
    display: none;
  }
  .sidebar.collapsed .el-menu-vertical {
    --el-menu-collapse-width: 62px;
    padding: 0 8px 10px;
  }
  .sidebar.collapsed :deep(.el-menu-item) {
    padding: 0 !important;
    justify-content: center;
  }
  .sidebar.collapsed :deep(.el-menu-item .el-icon) {
    margin-right: 0;
  }
  .sidebar.collapsed :deep(.el-menu-item.is-active::after) {
    display: none;
  }
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
.notification-trigger {
  width: 38px;
  height: 38px;
  border: 1px solid #dbeafe;
  background: #f8fbff;
  color: #334155;
}
.notification-trigger:hover, .notification-trigger:focus-visible { border-color: #93c5fd; background: #eff6ff; color: #2563eb; }
.notification-badge :deep(.el-badge__content) { top: 2px; right: 4px; border: 2px solid #ffffff; }
.notification-panel { max-height: min(620px, calc(100vh - 112px)); overflow: hidden; }
.notification-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
.notification-panel-head strong, .notification-panel-head span { display: block; }
.notification-panel-head strong { color: #0f172a; font-size: 16px; }
.notification-panel-head span { margin-top: 3px; color: #64748b; font-size: 12px; }
.notification-alert { margin-top: 12px; }
.notification-groups { max-height: min(516px, calc(100vh - 220px)); padding-top: 12px; overflow-y: auto; overscroll-behavior: contain; }
.notification-group { padding: 10px 0; border-bottom: 1px solid #eef2f7; }
.notification-group:last-child { border-bottom: 0; }
.notification-group-head { width: 100%; display: grid; grid-template-columns: 8px minmax(0, 1fr) auto 18px; align-items: center; gap: 9px; padding: 0; border: 0; background: transparent; color: #0f172a; text-align: left; cursor: pointer; }
.notification-group-head strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.notification-severity { width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; }
.notification-group--critical .notification-severity { background: #ef4444; }
.notification-group--warning .notification-severity { background: #f59e0b; }
.notification-go { color: #94a3b8; }
.notification-sample { width: calc(100% - 17px); display: block; margin: 8px 0 0 17px; padding: 8px 10px; border: 0; border-radius: 6px; background: #f8fafc; color: #334155; text-align: left; cursor: pointer; }
.notification-sample:hover { background: #eff6ff; }
.notification-sample strong, .notification-sample span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.notification-sample strong { font-size: 13px; font-weight: 600; }
.notification-sample span { margin-top: 3px; color: #64748b; font-size: 12px; }
.notification-more { margin: 6px 0 0 13px; }
.admin-avatar { cursor: pointer; border: 1px solid #bfdbfe; background: #eff6ff; }
.content-area { flex: 1; overflow-y: auto; padding: 30px 28px 44px; }
.content-wrapper { width: 100%; max-width: none; margin: 0; }
.profile-content { min-height: 100%; }
.profile-avatar { display:flex; flex-direction:column; align-items:center; padding: 6px 0 26px; }
.profile-avatar-picker { position: relative; width: 88px; height: 88px; }
.profile-avatar-picker > .admin-avatar { width: 88px !important; height: 88px !important; cursor: default; }
.avatar-upload { position: absolute; right: -4px; bottom: -4px; }
.avatar-edit-button, .avatar-remove-button { width: 30px; height: 30px; padding: 0; box-shadow: 0 0 0 3px #ffffff; }
.avatar-remove-button { position: absolute; left: -4px; bottom: -4px; color: #64748b; }
.profile-avatar strong { margin-top: 12px; color: #172033; font-size: 18px; }
.profile-avatar span { margin-top: 4px; color: #64748b; font-size: 13px; }
.profile-avatar small { margin-top: 8px; color: #94a3b8; font-size: 12px; }
.profile-form :deep(.el-form-item) { margin-bottom: 20px; }
.profile-form :deep(.el-form-item__label) { padding-bottom: 7px; color: #475569; font-weight: 600; }
.profile-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; width: 100%; }
.profile-actions .el-button { width: 100%; height: 40px; margin: 0; }
:global(.profile-drawer.el-drawer) { display: flex; flex-direction: column; max-width: 100vw; }
:global(.profile-drawer .el-drawer__header) { flex: 0 0 auto; margin-bottom: 0; padding: 22px 24px 18px; border-bottom: 1px solid #e2e8f0; }
:global(.profile-drawer .el-drawer__title) { color: #172033; font-size: 20px; font-weight: 700; }
:global(.profile-drawer .el-drawer__body) { flex: 1 1 auto; min-height: 0; padding: 24px; overflow-y: auto; }
:global(.profile-drawer .el-drawer__footer) { flex: 0 0 auto; padding: 16px 24px calc(16px + env(safe-area-inset-bottom)); border-top: 1px solid #e2e8f0; background: #ffffff; }
@media screen and (max-width: 768px) {
  .main-layout { height: 100dvh; overflow: hidden; }
  .mobile-mask { backdrop-filter: blur(2px); }
  .sidebar {
    width: min(86vw, 320px);
    min-height: 100dvh;
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    box-shadow: 18px 0 40px rgba(15, 23, 42, 0.18);
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar-logo { padding: 16px 18px 12px; }
  .logo-card { height: 60px; border-radius: 8px; }
  .logo-card img { width: 176px; max-height: 36px; }
  .nav-label { padding: 12px 26px 7px; }
  .el-menu-vertical { padding: 0 16px 10px; gap: 5px; }
  :deep(.el-menu-item) { height: 50px; padding: 0 14px !important; font-size: 15px; }
  :deep(.el-menu-item .el-icon) { width: 30px; height: 30px; margin-right: 10px; }
  .sidebar-footer { padding: 12px 16px 16px; }
  .status-card { padding: 14px; border-radius: 8px; }
  .top-header {
    height: 62px;
    padding: 0 12px;
    gap: 10px;
  }
  .header-left { min-width: 0; gap: 10px; }
  .header-actions { flex-shrink: 0; gap: 8px; }
  .hamburger { flex: 0 0 auto; font-size: 22px; }
  .breadcrumb-title {
    min-width: 0;
    overflow: hidden;
    color: #172033;
    font-size: 17px;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .visit-miniapp-btn { display: none; }
  .notification-trigger { width: 34px; height: 34px; }
  .notification-badge :deep(.el-badge__content) { top: 0; right: 2px; }
  .admin-avatar { width: 34px !important; height: 34px !important; }
  .content-area {
    overflow-x: hidden;
    padding: 12px 12px 28px;
    overscroll-behavior: contain;
  }
  .content-wrapper { min-width: 0; }
  :global(.profile-drawer .el-drawer__header) { padding: 17px 18px 15px; }
  :global(.profile-drawer .el-drawer__body) { padding: 20px 18px; }
  :global(.profile-drawer .el-drawer__footer) { padding: 12px 18px calc(12px + env(safe-area-inset-bottom)); }
  .profile-avatar { padding-bottom: 20px; }
  .profile-actions { grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); }
  :deep(.el-dialog) { width: calc(100vw - 24px) !important; max-width: 400px; }
}
</style>
