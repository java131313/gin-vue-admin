<script setup>
// 递归渲染菜单树的组件：
// 有子节点 → el-sub-menu（可折叠的分组）
// 无子节点 → el-menu-item（可点击跳转的菜单项）
//
// 组件在渲染自己的子节点时再次调用自己，这就是「递归组件」。
// Vue3 中 <script setup> 的递归组件必须显式声明 name。
defineOptions({ name: 'SidebarItem' })

defineProps({
  menu: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <!-- 有子菜单：渲染成可展开的分组，标题不可点击跳转 -->
  <el-sub-menu v-if="menu.children && menu.children.length" :index="menu.path">
    <template #title>
      <el-icon><component :is="menu.icon || 'Folder'" /></el-icon>
      <span>{{ menu.title }}</span>
    </template>
    <!-- 递归渲染子菜单 -->
    <sidebar-item v-for="child in menu.children" :key="child.id" :menu="child" />
  </el-sub-menu>

  <!-- 没有子菜单：渲染成可点击的菜单项，index 即路由路径（外层 el-menu 开了 router 模式） -->
  <el-menu-item v-else :index="menu.path">
    <el-icon><component :is="menu.icon || 'Document'" /></el-icon>
    <template #title>{{ menu.title }}</template>
  </el-menu-item>
</template>
