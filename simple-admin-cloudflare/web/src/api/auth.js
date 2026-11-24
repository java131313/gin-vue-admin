// 认证相关接口
import request from '@/utils/request'

// 登录：拿到 JWT 令牌
export const login = (data) => request.post('/auth/login', data)

// 获取当前登录用户的信息、角色、权限、菜单树（刷新页面/首次进入时调用）
export const getInfo = () => request.get('/auth/info')

// 登出（本项目 JWT 无状态，服务端只是占位，真正生效的是前端删除本地令牌）
export const logout = () => request.post('/auth/logout')
