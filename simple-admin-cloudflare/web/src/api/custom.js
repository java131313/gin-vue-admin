// 自定义学习（通用模板）接口
import request from '@/utils/request'

// 科目列表（带条目数）
export const getCustomModules = () => request.get('/custom/modules')

// ================= 卡片学习（复习什么） =================

// 抽一批条目（params: {moduleId, mode, size}）
export const getCustomBatch = (params) => request.get('/custom/study/batch', { params })

// 记录一次复习（data: {itemId, correct}）
export const reviewCustomItem = (data) => request.post('/custom/study/review', data)

// 学习统计（params: {moduleId}）
export const getCustomStats = (params) => request.get('/custom/study/stats', { params })

// ================= 模板管理（需要 template:* 权限） =================

// 科目 CRUD
export const listModulesAdmin = () => request.get('/custom/modules-admin')
export const createModule = (data) => request.post('/custom/modules-admin', data)
export const updateModule = (id, data) => request.put(`/custom/modules-admin/${id}`, data)
export const deleteModule = (id) => request.delete(`/custom/modules-admin/${id}`)

// 条目 CRUD（params: {moduleId}）
export const listItemsAdmin = (params) => request.get('/custom/items-admin', { params })
export const createItem = (data) => request.post('/custom/items-admin', data)
export const updateItem = (id, data) => request.put(`/custom/items-admin/${id}`, data)
export const deleteItem = (id) => request.delete(`/custom/items-admin/${id}`)
