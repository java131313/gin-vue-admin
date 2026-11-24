// 考试中心 + 错题本 —— 对应 Go 版 api/exam.go、api/wrongbook.go、service/exam.go
import { Hono } from 'hono'
import { AppCtx, Env, ok, fail, summary, shuffle } from '../core'

export const examRoutes = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// 答案标准化（判分用：小写、去首尾空格、压缩连续空格）
const norm = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ')

// ---------- 出题 ----------

// 从自定义科目的条目出题（通用模板的「考什么」）
async function generateFromCustom(db: D1Database, moduleID: number, choiceCount: number, blankCount: number, qaCount: number) {
  const module = await db.prepare('SELECT * FROM custom_modules WHERE id = ?').bind(moduleID).first<any>()
  if (!module) throw new Error('科目不存在')

  const need = choiceCount * 4 + blankCount + qaCount
  const items = (await db.prepare('SELECT * FROM custom_items ORDER BY RANDOM() LIMIT ?').bind(need).all<any>()).results || []
  if (items.length < need) {
    throw new Error(`科目「${module.name}」的条目不足：至少需要 ${need} 条（当前 ${items.length} 条），请先在模板管理中添加`)
  }

  const questions: any[] = []
  let idx = 0

  for (let i = 0; i < blankCount; i++) {
    const it = items[idx++]
    questions.push({ subject: 'custom', q_type: 'blank', content: `根据描述写出「${module.name}」中该知识点的名称：\n${summary(it.content)}`, options: '', answer: it.title, analysis: it.content, source_id: it.id })
  }
  for (let i = 0; i < choiceCount; i++) {
    const answer = items[idx++]
    const distractors = [items[idx++].title, items[idx++].title, items[idx++].title]
    const options = shuffle([answer.title, ...distractors])
    questions.push({ subject: 'custom', q_type: 'choice', content: `选出描述为「${summary(answer.content)}」的${module.name}知识点：`, options: options.join('\n'), answer: answer.title, analysis: answer.content, source_id: answer.id })
  }
  for (let i = 0; i < qaCount; i++) {
    const it = items[idx++]
    questions.push({ subject: 'custom', q_type: 'qa', content: `请结合自己的理解，解释「${module.name}」中的知识点：${it.title}`, options: '', answer: it.content, analysis: `参考要点：${summary(it.content)}`, source_id: it.id })
  }
  return questions
}

// 从词库 + 公式库出题（与 Go 版逻辑一致）
async function generateGeneral(db: D1Database, choiceCount: number, blankCount: number, qaCount: number) {
  const words = ((await db.prepare('SELECT * FROM words').all<any>()).results || [])
  const formulas = ((await db.prepare('SELECT * FROM formulas').all<any>()).results || [])
  const sw = shuffle(words)
  const sf = shuffle(formulas)
  if (sw.length < choiceCount * 4 + blankCount || sw.length < 4) throw new Error('词库中的单词数量不足，请先在「词库管理」中添加更多单词')
  if (sf.length < 4) throw new Error('公式数量不足，请先在「公式管理」中添加更多公式')

  const questions: any[] = []
  let wi = 0

  for (let i = 0; i < blankCount; i++) {
    const w = sw[wi++]
    const langName = w.language === 'ja' ? '日语' : '英语'
    questions.push({ subject: 'language', q_type: 'blank', content: `根据中文释义，写出对应的${langName}单词：\n${w.meaning}`, options: '', answer: w.word, analysis: `${w.word} ${w.phonetic}：${w.meaning}\n例句：${w.example}`, source_id: w.id })
  }
  for (let i = 0; i < choiceCount; i++) {
    const answer = sw[wi++]
    const sameLang = sw.slice(wi).filter((x) => x.language === answer.language && x.word !== answer.word).slice(0, 3).map((x) => x.word)
    const others = sw.filter((x) => x.word !== answer.word && !sameLang.includes(x.word)).slice(0, 3 - sameLang.length).map((x) => x.word)
    const options = shuffle([answer.word, ...sameLang, ...others])
    const langName = answer.language === 'ja' ? '日语' : '英语'
    questions.push({ subject: 'language', q_type: 'choice', content: `选出释义为「${answer.meaning}」的${langName}单词：`, options: options.join('\n'), answer: answer.word, analysis: `${answer.word} ${answer.phonetic}：${answer.meaning}`, source_id: answer.id })
    wi += 3
  }
  for (let i = 0; i < choiceCount; i++) {
    const f = sf[i % sf.length]
    const distract = sf.filter((x) => x.formula !== f.formula).slice(0, 3).map((x) => x.formula)
    const options = shuffle([f.formula, ...distract])
    questions.push({ subject: 'math', q_type: 'choice', content: `「${f.name}」对应的数学公式是：`, options: options.join('\n'), answer: f.formula, analysis: `${f.name}：${f.formula}`, source_id: f.id })
  }
  for (let i = 0; i < qaCount; i++) {
    const f = sf[(choiceCount + i) % sf.length]
    questions.push({ subject: 'math', q_type: 'qa', content: `请结合公式，说明「${f.name}」（${f.formula}）的含义，并举一个应用例子。`, options: '', answer: f.content + '\n应用例题：\n' + f.application, analysis: `参考要点：说明公式的含义与符号意义，并能正确举例应用（标签：${f.tag}）`, source_id: f.id })
  }
  return questions
}

// POST /exam/generate —— 生成试卷
examRoutes.post('/exam/generate', async (c: AppCtx) => {
  const userID = c.get('userID')
  const { choiceCount = 4, blankCount = 3, qaCount = 2, customModuleId = 0 } = await c.req.json().catch(() => ({} as any))
  if (!choiceCount && !blankCount && !qaCount) return fail(c, 1, '至少选择一种题型')

  try {
    const questions = customModuleId > 0
      ? await generateFromCustom(c.env.DB, customModuleId, choiceCount, blankCount, qaCount)
      : await generateGeneral(c.env.DB, choiceCount, blankCount, qaCount)

    // 存入题库
    for (const q of questions) {
      const r = await c.env.DB.prepare(
        'INSERT INTO questions (subject, q_type, content, options, answer, analysis, source_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(q.subject, q.q_type, q.content, q.options, q.answer, q.analysis, q.source_id).run()
      q.id = r.meta.last_row_id
    }

    // 试卷标题：自定义科目用「科目名 + 测验」，否则「综合测验」
    const timeStr = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('/', '-')
    let title = '综合测验 · ' + timeStr
    if (customModuleId > 0) {
      const m = await c.env.DB.prepare('SELECT name FROM custom_modules WHERE id = ?').bind(customModuleId).first<any>()
      if (m) title = m.name + '测验 · ' + timeStr
    }

    const r = await c.env.DB.prepare('INSERT INTO exams (user_id, title, total, score, status) VALUES (?, ?, ?, -1, ?)')
      .bind(userID, title, questions.length, 'doing').run()
    const examId = r.meta.last_row_id as number

    for (const q of questions) {
      await c.env.DB.prepare('INSERT INTO exam_answers (exam_id, question_id) VALUES (?, ?)').bind(examId, q.id).run()
    }

    // 返回试卷（不含答案，与 Go 版一致）
    return ok(c, {
      exam: { id: examId, title, total: questions.length, score: -1, status: 'doing' },
      questions: questions.map(({ answer, analysis, ...q }) => q),
    })
  } catch (e: any) {
    return fail(c, 1, e.message)
  }
})

// POST /exam/:id/submit —— 提交答卷（客观题自动判分，问答返回答案供自评）
examRoutes.post('/exam/:id/submit', async (c: AppCtx) => {
  const userID = c.get('userID')
  const examId = Number(c.req.param('id'))
  const exam = await c.env.DB.prepare('SELECT * FROM exams WHERE id = ?').bind(examId).first<any>()
  if (!exam) return fail(c, 1, '试卷不存在')
  if (exam.user_id !== userID) return fail(c, 403, '不能操作别人的试卷')

  const { answers } = await c.req.json().catch(() => ({ answers: [] as any[] }))
  let objectiveCorrect = 0, objectiveTotal = 0
  const results: any[] = []

  for (const a of answers || []) {
    const row = await c.env.DB.prepare('SELECT ea.id AS aid, q.* FROM exam_answers ea JOIN questions q ON q.id = ea.question_id WHERE ea.exam_id = ? AND ea.question_id = ?')
      .bind(examId, a.questionId).first<any>()
    if (!row) continue

    let correct = false, checked = false
    if (row.q_type === 'choice') { correct = norm(a.userAnswer) === norm(row.answer); checked = true }
    else if (row.q_type === 'blank') { correct = norm(a.userAnswer) !== '' && row.answer.split('|').some((x: string) => norm(x) === norm(a.userAnswer)); checked = true }

    await c.env.DB.prepare('UPDATE exam_answers SET user_answer = ?, correct = ?, checked = ? WHERE id = ?')
      .bind(a.userAnswer || '', correct ? 1 : 0, checked ? 1 : 0, row.aid).run()

    if (row.q_type !== 'qa') { objectiveTotal++; if (correct) objectiveCorrect++ }
    results.push({ questionId: a.questionId, qType: row.q_type, correct, userAnswer: a.userAnswer || '', answer: row.answer, analysis: row.analysis })
  }
  return ok(c, { objectiveCorrect, objectiveTotal, results })
})

// POST /exam/:id/finish —— 完成评分（问答自评 + 总分 + 错题入本）
examRoutes.post('/exam/:id/finish', async (c: AppCtx) => {
  const userID = c.get('userID')
  const examId = Number(c.req.param('id'))
  const exam = await c.env.DB.prepare('SELECT * FROM exams WHERE id = ?').bind(examId).first<any>()
  if (!exam) return fail(c, 1, '试卷不存在')
  if (exam.user_id !== userID) return fail(c, 403, '不能操作别人的试卷')
  if (exam.status === 'done') return fail(c, 1, '试卷已完成，不能重复评分')

  const { qaResults } = await c.req.json().catch(() => ({ qaResults: [] as any[] }))
  for (const r of qaResults || []) {
    await c.env.DB.prepare('UPDATE exam_answers SET correct = ?, checked = 1 WHERE exam_id = ? AND question_id = ?')
      .bind(r.correct ? 1 : 0, examId, r.questionId).run()
  }

  const answers = (await c.env.DB.prepare('SELECT * FROM exam_answers WHERE exam_id = ?').bind(examId).all<any>()).results || []
  const correctCount = answers.filter((a) => a.checked && a.correct).length
  const score = exam.total > 0 ? Math.floor((correctCount * 100) / exam.total) : 0
  await c.env.DB.prepare('UPDATE exams SET score = ?, status = ? WHERE id = ?').bind(score, 'done', examId).run()

  // 错题入本（重复的错题 wrong_count 累加）
  let wrongCollected = 0
  for (const a of answers) {
    if (!a.checked || a.correct) continue
    await c.env.DB.prepare(
      `INSERT INTO wrongbook (user_id, question_id, wrong_count, last_wrong_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, question_id) DO UPDATE SET wrong_count = wrong_count + 1, last_wrong_at = CURRENT_TIMESTAMP`
    ).bind(userID, a.question_id).run()
    wrongCollected++
  }
  return ok(c, { score, correctCount, total: exam.total, wrongCollected })
})

// GET /exam/records —— 我的考试记录
examRoutes.get('/exam/records', async (c: AppCtx) => {
  const list = (await c.env.DB.prepare('SELECT * FROM exams WHERE user_id = ? ORDER BY id DESC').bind(c.get('userID')).all<any>()).results || []
  return ok(c, list)
})

// GET /exam/:id —— 试卷详情（含答案解析）
examRoutes.get('/exam/:id', async (c: AppCtx) => {
  const userID = c.get('userID')
  const examId = Number(c.req.param('id'))
  const exam = await c.env.DB.prepare('SELECT * FROM exams WHERE id = ?').bind(examId).first<any>()
  if (!exam) return fail(c, 1, '试卷不存在')
  if (exam.user_id !== userID) return fail(c, 403, '不能查看别人的试卷')

  const rows = (await c.env.DB.prepare(
    'SELECT ea.question_id AS questionId, ea.user_answer AS userAnswer, ea.correct, ea.checked, q.subject, q.q_type AS qType, q.content, q.options, q.answer, q.analysis FROM exam_answers ea JOIN questions q ON q.id = ea.question_id WHERE ea.exam_id = ?'
  ).bind(examId).all<any>()).results || []
  return ok(c, { exam, items: rows })
})

// ---------- 错题本 ----------

// GET /wrongbook —— 我的错题（连带题目内容）
examRoutes.get('/wrongbook', async (c: AppCtx) => {
  const list = (await c.env.DB.prepare(
    'SELECT w.*, q.subject, q.q_type AS qType, q.content, q.options, q.answer, q.analysis FROM wrongbook w JOIN questions q ON q.id = w.question_id WHERE w.user_id = ? ORDER BY w.last_wrong_at DESC'
  ).bind(c.get('userID')).all<any>()).results || []
  // 字段包装成前端期望的结构：question.xxx
  return ok(c, list.map((w) => ({
    id: w.id,
    questionId: w.question_id,
    wrongCount: w.wrong_count,
    lastWrongAt: w.last_wrong_at,
    question: { id: w.question_id, subject: w.subject, qType: w.qType, content: w.content, options: w.options, answer: w.answer, analysis: w.analysis },
  })))
})

// POST /wrongbook/:id/mastered —— 标记已掌握（移出错题本）
examRoutes.post('/wrongbook/:id/mastered', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT * FROM wrongbook WHERE id = ?').bind(id).first<any>()
  if (!row) return fail(c, 1, '记录不存在')
  if (row.user_id !== c.get('userID')) return fail(c, 403, '不能操作别人的错题本')
  await c.env.DB.prepare('DELETE FROM wrongbook WHERE id = ?').bind(id).run()
  return ok(c, null)
})
