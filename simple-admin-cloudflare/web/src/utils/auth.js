// 令牌存取工具：令牌放在浏览器的 localStorage 里，刷新页面登录态不丢失
const TOKEN_KEY = 'simple_admin_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}
