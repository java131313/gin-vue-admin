// 用户管理接口
import request from '@/utils/request'

// 用户分页列表
export const listUsers = (params) => request.get('/users', { params })

// 新增用户（data: {username, password, nickname, status, role_ids}）
export const createUser = (data) => request.post('/users', data)

// 编辑用户（data: {nickname, password, status, role_ids}，password 留空表示不改密码）
export const updateUser = (id, data) => request.put(`/users/${id}`, data)

// 删除用户
export const deleteUser = (id) => request.delete(`/users/${id}`)
