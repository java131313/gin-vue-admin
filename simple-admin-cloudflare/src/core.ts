// 核心工具：环境类型、统一响应、JWT 签发/校验、登录与权限中间件
//
// 与 Go 版的 core/response.go、core/jwt.go、middleware/auth.go、middleware/perm.go 对应。
import { Context, Next } from 'hono'
import { SignJWT, jwtVerify } from 'jose'

// Cloudflare Worker 的环境绑定（wrangler.toml 里配置）
export type Env = {
  DB: D1Database              // D1 数据库（SQLite）
  AI: Ai                      // Workers AI（AI 问答功能用）
  SNAP_KV: KVNamespace        // Workers KV（网页快照缓存，7 天过期）
  PROXY_DO: DurableObjectNamespace // WebSocket 代理会话（每条连接一个实例）
  JWT_SECRET: string          // JWT 签名密钥
  KIMI_API_KEY?: string       // Kimi API Key（可选）
  KIMI_MODEL?: string         // Kimi 模型名（可选）
  ASSETS?: Fetcher            // Static Assets 绑定（SPA 兜底回退用）
}

// Hono 上下文变量：中间件把当前用户 ID 放在这里
export type AppCtx = Context<{ Bindings: Env; Variables: { userID: number } }>

// ---------- 统一响应格式（与 Go 版一致：{code, msg, data}，前端拦截器按此解析） ----------
export function ok(c: AppCtx, data: unknown) {
  return c.json({ code: 0, msg: 'success', data })
}
export function fail(c: AppCtx, code: number, msg: string) {
  return c.json({ code, msg, data: null })
}

// ---------- JWT ----------
const encoder = new TextEncoder()

// 签发登录令牌（HS256，有效期默认 72 小时）
export async function signToken(userID: number, username: string, secret: string, hours = 72): Promise<string> {
  return new SignJWT({ userID, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('simple-admin')
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(encoder.encode(secret))
}

// JWTAuth 登录鉴权中间件：校验 Authorization: Bearer <token>，把 userID 放进上下文
export function jwtAuth() {
  return async (c: AppCtx, next: Next) => {
    const header = c.req.header('Authorization') || ''
    if (!header.startsWith('Bearer ')) return fail(c, 401, '未登录或令牌缺失')
    try {
      const { payload } = await jwtVerify(header.slice(7), encoder.encode(c.env.JWT_SECRET))
      c.set('userID', payload.userID as number)
      await next()
    } catch {
      return fail(c, 401, '登录已过期，请重新登录')
    }
  }
}

// ---------- RBAC ----------
// 查询某用户通过其角色拥有的全部权限标识
export async function userPerms(db: D1Database, userID: number): Promise<string[]> {
  const r = await db
    .prepare(
      `SELECT DISTINCT m.perm FROM user_roles ur
       JOIN role_menus rm ON rm.role_id = ur.role_id
       JOIN menus m ON m.id = rm.menu_id
       WHERE ur.user_id = ? AND m.perm != ''`
    )
    .bind(userID)
    .all()
  return (r.results || []).map((x) => x.perm as string)
}

// 查询某用户可见的全部菜单（去重）
export async function userMenus(db: D1Database, userID: number): Promise<any[]> {
  const r = await db
    .prepare(
      `SELECT DISTINCT m.* FROM user_roles ur
       JOIN role_menus rm ON rm.role_id = ur.role_id
       JOIN menus m ON m.id = rm.menu_id
       WHERE ur.user_id = ?
       ORDER BY m.sort, m.id`
    )
    .bind(userID)
    .all()
  return (r.results || []) as any[]
}

// RequirePerm 按钮级/接口级权限校验中间件（必须放在 jwtAuth 之后）
export function requirePerm(perm: string) {
  return async (c: AppCtx, next: Next) => {
    const perms = await userPerms(c.env.DB, c.get('userID'))
    if (perms.includes(perm)) return next()
    return fail(c, 403, '没有操作权限，请联系管理员')
  }
}

// ---------- 通用小工具 ----------

// 解析分页参数（带默认值与上限，与 Go 版 ListXxx 逻辑一致）
export function pager(c: AppCtx): { page: number; pageSize: number; offset: number } {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1)
  let pageSize = parseInt(c.req.query('pageSize') || '10', 10) || 10
  if (pageSize < 1 || pageSize > 100) pageSize = 10
  return { page, pageSize, offset: (page - 1) * pageSize }
}

// 把扁平菜单列表组装成树（children 字段，与 Go 版 BuildMenuTree 一致）
export function buildTree(menus: any[]): any[] {
  const childrenMap = new Map<number, any[]>()
  for (const m of menus) {
    const list = childrenMap.get(m.parent_id) || []
    list.push({ ...m, children: [] })
    childrenMap.set(m.parent_id, list)
  }
  const tree = childrenMap.get(0) || []
  const attach = (node: any) => {
    node.children = childrenMap.get(node.id) || []
    node.children.forEach(attach)
  }
  tree.forEach(attach)
  return tree
}

// 内容摘要：取第一行截断 60 字（出题干用，与 Go 版 summary 一致）
export function summary(content: string): string {
  const first = (content || '').split('\n')[0]
  return first.length > 60 ? first.slice(0, 60) + '……' : first
}

// 洗牌（Fisher-Yates，出题干扰项用）
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
