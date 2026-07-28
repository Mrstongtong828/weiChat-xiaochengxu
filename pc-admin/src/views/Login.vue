<template>
  <div class="login-page">
    <section class="login-visual" aria-label="思科达设备检修服务">
      <div class="visual-shade"></div>
      <div class="visual-content">
        <img class="visual-logo" src="/brand/cicada-admin-logo.png" alt="CICADA 思科达">
        <div class="visual-copy">
          <span class="visual-kicker">DENTAL EQUIPMENT SERVICE</span>
          <h1>维修服务指挥台</h1>
          <p>让工单、报价、物流与结算始终处于可追踪的工作流中。</p>
        </div>
        <div class="visual-status">
          <span class="visual-status-dot"></span>
          服务台系统运行正常
        </div>
      </div>
    </section>

    <main class="login-surface">
      <div class="login-content">
        <div class="login-brand-mobile">
          <img src="/brand/cicada-admin-logo.png" alt="CICADA 思科达">
        </div>
        <div class="login-heading">
          <el-tag type="primary" effect="light" size="small">后台管理</el-tag>
          <h2>欢迎回来</h2>
          <p>使用管理账号登录服务工作台。</p>
        </div>

        <el-form :model="loginForm" class="login-form" @keyup.enter="handleLogin">
          <el-form-item label="账号">
            <el-input
              v-model.trim="loginForm.username"
              type="text"
              inputmode="text"
              placeholder="请输入账号"
              prefix-icon="User"
              size="large"
              autocomplete="username"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="loginForm.password"
              type="password"
              inputmode="text"
              placeholder="请输入密码"
              prefix-icon="Lock"
              show-password
              size="large"
              autocomplete="current-password"
            />
          </el-form-item>
          <el-button class="login-button" type="primary" size="large" :loading="loading" @click="handleLogin">
            登录工作台
          </el-button>
        </el-form>

        <p class="login-note">仅限已授权的管理员、工程师、财务和客服人员使用。</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { adminLogin } from '../api/admin.js'
import { resetSessionExpiredNotice } from '../utils/adminSession.js'

const router = useRouter()
const loginForm = reactive({ username: '', password: '' })
const loading = ref(false)

const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }

  loading.value = true
  try {
    const res = await adminLogin(loginForm.username, loginForm.password)
    localStorage.setItem('adminToken', res.token)
    localStorage.setItem('adminUser', JSON.stringify(res.user))
    if (res.mustChangePassword) localStorage.setItem('adminMustChangePassword', '1')
    else localStorage.removeItem('adminMustChangePassword')
    resetSessionExpiredNotice()
    ElMessage.success('登录成功')
    router.push('/home')
  } catch (error) {
    if (!error.__displayed) {
      ElMessage.error(error.message || '登录失败')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: minmax(440px, 1.12fr) minmax(430px, .88fr);
  min-height: 100vh;
  padding: 18px;
  background: #f4f7fa;
}

.login-visual {
  position: relative;
  overflow: hidden;
  min-height: calc(100vh - 36px);
  border-radius: 8px;
  background: #174a95 url('/brand/cicada-factory.jpg') center / cover no-repeat;
  color: #ffffff;
}

.visual-shade {
  position: absolute;
  inset: 0;
  background: rgba(15, 48, 97, .8);
}

.visual-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: calc(100vh - 36px);
  padding: clamp(32px, 5vw, 72px);
}

.visual-logo { width: min(220px, 58%); height: auto; filter: brightness(0) invert(1); }
.visual-copy { margin-top: auto; max-width: 510px; }
.visual-kicker { display: block; margin-bottom: 14px; color: #9dd4ff; font-size: 11px; font-weight: 700; letter-spacing: .12em; }
.visual-copy h1 { margin: 0; font-size: clamp(34px, 4vw, 58px); font-weight: 700; line-height: 1.16; letter-spacing: 0; }
.visual-copy p { margin: 18px 0 0; max-width: 430px; color: #d8e9fc; font-size: 16px; line-height: 1.8; }
.visual-status { display: inline-flex; align-items: center; gap: 8px; margin-top: 42px; color: #d8e9fc; font-size: 13px; }
.visual-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #54d1bf; box-shadow: 0 0 0 4px rgba(84, 209, 191, .16); }

.login-surface { display: grid; place-items: center; padding: 48px clamp(28px, 7vw, 112px); background: #ffffff; }
.login-content { width: 100%; max-width: 390px; }
.login-brand-mobile { display: none; }
.login-heading { margin-bottom: 34px; }
.login-heading h2 { margin: 14px 0 8px; color: #182738; font-size: 32px; font-weight: 700; line-height: 1.2; letter-spacing: 0; }
.login-heading p { margin: 0; color: #6b7b8f; font-size: 14px; line-height: 1.6; }
.login-form { display: grid; gap: 4px; }
.login-form :deep(.el-form-item) { margin-bottom: 16px; }
.login-form :deep(.el-form-item__label) { padding-bottom: 7px; color: #36465a; font-size: 14px; font-weight: 600; line-height: 1.25; }
.login-form :deep(.el-input__wrapper) { min-height: 46px; background: #f6f8fb; box-shadow: 0 0 0 1px #e0e7ef inset !important; }
.login-form :deep(.el-input__wrapper.is-focus) { background: #ffffff; box-shadow: 0 0 0 1px hsl(var(--ring)) inset, 0 0 0 4px hsl(var(--ring) / .1) !important; }
.login-form :deep(.el-input__prefix-inner) { color: #8090a4; }
.login-button { width: 100%; height: 46px; margin-top: 8px; font-weight: 700; }
.login-note { margin: 22px 0 0; color: #8a98a8; font-size: 12px; line-height: 1.7; }

@media (max-width: 920px) {
  .login-page { grid-template-columns: 1fr; padding: 0; }
  .login-visual { display: none; }
  .login-surface { min-height: 100vh; padding: 32px 24px; background: #f4f7fa; }
  .login-content { padding: 32px 28px; border: 1px solid #e1e8f0; border-radius: 8px; background: #ffffff; box-shadow: 0 10px 30px rgba(24, 39, 59, .08); }
  .login-brand-mobile { display: block; margin-bottom: 36px; }
  .login-brand-mobile img { width: 184px; height: auto; }
}

@media (max-width: 480px) {
  .login-surface { align-items: start; padding: 24px 16px; }
  .login-content { margin-top: 48px; padding: 26px 22px; }
  .login-brand-mobile { margin-bottom: 28px; }
  .login-heading { margin-bottom: 28px; }
  .login-heading h2 { font-size: 28px; }
}
</style>
