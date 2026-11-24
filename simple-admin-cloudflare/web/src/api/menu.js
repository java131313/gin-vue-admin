// 菜单（权限）管理接口
import request from '@/utils/request'

// 菜单树列表
export const listMenus = () => request.get('/menus')

// 新增菜单（data: {parentId, title, name, path, component, icon, type, perm, sort}）
export const createMenu = (data) => request.post('/menus', data)

// 编辑菜单
export const updateMenu = (id, data) => request.put(`/menus/${id}`, data)

// 删除菜单
export const deleteMenu = (id) => request.delete(`/menus/${id}`)
