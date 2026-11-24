// AI 问答接口（Cloudflare Workers AI 驱动；问题+答案存档，可归类到「学XX」主题）
import request from '@/utils/request'

// 可选模型列表
export const getAiqaModels = () => request.get('/aiqa/models')

// 提问（data: {question, model?, moduleId?}）→ {answer, remaining}
export const askAiqa = (data) => request.post('/aiqa/chat', data)

// 我的问答历史（params: {page, pageSize, moduleId}；moduleId=-1 未归类，0 全部）
export const getAiqaChats = (params) => request.get('/aiqa/chats', { params })

// 归类/取消归类到「学XX」主题（data: {moduleId: 数字|null}）
export const classifyAiqaChat = (id, data) => request.put(`/aiqa/chats/${id}`, data)

// 删除一条历史
export const deleteAiqaChat = (id) => request.delete(`/aiqa/chats/${id}`)
