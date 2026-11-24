// 知识图谱 —— 对应 Go 版 api/graph.go
import { Hono } from 'hono'
import { AppCtx, Env, ok } from '../core'

export const graphRoutes = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// GET /graph/knowledge —— 全平台学习图谱（主题 + 知识点 + 文章，节点带掌握度）
graphRoutes.get('/graph/knowledge', async (c: AppCtx) => {
  const userID = c.get('userID')
  const nodes: any[] = []
  const links: any[] = []

  // 中心节点
  nodes.push({ id: 'center', name: '学习地图', category: 0, symbolSize: 60 })

  // 当前用户已掌握的知识点 ID 集合
  const mastered = new Set<number>()
  const ps = (await c.env.DB.prepare('SELECT item_id FROM custom_progress WHERE user_id = ? AND mastered = 1').bind(userID).all<any>()).results || []
  ps.forEach((p: any) => mastered.add(p.item_id))

  // 自定义学习主题：科目 → 标签 → 知识点
  const modules = (await c.env.DB.prepare('SELECT * FROM custom_modules ORDER BY sort, id').all<any>()).results || []
  for (const m of modules) {
    const mid = `m${m.id}`
    nodes.push({ id: mid, name: `${m.icon} ${m.name}`, category: 1, symbolSize: 42, value: m.description })
    links.push({ source: 'center', target: mid })

    const items = (await c.env.DB.prepare('SELECT * FROM custom_items WHERE module_id = ? ORDER BY sort, id').bind(m.id).all<any>()).results || []
    const tagNodes: Record<string, string> = {}
    for (const it of items) {
      const tag = it.tag || '未分组'
      if (!tagNodes[tag]) {
        const tid = `t${m.id}-${tag}`
        tagNodes[tag] = tid
        nodes.push({ id: tid, name: tag, category: 2, symbolSize: 26 })
        links.push({ source: mid, target: tid })
      }
      nodes.push({
        id: `i${it.id}`,
        name: it.title,
        category: mastered.has(it.id) ? 3 : 4, // 3=已掌握 4=学习中
        symbolSize: 16,
        value: it.content,
      })
      links.push({ source: tagNodes[tag], target: `i${it.id}` })
    }
  }

  // 阅读文章：阅读 → 语言 → 文章
  nodes.push({ id: 'read', name: '📖 阅读文章', category: 1, symbolSize: 42, value: '经典美语与日语阅读，阅读中选词可收藏进词库' })
  links.push({ source: 'center', target: 'read' })

  const langNames: Record<string, string> = { en: '英语文章', ja: '日语文章' }
  const langNode: Record<string, string> = {}
  const articles = (await c.env.DB.prepare('SELECT id, language, title, summary FROM articles ORDER BY id').all<any>()).results || []
  for (const a of articles) {
    if (!langNode[a.language]) {
      const lid = `lang-${a.language}`
      langNode[a.language] = lid
      nodes.push({ id: lid, name: langNames[a.language], category: a.language === 'ja' ? 6 : 5, symbolSize: 26 })
      links.push({ source: 'read', target: lid })
    }
    nodes.push({
      id: `a${a.id}`,
      name: a.title,
      category: a.language === 'ja' ? 6 : 5,
      symbolSize: 12,
      value: a.summary,
    })
    links.push({ source: langNode[a.language], target: `a${a.id}` })
  }

  return ok(c, { nodes, links })
})
