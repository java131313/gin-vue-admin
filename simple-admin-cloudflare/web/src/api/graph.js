// 知识图谱接口
import request from '@/utils/request'

// 全平台学习图谱（主题 + 知识点 + 文章，节点带掌握度）
export const getKnowledgeGraph = () => request.get('/graph/knowledge')
