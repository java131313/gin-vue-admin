// 学语言：词库管理 + 背单词 —— 对应 Go 版 api/word.go、api/study.go
import { Hono } from 'hono'
import { AppCtx, Env, ok, fail, pager, summary, shuffle } from '../core'

export const learnRoutes = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// ---------- 词库管理（需要 word:* 权限） ----------

learnRoutes.get('/words', async (c: AppCtx) => {
  const { pageSize, offset } = pager(c)
  let where = '1=1'; const binds: any[] = []
  const lang = c.req.query('language') || ''
  const kw = c.req.query('keyword') || ''
  if (lang) { where += ' AND language = ?'; binds.push(lang) }
  if (kw) { where += ' AND (word LIKE ? OR meaning LIKE ? OR example LIKE ?)'; binds.push(`%${kw}%`, `%${kw}%`, `%${kw}%`) }

  const total = (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM words WHERE ${where}`).bind(...binds).first<any>())!.n as number
  const list = (await c.env.DB.prepare(`SELECT * FROM words WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`).bind(...binds, pageSize, offset).all<any>()).results || []
  return ok(c, { list, total })
})

learnRoutes.post('/words', async (c: AppCtx) => {
  const b = await c.req.json().catch(() => ({} as any))
  if (!b.word || !b.meaning) return fail(c, 1, '单词和释义不能为空')
  const exists = await c.env.DB.prepare('SELECT id FROM words WHERE word = ?').bind(b.word).first()
  if (exists) return fail(c, 1, '该单词已存在')
  const r = await c.env.DB.prepare(
    'INSERT INTO words (language, word, phonetic, meaning, example, example_cn, tag) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(b.language || 'en', b.word, b.phonetic || '', b.meaning, b.example || '', b.exampleCN || '', b.tag || '').run()
  return ok(c, { id: r.meta.last_row_id })
})

learnRoutes.put('/words/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const b = await c.req.json().catch(() => ({} as any))
  const w = await c.env.DB.prepare('SELECT id FROM words WHERE id = ?').bind(id).first()
  if (!w) return fail(c, 1, '单词不存在')
  const conflict = await c.env.DB.prepare('SELECT id FROM words WHERE word = ? AND id != ?').bind(b.word, id).first()
  if (conflict) return fail(c, 1, '该单词已存在')
  await c.env.DB.prepare(
    'UPDATE words SET word = ?, phonetic = ?, meaning = ?, example = ?, example_cn = ?, tag = ?, language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(b.word, b.phonetic || '', b.meaning, b.example || '', b.exampleCN || '', b.tag || '', b.language || 'en', id).run()
  return ok(c, null)
})

learnRoutes.delete('/words/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM words WHERE id = ?').bind(id).run()
  return ok(c, null)
})

// ---------- 背单词（登录即可） ----------

// GET /study/batch —— 抽一批单词
learnRoutes.get('/study/batch', async (c: AppCtx) => {
  const userID = c.get('userID')
  const size = Math.min(100, Math.max(1, parseInt(c.req.query('size') || '20', 10) || 20))
  const mode = c.req.query('mode') || 'unmastered'
  const lang = c.req.query('language') || ''
  const tag = c.req.query('tag') || ''

  let where = '1=1'; const binds: any[] = []
  if (lang && lang !== 'all') { where += ' AND w.language = ?'; binds.push(lang) }
  if (tag) { where += ' AND w.tag = ?'; binds.push(tag) }
  if (mode !== 'all') { where += ' AND (p.mastered IS NULL OR p.mastered = 0)' }

  const sql = `SELECT w.* FROM words w
    LEFT JOIN word_progress p ON p.word_id = w.id AND p.user_id = ?
    WHERE ${where} ORDER BY RANDOM() LIMIT ?`
  const list = (await c.env.DB.prepare(sql).bind(userID, ...binds, size).all<any>()).results || []
  return ok(c, list)
})

// POST /study/review —— 记录一次复习（连续答对 3 次掌握）
learnRoutes.post('/study/review', async (c: AppCtx) => {
  const userID = c.get('userID')
  const { wordId, correct } = await c.req.json().catch(() => ({} as any))
  if (!wordId) return fail(c, 1, '参数错误')
  const word = await c.env.DB.prepare('SELECT id FROM words WHERE id = ?').bind(wordId).first()
  if (!word) return fail(c, 1, '单词不存在')

  let p = await c.env.DB.prepare('SELECT * FROM word_progress WHERE user_id = ? AND word_id = ?').bind(userID, wordId).first<any>()
  if (!p) p = { user_id: userID, word_id: wordId, correct_cnt: 0, wrong_cnt: 0, mastered: 0 }

  if (correct) {
    p.correct_cnt++
    if (p.correct_cnt >= 3) p.mastered = 1
  } else {
    p.wrong_cnt++
    p.correct_cnt = 0
    p.mastered = 0
  }
  await c.env.DB.prepare(
    `INSERT INTO word_progress (user_id, word_id, mastered, correct_cnt, wrong_cnt, last_review_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, word_id) DO UPDATE SET mastered=excluded.mastered, correct_cnt=excluded.correct_cnt, wrong_cnt=excluded.wrong_cnt, last_review_at=CURRENT_TIMESTAMP`
  ).bind(userID, wordId, p.mastered, p.correct_cnt, p.wrong_cnt).run()

  return ok(c, { itemId: wordId, mastered: !!p.mastered, correctCnt: p.correct_cnt, wrongCnt: p.wrong_cnt })
})

// GET /study/stats —— 学习统计（总量/已掌握/今日复习/按语言）
learnRoutes.get('/study/stats', async (c: AppCtx) => {
  const userID = c.get('userID')
  const total = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM words').first<any>())!.n as number
  const mastered = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM word_progress WHERE user_id = ? AND mastered = 1').bind(userID).first<any>())!.n as number
  const today = new Date().toISOString().slice(0, 10)
  const reviewedToday = (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM word_progress WHERE user_id = ? AND date(last_review_at) = ?`).bind(userID, today).first<any>())!.n as number
  const langs = (await c.env.DB.prepare(
    `SELECT w.language, COUNT(*) AS total, SUM(CASE WHEN p.mastered = 1 THEN 1 ELSE 0 END) AS mastered
     FROM words w LEFT JOIN word_progress p ON p.word_id = w.id AND p.user_id = ?
     GROUP BY w.language`
  ).bind(userID).all<any>()).results || []
  return ok(c, { total, mastered, reviewedToday, languages: langs })
})
