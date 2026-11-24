// 角色管理接口
import request from '@/utils/request'

// 角色列表（不分页，附带每个角色已拥有的菜单，供编辑回显）
export const listRoles = () => request.get('/roles')

// 新增角色（data: {name, code, description, menu_ids}）
export const createRole = (data) => request.post('/roles', data)

// 编辑角色
export const updateRole = (id, data) => request.put(`/roles/${id}`, data)

// 删除角色
export const deleteRole = (id) => request.delete(`/roles/${id}`)
