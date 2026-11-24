// 阅读与文章接口
import request from '@/utils/request'

// ================= 阅读练习（登录即可） =================

// 阅读文章列表（摘要信息，params: {language, page, size}）
export const getReadingList = (params) => request.get('/reading/articles', { params })

// 阅读一篇完整文章（原文 + 中文对照）
export const getArticle = (id) => request.get(`/reading/articles/${id}`)

// 收藏阅读中选中的生词到词库
export const collectWord = (data) => request.post('/reading/collect-word', data)

// ================= 文章管理（需要 art:* 权限） =================

// 文章分页列表（params: {keyword, language, page, pageSize}）
export const listArticles = (params) => request.get('/articles', { params })

// 新增文章
export const createArticle = (data) => request.post('/articles', data)

// 编辑文章
export const updateArticle = (id, data) => request.put(`/articles/${id}`, data)

// 删除文章
export const deleteArticle = (id) => request.delete(`/articles/${id}`)
