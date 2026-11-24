// 词库管理接口
import request from '@/utils/request'

// 单词分页列表（params: {page, pageSize, keyword, tag}）
export const listWords = (params) => request.get('/words', { params })

// 新增单词
export const createWord = (data) => request.post('/words', data)

// 编辑单词
export const updateWord = (id, data) => request.put(`/words/${id}`, data)

// 删除单词
export const deleteWord = (id) => request.delete(`/words/${id}`)
