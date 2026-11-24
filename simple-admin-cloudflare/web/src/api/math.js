// 数学公式：学习接口（登录即可）
import request from '@/utils/request'

// 公式学习列表（params: {category: 'algebra'|'geometry'|'all'}，返回含讲解和应用的完整数据）
export const getMathFormulas = (params) => request.get('/math/formulas', { params })
