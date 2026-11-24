// 前端入口文件：创建 Vue 应用，按顺序安装各种插件（Pinia / Router / Element Plus）
import { createApp } from 'vue'

import { createPinia } from 'pinia'            // 状态管理：跨组件共享登录信息等数据
import ElementPlus from 'element-plus'         // UI 组件库
import zhCn from 'element-plus/es/locale/lang/zh-cn' // Element Plus 中文语言包（分页等组件显示中文）
import 'element-plus/dist/index.css'           // Element Plus 样式
import * as ElementPlusIconsVue from '@element-plus/icons-vue' // 全部 Element Plus 图标

import App from './App.vue'
import router from './router'
import perm from './directives/perm'           // 自定义指令 v-perm：按钮级权限控制
import './styles/index.css'

const app = createApp(App)

app.use(createPinia())                         // 1. 装 Pinia（必须在 Router 之前，路由守卫里要用）
app.use(router)                                // 2. 装路由
app.use(ElementPlus, { locale: zhCn })         // 3. 装 Element Plus（完整引入，最简单；项目大了可改按需引入）

// 4. 把 Element Plus 的所有图标注册成全局组件，
//    这样后端菜单表配置的图标名（如 "Setting"）可以直接 <component :is="menu.icon" /> 使用
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component)
}

// 5. 注册自定义权限指令 v-perm，用法：<el-button v-perm="'user:create'">新增</el-button>
//    没有权限的用户该按钮会被直接从 DOM 中移除
app.directive('perm', perm)

app.mount('#app')
