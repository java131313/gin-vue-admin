// 内容类模块：阅读文章 / 数学公式 / AI 学习 / Go 学习 / 课程（Node·Vue·React·Java·Python）
// 对应 Go 版 api/article.go、api/reading.go、api/formula.go、api/ai.go、api/go.go、api/course.go
import { Hono } from 'hono'
import { AppCtx, Env, ok, fail, pager } from '../core'

export const contentRoutes = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// 通用分页查询构造器：where 条件 + 查询参数
function buildWhere(c: AppCtx, filters: Record<string, string>): { where: string; binds: any[] } {
  let where = '1=1'; const binds: any[] = []
  for (const [field, queryName] of Object.entries(filters)) {
    const v = c.req.query(queryName) || ''
    if (v) { where += ` AND ${field} = ?`; binds.push(v) }
  }
  const kw = c.req.query('keyword') || ''
  if (kw) { where += ' AND (title LIKE ? OR summary LIKE ?)'; binds.push(`%${kw}%`, `%${kw}%`) }
  return { where, binds }
}

async function adminList(c: AppCtx, table: string) {
  const { pageSize, offset } = pager(c)
  const { where, binds } = buildWhere(c, table === 'course_contents' ? { module: 'module' } : { category: 'category' })
  const total = (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).bind(...binds).first<any>())!.n as number
  const list = (await c.env.DB.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`).bind(...binds, pageSize, offset).all<any>()).results || []
  return ok(c, { list, total })
}

async function createRow(c: AppCtx, table: string, fields: string[]) {
  const b = await c.req.json().catch(() => ({} as any))
  const cols = fields.filter((f) => b[f] !== undefined)
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  const r = await c.env.DB.prepare(sql).bind(...cols.map((f) => b[f])).run()
  return ok(c, { id: r.meta.last_row_id })
}

async function updateRow(c: AppCtx, table: string, fields: string[]) {
  const id = Number(c.req.param('id'))
  const b = await c.req.json().catch(() => ({} as any))
  const cols = fields.filter((f) => b[f] !== undefined)
  await c.env.DB.prepare(`UPDATE ${table} SET ${cols.map((f) => `${f} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(...cols.map((f) => b[f]), id).run()
  return ok(c, null)
}

async function deleteRow(c: AppCtx, table: string) {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run()
  return ok(c, null)
}

// ---------- 阅读（登录即可） ----------

// GET /reading/articles —— 文章摘要列表
contentRoutes.get('/reading/articles', async (c: AppCtx) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1)
  const size = Math.min(50, Math.max(1, parseInt(c.req.query('size') || '12', 10) || 12))
  let where = '1=1'; const binds: any[] = []
  const lang = c.req.query('language') || ''
  if (lang && lang !== 'all') { where += ' AND language = ?'; binds.push(lang) }

  const total = (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM articles WHERE ${where}`).bind(...binds).first<any>())!.n as number
  const list = (await c.env.DB.prepare(`SELECT id, language, title, summary, tag, updated_at AS updatedAt FROM articles WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`)
    .bind(...binds, size, (page - 1) * size).all<any>()).results || []
  return ok(c, { list, total })
})

// GET /reading/articles/:id —— 阅读完整文章
contentRoutes.get('/reading/articles/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const a = await c.env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first()
  if (!a) return fail(c, 1, '文章不存在')
  return ok(c, a)
})

// POST /reading/collect-word —— 收藏阅读中选中的生词到词库
contentRoutes.post('/reading/collect-word', async (c: AppCtx) => {
  const b = await c.req.json().catch(() => ({} as any))
  if (!b.word || !b.meaning) return fail(c, 1, '单词和释义不能为空')
  const exists = await c.env.DB.prepare('SELECT id FROM words WHERE word = ?').bind(b.word).first()
  if (exists) return ok(c, { exists: true, word: exists })
  const r = await c.env.DB.prepare(
    'INSERT INTO words (language, word, phonetic, meaning, example, example_cn, tag) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(b.language || 'en', b.word, b.phonetic || '', b.meaning, b.example || '', b.exampleCN || '', b.tag || '').run()
  return ok(c, { exists: false, word: { id: r.meta.last_row_id } })
})

// ---------- AI 助手（Kimi 代理，登录即可） ----------

contentRoutes.post('/ai/chat', async (c: AppCtx) => {
  const { messages } = await c.req.json().catch(() => ({ messages: [] as any[] }))
  if (!c.env.KIMI_API_KEY) return fail(c, 1, '未配置 KIMI_API_KEY，请到 https://platform.moonshot.cn 申请后在 Worker 环境变量中设置')

  const resp = await fetch(`${'https://api.moonshot.cn/v1'}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.env.KIMI_API_KEY}` },
    body: JSON.stringify({
      model: c.env.KIMI_MODEL || 'moonshot-v1-8k',
      temperature: 0.3,
      messages: [
        { role: 'system', content: '你是一位耐心的中文编程学习助手，面向初学者。回答要求：用简体中文；条理清晰、通俗易懂；涉及代码时给出带注释的可运行示例；不确定的内容要如实说明。' },
        ...messages,
      ],
    }),
  })
  const data: any = await resp.json()
  if (data.error?.message) return fail(c, 1, 'Kimi 接口报错：' + data.error.message)
  if (!data.choices?.length) return fail(c, 1, 'Kimi 没有返回内容')
  return ok(c, { reply: data.choices[0].message.content })
})

// ---------- Go 在线运行（代理 go.dev，登录即可） ----------

contentRoutes.post('/go/run', async (c: AppCtx) => {
  const { code } = await c.req.json().catch(() => ({ code: '' }))
  if (!code || !code.trim()) return fail(c, 1, '代码不能为空')
  try {
    const resp = await fetch('https://go.dev/_/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ body: code, version: '2' }),
    })
    const data: any = await resp.json()
    let out = ''
    if (data.Errors) out += '【编译错误】\n' + data.Errors + '\n'
    for (const e of data.Events || []) out += e.Message
    return ok(c, { output: out || '（程序运行成功，但没有输出）' })
  } catch (e: any) {
    return fail(c, 1, `连接 Go 在线运行服务失败：${e.message}`)
  }
})

// ---------- 各类内容：学习端（登录即可） ----------

contentRoutes.get('/ai/contents', async (c: AppCtx) => {
  const category = c.req.query('category') || 'history'
  const order = category === 'history' ? 'sort, id' : category === 'news' ? 'event_date DESC, id DESC' : 'id'
  const list = (await c.env.DB.prepare(`SELECT * FROM ai_contents WHERE category = ? ORDER BY ${order}`).bind(category).all<any>()).results || []
  return ok(c, list)
})

contentRoutes.get('/math/formulas', async (c: AppCtx) => {
  const cat = c.req.query('category') || ''
  const sql = cat && cat !== 'all' ? 'SELECT * FROM formulas WHERE category = ? ORDER BY id' : 'SELECT * FROM formulas ORDER BY id'
  const list = (await c.env.DB.prepare(sql).bind(...(cat && cat !== 'all' ? [cat] : [])).all<any>()).results || []
  return ok(c, list)
})

contentRoutes.get('/go/contents', async (c: AppCtx) => {
  const cat = c.req.query('category') || 'basics'
  const list = (await c.env.DB.prepare('SELECT * FROM go_contents WHERE category = ? ORDER BY sort, id').bind(cat).all<any>()).results || []
  return ok(c, list)
})

contentRoutes.get('/course/contents', async (c: AppCtx) => {
  const module = c.req.query('module') || 'node'
  const cat = c.req.query('category') || 'basics'
  const list = (await c.env.DB.prepare('SELECT * FROM course_contents WHERE module = ? AND category = ? ORDER BY sort, id').bind(module, cat).all<any>()).results || []
  return ok(c, list)
})

// ---------- 各类内容：管理端 CRUD（权限校验在 index.ts 挂载时指定） ----------

// 文章管理
contentRoutes.get('/articles', (c) => adminList(c, 'articles'))
contentRoutes.post('/articles', (c) => createRow(c, 'articles', ['language', 'title', 'summary', 'content', 'content_cn', 'tag']))
contentRoutes.put('/articles/:id', (c) => updateRow(c, 'articles', ['language', 'title', 'summary', 'content', 'content_cn', 'tag']))
contentRoutes.delete('/articles/:id', (c) => deleteRow(c, 'articles'))

// 公式管理
contentRoutes.get('/formulas', (c) => adminList(c, 'formulas'))
contentRoutes.post('/formulas', (c) => createRow(c, 'formulas', ['category', 'name', 'formula', 'content', 'application', 'tag']))
contentRoutes.put('/formulas/:id', (c) => updateRow(c, 'formulas', ['category', 'name', 'formula', 'content', 'application', 'tag']))
contentRoutes.delete('/formulas/:id', (c) => deleteRow(c, 'formulas'))

// AI 内容管理
contentRoutes.get('/ai/contents-admin', (c) => adminList(c, 'ai_contents'))
contentRoutes.post('/ai/contents-admin', (c) => createRow(c, 'ai_contents', ['category', 'title', 'summary', 'content', 'event_date', 'tag', 'sort']))
contentRoutes.put('/ai/contents-admin/:id', (c) => updateRow(c, 'ai_contents', ['category', 'title', 'summary', 'content', 'event_date', 'tag', 'sort']))
contentRoutes.delete('/ai/contents-admin/:id', (c) => deleteRow(c, 'ai_contents'))

// Go 内容管理
contentRoutes.get('/go/contents-admin', (c) => adminList(c, 'go_contents'))
contentRoutes.post('/go/contents-admin', (c) => createRow(c, 'go_contents', ['category', 'title', 'summary', 'content', 'code', 'tag', 'difficulty', 'sort']))
contentRoutes.put('/go/contents-admin/:id', (c) => updateRow(c, 'go_contents', ['category', 'title', 'summary', 'content', 'code', 'tag', 'difficulty', 'sort']))
contentRoutes.delete('/go/contents-admin/:id', (c) => deleteRow(c, 'go_contents'))

// 课程内容管理
contentRoutes.get('/course/contents-admin', (c) => adminList(c, 'course_contents'))
contentRoutes.post('/course/contents-admin', (c) => createRow(c, 'course_contents', ['module', 'category', 'title', 'summary', 'content', 'code', 'tag', 'difficulty', 'sort']))
contentRoutes.put('/course/contents-admin/:id', (c) => updateRow(c, 'course_contents', ['module', 'category', 'title', 'summary', 'content', 'code', 'tag', 'difficulty', 'sort']))
contentRoutes.delete('/course/contents-admin/:id', (c) => deleteRow(c, 'course_contents'))
