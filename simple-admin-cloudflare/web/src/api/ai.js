// 学AI编程接口
import request from '@/utils/request'

// 按分类查询学习内容（params: {category: 'history'|'news'|'knowledge'|'model'}）
export const getAIContents = (params) => request.get('/ai/contents', { params })

// 与 Kimi 对话（data: {messages: [{role, content}]}）
export const chatAI = (data) => request.post('/ai/chat', data)

// ================= 内容管理（需要 ai:* 权限） =================

// 分页列表（params: {category, keyword, page, pageSize}）
export const listAIContentsAdmin = (params) => request.get('/ai/contents-admin', { params })

// 新增内容
export const createAIContent = (data) => request.post('/ai/contents-admin', data)

// 编辑内容
export const updateAIContent = (id, data) => request.put(`/ai/contents-admin/${id}`, data)

// 删除内容
export const deleteAIContent = (id) => request.delete(`/ai/contents-admin/${id}`)
