// 用户状态仓库（Pinia）：保存登录状态，供全项目共享
//
// 里面保存的四个关键数据都来自后端 GET /api/auth/info：
//   token  —— 登录令牌（持久化在 localStorage，刷新不丢）
//   info   —— 当前用户信息（昵称、头像等，右上角展示用）
//   perms  —— 权限标识列表（按钮级权限 v-perm 用它判断）
//   menus  —— 菜单树（侧边栏渲染 + 动态路由注册用）
import { defineStore } from 'pinia'
import { login as apiLogin, getInfo as apiGetInfo, logout as apiLogout } from '@/api/auth'
import { getToken, setToken, clearToken } from '@/utils/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(), // 初始化时从 localStorage 恢复，实现"刷新页面保持登录"
    info: null,        // 用户信息：{id, username, nickname, ...}
    roles: [],         // 角色编码数组，如 ['admin']
    perms: [],         // 权限标识数组，如 ['user:list', 'user:create', ...]
    menus: [],         // 菜单树（已按父子层级组装好）
    loaded: false      // 本次页面会话是否已拉取过用户信息（动态路由是否已注册）
  }),

  actions: {
    // 登录：拿到令牌并保存
    async login(username, password) {
      const res = await apiLogin({ username, password })
      this.token = res.data.token
      setToken(res.data.token) // 写入 localStorage
    },

    // 拉取当前用户信息 + 权限 + 菜单（刷新页面、或直接刷新浏览器标签页时调用）
    async fetchInfo() {
      const res = await apiGetInfo()
      this.info = res.data.user
      this.roles = res.data.roles
      this.perms = res.data.perms
      this.menus = res.data.menus
      this.loaded = true
      // 权限标识同时存一份到 localStorage，供 v-perm 指令读取
      // （指令里不引 store 是为了避免与 store → api → request 形成复杂的模块依赖）
      localStorage.setItem('simple_admin_perms', JSON.stringify(this.perms))
    },

    // 登出：通知后端（占位）+ 清除本地数据
    async logout() {
      try {
        await apiLogout()
      } catch (e) {
        // 即使后端调用失败也要继续本地登出
      }
      clearToken()
      localStorage.removeItem('simple_admin_perms')
    }
  }
})
