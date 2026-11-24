// 背单词接口（登录即可）
import request from '@/utils/request'

// 取一批要复习的单词（params: {mode: 'unmastered'|'all', size, tag}）
export const getStudyBatch = (params) => request.get('/study/batch', { params })

// 提交一次复习结果（data: {wordId, correct}）
export const reviewWord = (data) => request.post('/study/review', data)

// 学习统计：总词数 / 已掌握 / 今日复习数
export const getStudyStats = () => request.get('/study/stats')
