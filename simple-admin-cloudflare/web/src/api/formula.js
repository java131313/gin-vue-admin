// 数学公式：管理接口（需要 formula:* 权限）
import request from '@/utils/request'

// 公式分页列表（params: {category, keyword, page, pageSize}）
export const listFormulas = (params) => request.get('/formulas', { params })

// 新增公式
export const createFormula = (data) => request.post('/formulas', data)

// 编辑公式
export const updateFormula = (id, data) => request.put(`/formulas/${id}`, data)

// 删除公式
export const deleteFormula = (id) => request.delete(`/formulas/${id}`)
