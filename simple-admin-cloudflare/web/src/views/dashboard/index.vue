<script setup>
// 仪表盘首页：展示当前登录信息 + 项目说明
import { useUserStore } from '@/stores/user'

const store = useUserStore()
</script>

<template>
  <div>
    <el-card>
      <h2>👋 你好，{{ store.info?.nickname || store.info?.username }}！</h2>
      <p>
        欢迎体验这个「最简版」后台管理系统。整个项目只保留了最核心的两块功能：
        <b>用户登录</b> 和 <b>RBAC 权限管理</b>，代码和注释都专为初学者编写。
      </p>
      <p>
        当前角色：
        <el-tag v-for="r in store.roles" :key="r" style="margin-right: 6px">{{ r }}</el-tag>
      </p>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :xs="24" :sm="8" style="margin-bottom: 16px">
        <el-card>
          <h3>🔐 登录鉴权</h3>
          <p class="desc">
            后端用 JWT 签发登录令牌，前端每次请求自动携带；
            令牌过期或无效时统一返回 401，前端自动跳回登录页。
          </p>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8" style="margin-bottom: 16px">
        <el-card>
          <h3>🧭 动态菜单与路由</h3>
          <p class="desc">
            左侧导航和页面路由都不写死在前端，而是登录后根据角色拥有的菜单动态生成，
            没权限的页面直接输 URL 也访问不到。
          </p>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8" style="margin-bottom: 16px">
        <el-card>
          <h3>🔘 按钮级权限</h3>
          <p class="desc">
            页面上的「新增 / 编辑 / 删除」按钮由 v-perm 指令控制显隐，
            后端接口也有对应的权限校验，双保险。
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.desc {
  color: #666;
  line-height: 1.8;
}
</style>
