// 自定义指令 v-perm：按钮级权限控制
//
// 用法：<el-button v-perm="'user:create'">新增用户</el-button>
//
// 原理：指令挂载时检查当前用户的权限标识列表（userStore.perms），
// 没有对应权限就直接把这个元素从页面上移除。
// 注意：这只是「用户体验层面」的隐藏，真正的安全校验在后端接口（RequirePerm 中间件），
// 防止用户绕过界面直接调接口。
export default {
  // el   —— 指令所在的 DOM 元素
  // binding.value —— 指令的值，即权限标识字符串，如 "user:create"
  mounted(el, binding) {
    const perm = binding.value
    if (!perm) return

    // 从 localStorage 里直接读权限列表（不走 store，避免引入模块循环依赖）
    // perms 是在登录/刷新时由 /api/auth/info 写入 localStorage 的
    const perms = JSON.parse(localStorage.getItem('simple_admin_perms') || '[]')
    if (!perms.includes(perm)) {
      el.parentNode?.removeChild(el) // 没有权限：移除元素
    }
  }
}
