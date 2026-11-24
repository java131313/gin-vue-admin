// 自定义学习（通用模板） —— 对应 Go 版 api/custom.go、service/custom.go
import { Hono } from 'hono'
import { AppCtx, Env, ok, fail, summary, shuffle } from '../core'

export const customRoutes = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// GET /custom/modules —— 科目列表（带条目数，登录即可）
customRoutes.get('/custom/modules', async (c: AppCtx) => {
  const modules = (await c.env.DB.prepare('SELECT * FROM custom_modules ORDER BY sort, id').all<any>()).results || []
  for (const m of modules) {
    m.itemCount = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM custom_items WHERE module_id = ?').bind(m.id).first<any>())!.n
  }
  return ok(c, modules)
})

// GET /custom/study/batch —— 抽一批条目复习（mode=unmastered/all）
customRoutes.get('/custom/study/batch', async (c: AppCtx) => {
  const userID = c.get('userID')
  const moduleId = parseInt(c.req.query('moduleId') || '0', 10)
  if (!moduleId) return fail(c, 1, '请选择科目')
  const size = Math.min(100, Math.max(1, parseInt(c.req.query('size') || '20', 10) || 20))
  const mode = c.req.query('mode') || 'unmastered'

  let where = 'i.module_id = ?'; const binds: any[] = [moduleId]
  if (mode !== 'all') where += ' AND (p.mastered IS NULL OR p.mastered = 0)'

  const list = (await c.env.DB.prepare(
    `SELECT i.* FROM custom_items i
     LEFT JOIN custom_progress p ON p.item_id = i.id AND p.user_id = ?
     WHERE ${where} ORDER BY RANDOM() LIMIT ?`
  ).bind(userID, ...binds, size).all<any>()).results || []
  return ok(c, list)
})

// POST /custom/study/review —— 记录一次复习（连续答对 3 次掌握）
customRoutes.post('/custom/study/review', async (c: AppCtx) => {
  const userID = c.get('userID')
  const { itemId, correct } = await c.req.json().catch(() => ({} as any))
  if (!itemId) return fail(c, 1, '参数错误')

  let p = await c.env.DB.prepare('SELECT * FROM custom_progress WHERE user_id = ? AND item_id = ?').bind(userID, itemId).first<any>()
  if (!p) p = { correct_cnt: 0, wrong_cnt: 0, mastered: 0 }

  if (correct) {
    p.correct_cnt++
    if (p.correct_cnt >= 3) p.mastered = 1
  } else {
    p.wrong_cnt++
    p.correct_cnt = 0
    p.mastered = 0
  }

  await c.env.DB.prepare(
    `INSERT INTO custom_progress (user_id, item_id, mastered, correct_cnt, wrong_cnt, last_review_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, item_id) DO UPDATE SET mastered=excluded.mastered, correct_cnt=excluded.correct_cnt, wrong_cnt=excluded.wrong_cnt, last_review_at=CURRENT_TIMESTAMP`
  ).bind(userID, itemId, p.mastered, p.correct_cnt, p.wrong_cnt).run()

  return ok(c, { itemId, mastered: !!p.mastered, correctCnt: p.correct_cnt, wrongCnt: p.wrong_cnt })
})

// GET /custom/study/stats —— 某科目的学习统计
customRoutes.get('/custom/study/stats', async (c: AppCtx) => {
  const userID = c.get('userID')
  const moduleId = parseInt(c.req.query('moduleId') || '0', 10)
  if (!moduleId) return fail(c, 1, '请选择科目')

  const total = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM custom_items WHERE module_id = ?').bind(moduleId).first<any>())!.n
  const mastered = (await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM custom_progress p JOIN custom_items i ON i.id = p.item_id WHERE p.user_id = ? AND p.mastered = 1 AND i.module_id = ?`
  ).bind(userID, moduleId).first<any>())!.n
  const today = new Date().toISOString().slice(0, 10)
  const reviewedToday = (await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM custom_progress p JOIN custom_items i ON i.id = p.item_id WHERE p.user_id = ? AND i.module_id = ? AND date(p.last_review_at) = ?`
  ).bind(userID, moduleId, today).first<any>())!.n
  return ok(c, { total, mastered, reviewedToday })
})

// ---------- 模板管理 CRUD（权限在 index.ts 挂载时指定 template:*） ----------

customRoutes.get('/custom/modules-admin', async (c: AppCtx) =>
  ok(c, (await c.env.DB.prepare('SELECT * FROM custom_modules ORDER BY sort, id').all<any>()).results || []))

customRoutes.post('/custom/modules-admin', async (c: AppCtx) => {
  const b = await c.req.json().catch(() => ({} as any))
  if (!b.name) return fail(c, 1, '科目名称不能为空')
  const r = await c.env.DB.prepare('INSERT INTO custom_modules (name, icon, description, sort) VALUES (?, ?, ?, ?)')
    .bind(b.name, b.icon || '📚', b.description || '', b.sort ?? 0).run()
  return ok(c, { id: r.meta.last_row_id })
})

customRoutes.put('/custom/modules-admin/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const b = await c.req.json().catch(() => ({} as any))
  await c.env.DB.prepare('UPDATE custom_modules SET name = ?, icon = ?, description = ?, sort = ? WHERE id = ?')
    .bind(b.name, b.icon || '', b.description || '', b.sort ?? 0, id).run()
  return ok(c, null)
})

customRoutes.delete('/custom/modules-admin/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM custom_items WHERE module_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM custom_modules WHERE id = ?').bind(id).run()
  return ok(c, null)
})

customRoutes.get('/custom/items-admin', async (c: AppCtx) => {
  const moduleId = parseInt(c.req.query('moduleId') || '0', 10)
  if (!moduleId) return fail(c, 1, '请选择科目')
  return ok(c, (await c.env.DB.prepare('SELECT * FROM custom_items WHERE module_id = ? ORDER BY sort, id').bind(moduleId).all<any>()).results || [])
})

customRoutes.post('/custom/items-admin', async (c: AppCtx) => {
  const b = await c.req.json().catch(() => ({} as any))
  if (!b.title || !b.content) return fail(c, 1, '标题和内容不能为空')
  const r = await c.env.DB.prepare('INSERT INTO custom_items (module_id, title, content, tag, sort) VALUES (?, ?, ?, ?, ?)')
    .bind(b.moduleId, b.title, b.content, b.tag || '', b.sort ?? 0).run()
  return ok(c, { id: r.meta.last_row_id })
})

customRoutes.put('/custom/items-admin/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const b = await c.req.json().catch(() => ({} as any))
  await c.env.DB.prepare('UPDATE custom_items SET title = ?, content = ?, tag = ?, sort = ? WHERE id = ?')
    .bind(b.title, b.content, b.tag || '', b.sort ?? 0, id).run()
  return ok(c, null)
})

customRoutes.delete('/custom/items-admin/:id', async (c: AppCtx) => {
  await c.env.DB.prepare('DELETE FROM custom_items WHERE id = ?').bind(Number(c.req.param('id'))).run()
})
