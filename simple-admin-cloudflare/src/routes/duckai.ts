// Duck.ai 匿名 AI 问答 —— 对应需求：免登录 AI 聊天 + 问答存档 + 归类到「学XX」主题
//
// 工作方式：后端代理调用 DuckDuckGo 的 duck.ai 聊天接口（无官方 API，为社区逆向契约，
// 参考 ddgs 库的实现），前端只管提问和展示。问题和答案落库 ai_chats 表，
// 用户可翻历史、按「学XX」主题（custom_modules）归类，作为该主题的信息源积累。
//
// 契约风险与对策：
//   - 匿名接口有每日限额（社区反馈约 10~20 条/IP/天），超限返回 429 —— 后端做
//     每用户每日 20 条限额，把 429 错误信息友好透出
//   - DuckDuckGo 可能改接口/要求 x-vqd-hash-1 等 —— 统一在 duckChat() 抛错，
//     失败也记录一行 status='error' 的历史，用户能看到失败原因
import { Hono } from 'hono'
import { AppCtx, Env, ok, fail, pager } from '../core'

export const duckaiRoutes = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// ---------- Duck.ai 客户端 ----------

const DDG_BASE = 'https://duckduckgo.com'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// duck.ai 当前可选模型（契约来自 ddgs 库；模型下线时 duck.ai 会返回明确错误并透出给用户）
export const DUCKAI_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o mini（OpenAI）' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku（Anthropic）' },
  { id: 'meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B（Meta）' },
  { id: 'mistralai/Mistral-Small-3.1-24B-Instruct', name: 'Mistral Small 3.1' },
]

// 每用户每日提问限额（Duck.ai 匿名额度本身就很少，本地限额提前拦截，避免触发对方 429）
const DAILY_LIMIT = 20

// 第 1 步：申请会话令牌（vqd）。
// 契约细节（参考 ddgs 库）：/duckchat/v1/status 有两种应答形态——
//   ① 302 重定向：令牌在响应头 x-vqd-4，或 Location 的 vqd= 参数里
//   ② 200：令牌在响应头 x-vqd-4 / x-vqd-4-1
// fetch 默认跟随重定向会丢掉 302 响应头，所以必须 redirect: 'manual'。
async function getVqd(): Promise<string> {
  const resp = await fetch(`${DDG_BASE}/duckchat/v1/status`, {
    redirect: 'manual',
    headers: {
      'User-Agent': UA,
      Accept: 'text/event-stream',
      // 关键头：不带它 DDG 只返回 {grant: null} 不给令牌
      'x-vqd-accept': '1',
    },
  })

  // 形态①：从 302 Location 的 vqd= 参数解析
  if (resp.status >= 300 && resp.status < 400) {
    const loc = resp.headers.get('location') || ''
    const m = /[?&]vqd=([^&]+)/.exec(loc)
    if (m) return decodeURIComponent(m[1])
  }

  // 两种形态：令牌响应头（3xx 的响应头在 manual 模式下也能读到）
  const vqd = resp.headers.get('x-vqd-4') || resp.headers.get('x-vqd-4-1')
  if (vqd) return vqd

  // 都拿不到：带上应答细节报错，方便后续诊断契约变化
  const body = (await resp.text().catch(() => '')).slice(0, 120)
  throw new Error(
    `Duck.ai 令牌申请失败（HTTP ${resp.status}，x-vqd-4 与 Location 均无令牌）：${body}`
  )
}

// 第 2 步：发起对话，解析 SSE 流拼出完整回答
async function duckChat(question: string, model: string): Promise<string> {
  const vqd = await getVqd()
  const resp = await fetch(`${DDG_BASE}/duckchat/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'x-vqd-4': vqd,
      'User-Agent': UA,
      Referer: 'https://duck.ai/',
      Origin: 'https://duck.ai',
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: question }] }),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    // 429 = 触发匿名限额；418/403 多为契约变更或拒访
    const hint = resp.status === 429 ? '，Duck.ai 匿名额度已用完，明天再来' : ''
    throw new Error(`Duck.ai 请求失败（HTTP ${resp.status}）${hint}：${text.slice(0, 160)}`)
  }

  const raw = await resp.text()
  let answer = ''
  for (const line of raw.split('\n')) {
    const s = line.trim()
    if (!s.startsWith('data:')) continue
    const data = s.slice(5).trim()
    if (!data || data === '[DONE]') continue
    try {
      const j = JSON.parse(data)
      if (j.role === 'assistant' && typeof j.message === 'string') answer += j.message
    } catch {
      /* 忽略心跳等非 JSON 行 */
    }
  }
  if (!answer) throw new Error('Duck.ai 返回了空回答（接口契约可能已变更）')
  return answer
}

// ---------- 路由（挂载在 authed 下，登录即可用，不占用按钮级权限） ----------

// GET /duckai/models —— 可选模型列表
duckaiRoutes.get('/duckai/models', (c: AppCtx) => ok(c, DUCKAI_MODELS))

// POST /duckai/chat —— 提问：{question, model?, moduleId?} → 代理 Duck.ai 并存档
duckaiRoutes.post('/duckai/chat', async (c: AppCtx) => {
  const userID = c.get('userID')
  const b = await c.req.json().catch(() => ({} as any))
  const question = (b.question || '').toString().trim()
  if (!question) return fail(c, 1, '问题不能为空')
  if (question.length > 4000) return fail(c, 1, '问题过长（最多 4000 字）')

  const model = DUCKAI_MODELS.some((m) => m.id === b.model) ? b.model : DUCKAI_MODELS[0].id

  // 归类到「学XX」主题（可选，传 moduleId 需存在）
  let moduleId: number | null = null
  if (b.moduleId) {
    const mod = await c.env.DB.prepare('SELECT id FROM custom_modules WHERE id = ?').bind(b.moduleId).first()
    if (!mod) return fail(c, 1, '要归类的学习主题不存在')
    moduleId = mod.id as number
  }

  // 每用户每日限额（UTC 口径）
  const used = (await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM ai_chats WHERE user_id = ? AND date(created_at) = date('now')"
  ).bind(userID).first<any>())!.n
  if (used >= DAILY_LIMIT) return fail(c, 1, `今天已提问 ${DAILY_LIMIT} 次（Duck.ai 匿名额度有限），明天再来吧`)

  // 调 Duck.ai（失败也存一行 error 历史，用户能看到原因；归类信息不丢）
  let answer = ''
  let status = 'ok'
  let error = ''
  try {
    answer = await duckChat(question, model)
  } catch (e: any) {
    status = 'error'
    error = (e?.message || '未知错误').slice(0, 500)
  }

  const r = await c.env.DB.prepare(
    'INSERT INTO ai_chats (user_id, module_id, question, answer, model, status, error) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userID, moduleId, question, answer, model, status, error).run()

  const id = r.meta.last_row_id
  if (status === 'error') return fail(c, 1, `AI 回答失败：${error}`)
  return ok(c, { id, answer, model, moduleId, remaining: DAILY_LIMIT - used - 1 })
})

// GET /duckai/chats —— 我的问答历史（分页；moduleId>0 按主题过滤，moduleId=-1 看未归类）
duckaiRoutes.get('/duckai/chats', async (c: AppCtx) => {
  const userID = c.get('userID')
  const { pageSize, offset } = pager(c)
  const moduleId = parseInt(c.req.query('moduleId') || '0', 10)

  let where = 'c.user_id = ?'
  const binds: any[] = [userID]
  if (moduleId === -1) where += ' AND c.module_id IS NULL'
  else if (moduleId > 0) { where += ' AND c.module_id = ?'; binds.push(moduleId) }

  const total = (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ai_chats c WHERE ${where}`).bind(...binds).first<any>())!.n
  const list = (await c.env.DB.prepare(
    `SELECT c.id, c.module_id, c.question, c.answer, c.model, c.status, c.error, c.created_at,
            m.name AS module_name, m.icon AS module_icon
     FROM ai_chats c LEFT JOIN custom_modules m ON m.id = c.module_id
     WHERE ${where} ORDER BY c.id DESC LIMIT ? OFFSET ?`
  ).bind(...binds, pageSize, offset).all<any>()).results || []

  return ok(c, { list, total, page: parseInt(c.req.query('page') || '1', 10), pageSize })
})

// PUT /duckai/chats/:id —— 归类/取消归类到「学XX」主题：{moduleId: 数字|null}
duckaiRoutes.put('/duckai/chats/:id', async (c: AppCtx) => {
  const userID = c.get('userID')
  const id = Number(c.req.param('id'))
  const b = await c.req.json().catch(() => ({} as any))

  const chat = await c.env.DB.prepare('SELECT id FROM ai_chats WHERE id = ? AND user_id = ?').bind(id, userID).first()
  if (!chat) return fail(c, 1, '记录不存在')

  let moduleId: number | null = null
  if (b.moduleId) {
    const mod = await c.env.DB.prepare('SELECT id FROM custom_modules WHERE id = ?').bind(b.moduleId).first()
    if (!mod) return fail(c, 1, '学习主题不存在')
    moduleId = mod.id as number
  }
  await c.env.DB.prepare('UPDATE ai_chats SET module_id = ? WHERE id = ?').bind(moduleId, id).run()
  return ok(c, { id, moduleId })
})

// DELETE /duckai/chats/:id —— 删除自己的一条历史
duckaiRoutes.delete('/duckai/chats/:id', async (c: AppCtx) => {
  const userID = c.get('userID')
  await c.env.DB.prepare('DELETE FROM ai_chats WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), userID).run()
  return ok(c, null)
})
