// Duck.ai 匿名 AI 问答接口（问题+答案存档，可归类到「学XX」主题）
import request from '@/utils/request'

// 可选模型列表
export const getDuckaiModels = () => request.get('/duckai/models')

// 提问（data: {question, model?, moduleId?}）→ {answer, remaining}
export const askDuckai = (data) => request.post('/duckai/chat', data)

// 我的问答历史（params: {page, pageSize, moduleId}；moduleId=-1 未归类，0 全部）
export const getDuckaiChats = (params) => request.get('/duckai/chats', { params })

// 归类/取消归类到「学XX」主题（data: {moduleId: 数字|null}）
export const classifyDuckaiChat = (id, data) => request.put(`/duckai/chats/${id}`, data)

// 删除一条历史
export const deleteDuckaiChat = (id) => request.delete(`/duckai/chats/${id}`)
