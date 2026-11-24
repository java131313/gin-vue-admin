// 课程模块接口（Node/Vue/React 三模块共用）
import request from '@/utils/request'

// 按「模块 + 分类」查询内容（params: {module, category}）
export const getCourseContents = (params) => request.get('/course/contents', { params })

// ================= 内容管理（需要 course:* 权限） =================

// 分页列表（params: {module, category, keyword, page, pageSize}）
export const listCourseContentsAdmin = (params) => request.get('/course/contents-admin', { params })

// 新增内容
export const createCourseContent = (data) => request.post('/course/contents-admin', data)

// 编辑内容
export const updateCourseContent = (id, data) => request.put(`/course/contents-admin/${id}`, data)

// 删除内容
export const deleteCourseContent = (id) => request.delete(`/course/contents-admin/${id}`)
