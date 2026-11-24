// 考试中心接口（登录即可）
import request from '@/utils/request'

// 生成试卷（data: {choiceCount, blankCount, qaCount}，题目来自词库和公式库）
export const generateExam = (data) => request.post('/exam/generate', data)

// 提交答卷（data: {answers: [{questionId, userAnswer}]}）
export const submitExam = (id, data) => request.post(`/exam/${id}/submit`, data)

// 完成评分（data: {qaResults: [{questionId, correct}]}，问答题自评）
export const finishExam = (id, data) => request.post(`/exam/${id}/finish`, data)

// 考试记录列表
export const listExams = () => request.get('/exam/records')

// 试卷详情（含答案和解析）
export const getExamResult = (id) => request.get(`/exam/${id}`)

// ================= 错题本 =================

// 我的错题列表
export const listWrongBook = () => request.get('/wrongbook')

// 标记错题已掌握
export const masterWrong = (id) => request.post(`/wrongbook/${id}/mastered`)
