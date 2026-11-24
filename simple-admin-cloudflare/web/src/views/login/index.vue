<script setup>
// 登录页
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const store = useUserStore()

// 表单数据（演示方便，预填了管理员账号，正式项目应留空）
const form = reactive({
  username: 'admin',
  password: 'admin123'
})
const loading = ref(false)

// 登录：成功后跳回首页（路由守卫会接着拉用户信息、注册动态路由）
async function onLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await store.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.push('/')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card">
      <h2 class="title">🚀 Simple Admin</h2>
      <p class="subtitle">最简后台管理系统 · 登录</p>
      <el-form :model="form" size="large" @keyup.enter="onLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="'User'" />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            show-password
            :prefix-icon="'Lock'"
          />
        </el-form-item>
        <el-button type="primary" class="login-btn" :loading="loading" @click="onLogin">
          登 录
        </el-button>
      </el-form>
      <div class="tips">
        <p>演示账号：admin / admin123（超级管理员）</p>
        <p>演示账号：visitor / 123456（访客，仅查看权限）</p>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 渐变背景 */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 380px;
  border-radius: 12px;
}

.title {
  margin: 0;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: #999;
  margin: 8px 0 24px;
}

.login-btn {
  width: 100%;
}

.tips {
  margin-top: 16px;
  color: #aaa;
  font-size: 12px;
  text-align: center;
  line-height: 1.6;
}
</style>
