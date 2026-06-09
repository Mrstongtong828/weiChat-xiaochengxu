<template>
  <div class="login-wrapper">
    <el-card class="login-card" shadow="always">
      <h2 class="login-title">牙科仪器检修管理系统 - 登录</h2>
      <el-form :model="loginForm">
        <el-form-item>
          <el-input v-model.trim="loginForm.username" type="text" inputmode="text" placeholder="请输入账号"></el-input>
        </el-form-item>
        <el-form-item>
          <el-input v-model="loginForm.password" type="password" inputmode="text" placeholder="请输入密码" show-password></el-input>
        </el-form-item>
        <el-button type="primary" style="width:100%;" @click="handleLogin" :loading="loading">登录</el-button>
      </el-form>
    </el-card>
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
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e8f3ff 0%, #f4f9ff 48%, #dff3ff 100%);
}
.login-card {
  width: 420px;
  max-width: calc(100vw - 32px);
  border-radius: 16px;
}
.login-title {
  margin: 0 0 24px;
  text-align: center;
  color: #1d2129;
  font-size: 20px;
  font-weight: 600;
}
</style>
