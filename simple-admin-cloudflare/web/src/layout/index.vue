<script setup>
// 整体布局：左侧菜单栏 + 顶部栏 + 右侧主内容区
//
// 响应式适配：
//   桌面端（≥768px）：固定侧边栏，与原来一致
//   手机端（<768px）：侧边栏藏进抽屉，点顶部汉堡按钮唤出；
//   点击菜单项后自动收起抽屉；标题、内边距随屏幕收窄
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import SidebarItem from './SidebarItem.vue'

const route = useRoute()
const store = useUserStore()

// ---------- 响应式：判断是否为手机屏 ----------
const isMobile = ref(false)
function checkScreen() {
  isMobile.value = window.innerWidth < 768
}
let resizeTimer = null
function onResize() {
  // 节流：窗口拖拽时最多 200ms 判断一次
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(checkScreen, 200)
}
onMounted(() => {
  checkScreen()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  clearTimeout(resizeTimer)
  window.removeEventListener('resize', onResize)
})

// 手机端抽屉
const drawerVisible = ref(false)
function openDrawer() {
  drawerVisible.value = true
}
// 手机端点击菜单项后自动收起抽屉
function onMenuSelect() {
  if (isMobile.value) drawerVisible.value = false
}

// 侧边栏只显示「目录」和「菜单」两种类型，按钮权限(type=2)过滤掉
function filterButtons(menus) {
  return menus
    .filter((m) => m.type !== 2)
    .map((m) => ({ ...m, children: m.children ? filterButtons(m.children) : [] }))
}
const sidebarMenus = computed(() => filterButtons(store.menus))

// 退出登录
async function onLogout() {
  await store.logout()
  window.location.href = '/login'
}
</script>

<template>
  <el-container class="layout">
    <!-- 桌面端：固定侧边栏 -->
    <el-aside v-if="!isMobile" width="220px" class="aside">
      <div class="logo">🚀 Simple Admin</div>
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

    <!-- 手机端：抽屉式侧边栏（汉堡按钮唤出） -->
    <el-drawer
      v-model="drawerVisible"
      direction="ltr"
      size="240px"
      :with-header="false"
      class="mobile-aside"
    >
      <div class="logo">🚀 Simple Admin</div>
      <el-menu
        :default-active="route.path"
        router
        background-color="#001529"
        text-color="#a6adb4"
        active-text-color="#ffffff"
        @select="onMenuSelect"
      >
        <sidebar-item v-for="menu in sidebarMenus" :key="menu.id" :menu="menu" />
      </el-menu>
    </el-drawer>

    <el-container>
      <!-- 顶部栏 -->
      <el-header class="header">
        <div class="header-left">
          <!-- 手机端的汉堡按钮 -->
          <el-button v-if="isMobile" class="menu-btn" :icon="'Menu'" circle @click="openDrawer" />
          <span class="title">{{ isMobile ? 'Simple Admin' : '最简后台管理系统（登录 + 权限）' }}</span>
        </div>
        <el-dropdown @command="onLogout">
          <span class="user">
            <el-icon><User /></el-icon>
            <span class="username">{{ store.info?.nickname || store.info?.username }}</span>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <!-- 主内容区 -->
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
  white-space: nowrap;
}

/* 手机抽屉里的菜单同样铺满深色背景 */
.mobile-aside :deep(.el-drawer) {
  background-color: #001529;
}

.mobile-aside :deep(.el-drawer__body) {
  padding: 0;
  background-color: #001529;
  overflow-y: auto;
}

.aside :deep(.el-menu),
.mobile-aside :deep(.el-menu) {
  border-right: none;
}

.header {
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  padding: 0 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.menu-btn {
  flex-shrink: 0;
}

.title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #333;
  flex-shrink: 0;
}

.username {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main {
  padding: 20px;
}

/* ---------- 手机端适配 ---------- */
@media (max-width: 768px) {
  .main {
    padding: 10px;
  }

  .header {
    padding: 0 10px;
  }

  .title {
    font-size: 15px;
  }
}
</style>
