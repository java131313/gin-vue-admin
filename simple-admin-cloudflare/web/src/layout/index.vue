<script setup>
// 整体布局：左侧菜单栏 + 顶部栏 + 右侧主内容区
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import SidebarItem from './SidebarItem.vue'

const route = useRoute()
const store = useUserStore()

// 侧边栏数据 = 后端返回的菜单树（按钮 type=2 已在后端组装树时自然不含在导航里：
// 它们也是树的一部分，但 SidebarItem 只渲染目录和菜单两种节点……
// 实际上这里菜单树的叶子都是可点的菜单，按钮节点如果存在会导致空白项，
// 所以前端只保留 type !== 2 的节点）
function filterButtons(menus) {
  return menus
    .filter((m) => m.type !== 2)
    .map((m) => ({ ...m, children: m.children ? filterButtons(m.children) : [] }))
}
const sidebarMenus = computed(() => filterButtons(store.menus))

// 退出登录：调后端登出接口（占位）→ 清本地数据 → 整页回到登录页
// 用整页跳转而不是 router.push，可以把内存里的动态路由、状态全部清零
async function onLogout() {
  await store.logout()
  window.location.href = '/login'
}
</script>

<template>
  <el-container class="layout">
    <!-- 左侧：logo + 导航菜单 -->
    <el-aside width="220px" class="aside">
      <div class="logo">🚀 Simple Admin</div>
      <!-- router 属性：点击菜单项时按 index 的值作为路径跳转 -->
      <el-menu
        :default-active="route.path"
        router
        background-color="#001529"
        text-color="#a6adb4"
        active-text-color="#ffffff"
      >
        <sidebar-item v-for="menu in sidebarMenus" :key="menu.id" :menu="menu" />
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 顶部：系统名 + 当前用户 -->
      <el-header class="header">
        <span class="title">最简后台管理系统（登录 + 权限）</span>
        <el-dropdown @command="onLogout">
          <span class="user">
            <el-icon><User /></el-icon>
            {{ store.info?.nickname || store.info?.username }}
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <!-- 主内容区：具体页面由路由渲染到这里 -->
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100%;
}

.aside {
  background-color: #001529;
}

.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
}

/* 去掉 el-menu 右侧的边框，和背景融为一体 */
.aside :deep(.el-menu) {
  border-right: none;
}

.header {
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.user {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #333;
}

.main {
  padding: 20px;
}
</style>
