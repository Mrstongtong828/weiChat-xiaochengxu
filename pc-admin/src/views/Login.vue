<template>
  <div class="login-wrapper">
    <ShadCard class="login-card">
      <div class="brand-panel">
        <ShadBadge variant="primary">Docte Admin</ShadBadge>
        <h1>欢迎回来</h1>
        <p>登录牙科仪器检修管理系统，继续处理工单、报价、物流与客户反馈。</p>
      </div>

      <el-form :model="loginForm" class="login-form" @keyup.enter="handleLogin">
        <el-form-item>
          <el-input v-model.trim="loginForm.username" type="text" inputmode="text" placeholder="请输入账号" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="loginForm.password" type="password" inputmode="text" placeholder="请输入密码" show-password size="large" />
        </el-form-item>
        <ShadButton class="login-button" :loading="loading" @click="handleLogin">登录系统</ShadButton>
      </el-form>
    </ShadCard>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { adminLogin } from '../api/admin.js'
import { resetSessionExpiredNotice } from '../utils/adminSession.js'
import ShadCard from '../components/ui/ShadCard.vue'
import ShadBadge from '../components/ui/ShadBadge.vue'
import ShadButton from '../components/ui/ShadButton.vue'

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
.login-wrapper {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.18), transparent 30rem),
    radial-gradient(circle at 80% 10%, #cffafe, transparent 26rem),
    hsl(var(--background));
}
.login-card {
  width: 460px;
  max-width: 100%;
  padding: 32px;
}
.brand-panel { margin-bottom: 26px; }
.brand-panel h1 { margin: 16px 0 10px; font-size: 30px; letter-spacing: -0.05em; }
.brand-panel p { margin: 0; color: hsl(var(--muted-foreground)); line-height: 1.7; }
.login-form { display: grid; gap: 2px; }
.login-button { width: 100%; margin-top: 6px; border: none; cursor: pointer; }
.login-button:disabled { cursor: not-allowed; opacity: .75; }
</style>
