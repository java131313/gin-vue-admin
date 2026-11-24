// 学Golang接口
import request from '@/utils/request'

// 按分类查询学习内容（params: {category: 'basics'|'framework'|'code'}）
export const getGoContents = (params) => request.get('/go/contents', { params })

// 在线运行 Go 代码（data: {code}，返回 {output}）
export const runGoCode = (code) => request.post('/go/run', { code })

// ================= 内容管理（需要 go:* 权限） =================

// 分页列表（params: {category, keyword, page, pageSize}）
export const listGoContentsAdmin = (params) => request.get('/go/contents-admin', { params })

// 新增内容
export const createGoContent = (data) => request.post('/go/contents-admin', data)

// 编辑内容
export const updateGoContent = (id, data) => request.put(`/go/contents-admin/${id}`, data)

// 删除内容
export const deleteGoContent = (id) => request.delete(`/go/contents-admin/${id}`)
