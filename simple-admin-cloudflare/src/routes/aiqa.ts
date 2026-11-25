// AI 问答 —— Cloudflare Workers AI 驱动：提问 + 问答存档 + 归类到「学XX」主题
//
// 工作方式：前端提问 → 本路由调用 env.AI（Workers AI 绑定，同平台、免费额度）
// → 问题和答案落库 ai_chats 表 → 用户翻历史、按「学XX」主题（custom_modules）
// 归类过滤，作为该主题的信息源积累。
//
// 额度：Workers AI 免费档每天 10,000 Neurons（约 300+ 次 8B 模型问答），
// 应用层再限每用户每日 20 条，双保险。
import { Hono } from 'hono'
import { AppCtx, Env, ok, fail, pager } from '../core'

export const aiqaRoutes = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// Workers AI 可选模型（2026-11 实测在役；注意 Workers AI 会下线旧模型，更换时以
// https://developers.cloudflare.com/workers-ai/models/ 目录为准）。
// id 为 custom 的走「通用 OpenAI 兼容端点」（env 配置 URL/KEY/MODEL，见
// generateViaCustom）——OpenRouter / Gemini 兼容模式 / DeepSeek / Mistral 等都
// 走这一个通道；GitHub Models 已于 2026-07-30 退役（models.github.ai 只剩占位页），
// 别再用它。
const MODELS = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B（Workers AI，默认）' },
  { id: '@cf/qwen/qwen2.5-coder-32b-instruct', name: 'Qwen2.5 Coder 32B（Workers AI）' },
  { id: 'custom', name: '自定义 API（OpenAI 兼容端点）' },
]

// 每用户每日提问限额（Workers AI 免费额度本身充裕，限额防误刷）
const DAILY_LIMIT = 20

// 调 Workers AI 生成回答（非流式，失败抛错由上层存档记录）
// 不同模型返回结构不同：标准文本模型是 {response: string}；
// 防御性解析常见变体，未知结构把摘要放进错误方便诊断。
async function generate(c: AppCtx, question: string, model: string): Promise<string> {
  const res: any = await c.env.AI.run(model as Parameters<typeof c.env.AI.run>[0], {
    messages: [{ role: 'user', content: question }],
    max_tokens: 1024,
  })
  let answer = ''
  if (typeof res?.response === 'string') answer = res.response
  else if (typeof res?.result?.response === 'string') answer = res.result.response
  else if (typeof res?.choices?.[0]?.message?.content === 'string') answer = res.choices[0].message.content
  if (!answer.trim()) {
    throw new Error(`Workers AI 返回结构无法解析：${JSON.stringify(res)?.slice(0, 200)}`)
  }
  return answer.trim()
}

// 通用 OpenAI 兼容端点生成（env 配置，key 走 secret）：
//   AI_PROXY_URL   完整 chat/completions 地址，如 https://openrouter.ai/api/v1/chat/completions
//   AI_PROXY_KEY   API Key（wrangler secret put AI_PROXY_KEY）
//   AI_PROXY_MODEL 模型名，如 openrouter 免费档：deepseek/deepseek-r1:free
// 配置缺失时调用报明确指引；401/429 分别提示 key 失效/额度耗尽。
async function generateViaCustom(c: AppCtx, question: string): Promise<string> {
  const url = c.env.AI_PROXY_URL
  const key = c.env.AI_PROXY_KEY
  if (!url || !key) {
    throw new Error('未配置自定义 API：请设置 AI_PROXY_URL 变量和 AI_PROXY_KEY secret 后再用')
  }
  const res = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      // 部分 WAF（如 Kimi）按"请求头完整度"判机器人：补齐浏览器级头部
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Origin: 'https://www.kimi.com',
      Referer: 'https://www.kimi.com/',
    },
    body: JSON.stringify({
      model: c.env.AI_PROXY_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: question }],
      max_tokens: 1024,
    }),
  })
  if (res.status === 401) throw new Error('自定义 API Key 无效或已过期，请更新 AI_PROXY_KEY secret')
  if (res.status === 429) throw new Error('自定义 API 额度已用完，请明天再试或更换模型')
  if (!res.ok) {
    throw new Error(`自定义 API 请求失败（HTTP ${res.status}）：${(await res.text()).slice(0, 150)}`)
  }
  const j: any = await res.json()
  // 推理模型（如 Kimi K2）思考过程在 reasoning_content，正式回答在 content；
  // 优先 content，为空兜底 reasoning_content
  const msg = j?.choices?.[0]?.message
  const answer = msg?.content || msg?.reasoning_content
  if (!answer) throw new Error(`自定义 API 返回结构无法解析：${JSON.stringify(j)?.slice(0, 200)}`)
  return answer.trim()
}

// ---------- 路由（挂载在 authed 下，登录即可用，不占用按钮级权限） ----------

// GET /aiqa/models —— 可选模型列表
aiqaRoutes.get('/aiqa/models', (c: AppCtx) => ok(c, MODELS))

// POST /aiqa/chat —— 提问：{question, model?, moduleId?} → Workers AI 生成并存档
aiqaRoutes.post('/aiqa/chat', async (c: AppCtx) => {
  const userID = c.get('userID')
  const b = await c.req.json().catch(() => ({} as any))
  const question = (b.question || '').toString().trim()
  if (!question) return fail(c, 1, '问题不能为空')
  if (question.length > 4000) return fail(c, 1, '问题过长（最多 4000 字）')

  const model = MODELS.some((m) => m.id === b.model) ? b.model : MODELS[0].id

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
  if (used >= DAILY_LIMIT) return fail(c, 1, `今天已提问 ${DAILY_LIMIT} 次，明天再来吧`)

  // 调 AI 生成（custom 走通用 OpenAI 兼容端点，其余走 Workers AI）；
  // 失败也存一行 error 历史，用户能看到原因；归类信息不丢
  let answer = ''
  let status = 'ok'
  let error = ''
  try {
    answer = model === 'custom'
      ? await generateViaCustom(c, question)
      : await generate(c, question, model)
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

// GET /aiqa/chats —— 我的问答历史（分页；moduleId>0 按主题过滤，moduleId=-1 看未归类）
aiqaRoutes.get('/aiqa/chats', async (c: AppCtx) => {
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

// PUT /aiqa/chats/:id —— 归类/取消归类到「学XX」主题：{moduleId: 数字|null}
aiqaRoutes.put('/aiqa/chats/:id', async (c: AppCtx) => {
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

// DELETE /aiqa/chats/:id —— 删除自己的一条历史
aiqaRoutes.delete('/aiqa/chats/:id', async (c: AppCtx) => {
  const userID = c.get('userID')
  await c.env.DB.prepare('DELETE FROM ai_chats WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), userID).run()
  return ok(c, null)
})
