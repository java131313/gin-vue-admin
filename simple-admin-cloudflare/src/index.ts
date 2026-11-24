// 程序入口 —— Cloudflare Workers 版 simple-admin
//
// 架构对比 Go 版：
//   Gin（HTTP 框架）     → Hono
//   PostgreSQL + GORM   → D1（SQLite，直接写 SQL）
//   GORM AutoMigrate    → 启动时执行 CREATE TABLE IF NOT EXISTS
//   幂等种子数据         → 首次启动自动执行 seed.sql（从 PG 导出转换）
//   JWT（golang-jwt）    → jose
//   bcrypt              → bcryptjs
//   前端 Nginx 部署      → Workers Static Assets（同一个 Worker 同源托管页面 + API）
import { Hono, Context, Next } from 'hono'
import { cors } from 'hono/cors'
import { Env, jwtAuth, requirePerm } from './core'
import { SCHEMA_SQL } from './schema'
import { SEED_SQL } from './seed'
import { loginRoute, authRoutes } from './routes/auth'
import { learnRoutes } from './routes/learn'
import { contentRoutes } from './routes/content'
import { examRoutes } from './routes/exam'
import { customRoutes } from './routes/custom'
import { graphRoutes } from './routes/graph'
import { duckaiRoutes } from './routes/duckai'

const app = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// 跨域：开发时前端 vite(8080) 直连 Worker 也需要（生产同源无影响）
app.use('/api/*', cors())

// ---------- 启动初始化：建表 + 首次种子 ----------
// Workers 每次冷启动都会执行；CREATE TABLE IF NOT EXISTS 和空表检查都是幂等的
let booted = false
async function ensureBoot(env: Env) {
  if (booted) return

  // 1. 建表（批量执行）
  await env.DB.batch(SCHEMA_SQL.map((sql) => env.DB.prepare(sql)))

  // 2. 首次启动：users 表为空 → 导入种子数据
  const users = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<any>()
  if (users && users.n === 0) {
    // 591 条 INSERT 小批量顺序执行（每批 20 条，避免 D1 单批大小限制）
    const statements = SEED_SQL.map((s) => env.DB.prepare(s))
    for (let i = 0; i < statements.length; i += 20) {
      await env.DB.batch(statements.slice(i, i + 20))
    }
    console.log(`种子数据导入完成：${statements.length} 条`)
  }
  booted = true
}
app.use('/api/*', async (c, next) => {
  await ensureBoot(c.env)
  await next()
})

// ---------- 公开接口：仅登录 ----------
app.route('/api', loginRoute)

// ---------- 以下全部需要登录 ----------
const authed = new Hono<{ Bindings: Env; Variables: { userID: number } }>()
authed.use('/*', jwtAuth())

// 方法感知的权限校验：GET→list、POST→create、PUT→update、DELETE→delete
// （与 Go 版每个接口单独 RequirePerm 的效果一致）
function managePerm(list: string, create: string, update: string, del: string) {
  const map: Record<string, string> = { GET: list, POST: create, PUT: update, DELETE: del }
  return (c: Context<{ Bindings: Env; Variables: { userID: number } }>, next: Next) =>
    requirePerm(map[c.req.method] || list)(c, next)
}

// 注意：Hono 按注册顺序执行处理器，权限中间件必须注册在业务路由之前
authed.use('/users/*', managePerm('user:list', 'user:create', 'user:update', 'user:delete'))
authed.use('/users', managePerm('user:list', 'user:create', 'user:update', 'user:delete'))
authed.use('/roles/*', managePerm('role:list', 'role:create', 'role:update', 'role:delete'))
authed.use('/roles', managePerm('role:list', 'role:create', 'role:update', 'role:delete'))
authed.use('/menus/*', managePerm('menu:list', 'menu:create', 'menu:update', 'menu:delete'))
authed.use('/menus', managePerm('menu:list', 'menu:create', 'menu:update', 'menu:delete'))
authed.use('/words/*', managePerm('word:list', 'word:create', 'word:update', 'word:delete'))
authed.use('/words', managePerm('word:list', 'word:create', 'word:update', 'word:delete'))
authed.use('/articles/*', managePerm('art:list', 'art:create', 'art:update', 'art:delete'))
authed.use('/articles', managePerm('art:list', 'art:create', 'art:update', 'art:delete'))
authed.use('/formulas/*', managePerm('formula:list', 'formula:create', 'formula:update', 'formula:delete'))
authed.use('/formulas', managePerm('formula:list', 'formula:create', 'formula:update', 'formula:delete'))
authed.use('/ai/contents-admin/*', managePerm('ai:list', 'ai:create', 'ai:update', 'ai:delete'))
authed.use('/ai/contents-admin', managePerm('ai:list', 'ai:create', 'ai:update', 'ai:delete'))
authed.use('/go/contents-admin/*', managePerm('go:list', 'go:create', 'go:update', 'go:delete'))
authed.use('/go/contents-admin', managePerm('go:list', 'go:create', 'go:update', 'go:delete'))
authed.use('/course/contents-admin/*', managePerm('course:list', 'course:create', 'course:update', 'course:delete'))
authed.use('/course/contents-admin', managePerm('course:list', 'course:create', 'course:update', 'course:delete'))
authed.use('/custom/modules-admin/*', managePerm('template:list', 'template:create', 'template:update', 'template:delete'))
authed.use('/custom/modules-admin', managePerm('template:list', 'template:create', 'template:update', 'template:delete'))
authed.use('/custom/items-admin/*', managePerm('template:list', 'template:create', 'template:update', 'template:delete'))
authed.use('/custom/items-admin', managePerm('template:list', 'template:create', 'template:update', 'template:delete'))

// 业务路由
authed.route('/', authRoutes)    // /auth/info、/auth/logout、/users、/roles、/menus
authed.route('/', learnRoutes)   // /words、/study/*
authed.route('/', contentRoutes) // 阅读、公式、AI、Go、课程
authed.route('/', examRoutes)    // /exam/*、/wrongbook
authed.route('/', customRoutes)  // /custom/*
authed.route('/', graphRoutes)   // /graph/*
authed.route('/', duckaiRoutes)  // /duckai/*（匿名 AI 问答存档，登录即可）

app.route('/api', authed)

// ---------- SPA 兜底回退 ----------
// wrangler.toml 已配 not_found_handling = "single-page-application"，正常情况下 assets
// 会直接回退 index.html、走不到这里；线上曾出现 assets 文件能访问但 fallback 不生效
// 的怪状（静态文件 200、导航请求 404），这里在 Worker 层再兜一道，两种机制互补：
// 非 /api 的 GET 导航请求（无 asset 匹配透传到 Worker）→ 显式取 index.html 返回。
app.all('*', async (c) => {
  if (c.req.method === 'GET' && !c.req.path.startsWith('/api/') && c.env.ASSETS) {
    return c.env.ASSETS.fetch(new URL('/index.html', c.req.url).toString())
  }
  return c.notFound()
})

export default app
