// 路由配置 + 全局路由守卫 + 动态路由
//
// 本项目的权限核心之一：「动态路由」。
// 前端只内置了 /login 和布局页两个静态路由，业务页面（用户/角色/菜单管理）
// 都不写死在前端代码里，而是登录后根据后端返回的菜单树动态注册——
// 用户拥有什么菜单，才能访问什么页面，直接输 URL 也进不去没权限的页面。
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

// ---------- 静态路由 ----------
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/index.vue') // 登录页（免权限）
    },
    {
      path: '/',
      name: 'Layout',
      component: () => import('@/layout/index.vue'), // 整体布局：侧边栏 + 顶栏 + 主区域
      redirect: '/dashboard' // 访问根路径自动跳到仪表盘
    }
    // 注意：业务页面路由不在此处写死，由 buildDynamicRoutes() 动态添加
  ]
})

// ---------- 动态路由 ----------
// 收集 views 目录下所有 .vue 文件（懒加载），菜单表里的 component 字段
//（如 "system/user/index"）就是这里的 key，用于找到对应的页面组件
const viewModules = import.meta.glob('../views/**/*.vue')

/**
 * 根据后端返回的菜单树注册动态路由
 * @param {Array} menus 菜单树（来自 /api/auth/info）
 */
export function buildDynamicRoutes(menus) {
  // 菜单是一棵树：「系统管理」目录(type=0)下面挂着用户/角色/菜单管理等子页面，
  // 必须递归遍历整棵树，把每个 type=1 的「菜单」节点都注册成路由
  const walk = (list) => {
    for (const menu of list) {
      // 只有「菜单」类型(type=1)对应真实页面；
      // 目录(type=0)只是导航分组，按钮(type=2)只是权限标识，都不注册路由
      if (menu.type === 1 && menu.component) {
        const loader = viewModules[`../views/${menu.component}.vue`]
        if (!loader) {
          console.warn(`[动态路由] 找不到组件：${menu.component}，请检查菜单配置`)
        } else {
          // 以 Layout 为父路由添加子路由：/system/user 显示在布局的主区域里
          router.addRoute('Layout', {
            path: menu.path,
            name: menu.name,
            component: loader,
            meta: { title: menu.title }
          })
        }
      }
      // 有子节点就继续往下递归
      if (menu.children && menu.children.length) {
        walk(menu.children)
      }
    }
  }
  walk(menus)

  // 所有业务路由注册完后，再注册 404 兜底规则：
  // 没匹配到的地址（包括没权限的页面地址）全部重定向回首页
  router.addRoute({ path: '/:pathMatch(.*)*', redirect: '/' })
}

// ---------- 全局前置守卫：每一次导航都会经过这里 ----------
router.beforeEach(async (to) => {
  const store = useUserStore()

  // 1. 访问登录页：直接放行（已登录时也可以访问，登录页自己处理跳转）
  if (to.path === '/login') return true

  // 2. 没有令牌：任何业务页面都不许进，回登录页
  if (!store.token) return '/login'

  // 3. 有令牌但本次会话还没拉过用户信息（典型场景：按 F5 刷新页面）
  //    此时动态路由还没注册，直接放行会白屏/404，
  //    所以先拉信息、注册动态路由，然后 return to.fullPath 让本次导航"重新走一遍"，
  //    这一次路由表里已经有目标页面了
  if (!store.loaded) {
    await store.fetchInfo()
    buildDynamicRoutes(store.menus)
    return to.fullPath
  }

  // 4. 正常放行，顺便更新浏览器标签页标题
  document.title = to.meta.title ? `${to.meta.title} - Simple Admin` : 'Simple Admin'
  return true
})

export default router
