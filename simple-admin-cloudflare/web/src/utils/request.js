// axios 封装：整个项目唯一的发请求入口
//
// 做了三件事：
//  1. 统一 baseURL 为 /api（开发环境由 vite 代理到后端，生产环境由 Nginx 代理）
//  2. 请求拦截器：自动在请求头带上 JWT 令牌
//  3. 响应拦截器：按后端统一的 {code, msg, data} 格式拆包，错误统一弹提示
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getToken, clearToken } from './auth'

// 创建 axios 实例
const request = axios.create({
  baseURL: '/api',
  timeout: 10000 // 10 秒超时
})

// ---------- 请求拦截器：发请求前自动执行 ----------
request.interceptors.request.use((config) => {
  const token = getToken()
  // 有令牌就带上（后端 JWTAuth 中间件会校验它），格式：Authorization: Bearer <token>
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ---------- 响应拦截器：收到响应后自动执行 ----------
request.interceptors.response.use(
  (response) => {
    // 后端正常返回 HTTP 200，业务成败看 body 里的 code
    const body = response.data
    if (body.code === 0) {
      return body // 成功：返回整个 body，业务数据在 body.data 里
    }
    // 业务失败（如"用户名已存在"）：统一弹错误提示，并让 await 处走到 catch
    ElMessage.error(body.msg || '请求失败')
    return Promise.reject(new Error(body.msg))
  },
  (error) => {
    // HTTP 层面失败（401/403/500、网络错误等）
    const status = error.response?.status
    if (status === 401) {
      // 未登录或令牌过期：清掉本地令牌，整页跳回登录页
      // （用 location.href 而不用 router，避免模块循环引用）
      clearToken()
      ElMessage.error('登录已过期，请重新登录')
      window.location.href = '/login'
    } else {
      ElMessage.error(error.response?.data?.msg || error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default request
