// 网页快照（反向代理 + KV 缓存） —— 输入网址 → 服务端抓取 → 存 KV → 从 KV 读取渲染
//
// 流程：
//   POST /proxy/fetch {url}     服务端访问目标网址，内容存 KV（key = url 的 SHA-256），
//                               返回快照 key——随后前端用 GET /proxy/snap/:key 从 KV 读取渲染
//   GET  /proxy/snap/:key       从 KV 读取快照 HTML（iframe srcdoc 渲染或看源码）
//   GET  /proxy/history         快照历史列表（读 KV metadata，不读正文）
//   DELETE /proxy/snap/:key     删除一条快照
//
// 安全：登录可用；只允许 http/https；拒绝字面私有地址（SSRF 基础防护）；
// 抓取限 15 秒超时、2MB 上限；快照 7 天自动过期。
import { Hono } from 'hono'
import { AppCtx, Env, ok, fail } from '../core'

export const proxyRoutes = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

const SNAPSHOT_TTL = 7 * 24 * 3600 // 快照保留 7 天
const MAX_BYTES = 2 * 1024 * 1024  // 单页最多抓 2MB
const FETCH_TIMEOUT = 15_000       // 抓取超时 15 秒

// ---------- 工具 ----------

// 目标 URL 基础校验（SSRF 防护：只挡字面私有地址，管理员自用工具的底线防护）
function validateUrl(raw: string): URL | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase()
  const blocked = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|::1|fc|fd|fe80)/
  if (blocked.test(host)) return null
  const m = /^172\.(\d+)\./.exec(host)
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return null // 172.16.0.0/12
  return u
}

// url → KV key（SHA-256 hex，规避长 URL 超 KV key 512 字节限制）
async function snapKey(url: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
  return 'snap:' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 流式读取响应体，超 MAX_BYTES 截断并标记
async function readBody(resp: Response): Promise<{ text: string; truncated: boolean }> {
  const reader = resp.body?.getReader()
  if (!reader) return { text: '', truncated: false }
  const chunks: Uint8Array[] = []
  let size = 0
  let truncated = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      truncated = true
      chunks.push(value.slice(0, MAX_BYTES - (size - value.byteLength)))
      break
    }
    chunks.push(value)
  }
  reader.cancel().catch(() => {})
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const merged = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    merged.set(c, off)
    off += c.byteLength
  }
  return { text: new TextDecoder("utf-8").decode(merged), truncated }
}

// ---------- 路由（登录即可用） ----------

// POST /proxy/fetch —— 服务端访问目标网址，内容存 KV，返回快照 key
proxyRoutes.post('/proxy/fetch', async (c: AppCtx) => {
  const b = await c.req.json().catch(() => ({} as any))
  const target = validateUrl((b.url || '').trim())
  if (!target) return fail(c, 1, '网址无效：仅支持 http/https，且不允许内网/回环地址')

  let resp: Response
  try {
    resp = await fetch(target.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 simple-admin-snapshot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })
  } catch (e: any) {
    const msg = e?.name === 'TimeoutError' ? '访问超时（15 秒）' : `无法访问：${(e?.message || e).toString().slice(0, 120)}`
    return fail(c, 1, msg)
  }

  const { text, truncated } = await readBody(resp)
  const key = await snapKey(target.toString())
  const meta = {
    url: target.toString(),
    finalUrl: resp.url,                       // 重定向后的真实地址
    status: resp.status,
    contentType: resp.headers.get('content-type') || '',
    size: text.length,
    truncated,
    fetchedAt: new Date().toISOString(),
  }
  await c.env.SNAP_KV.put(key, text, { metadata: meta, expirationTtl: SNAPSHOT_TTL })

  return ok(c, { key, ...meta })
})

// GET /proxy/snap/:key —— 从 KV 读取快照正文（渲染 iframe srcdoc / 看源码都用它）
proxyRoutes.get('/proxy/snap/:key', async (c: AppCtx) => {
  const key = c.req.param("key") || ""
  if (!/^snap:[0-9a-f]{64}$/.test(key)) return fail(c, 1, 'key 格式错误')
  const item = await c.env.SNAP_KV.getWithMetadata<{ url: string; fetchedAt: string }>(key, 'text')
  if (!item.value) return fail(c, 1, '快照不存在或已过期')
  return ok(c, { key, html: item.value, url: item.metadata?.url, fetchedAt: item.metadata?.fetchedAt })
})

// GET /proxy/history —— 快照历史（按抓取时间倒序；KV list 单次最多 1000 条，够用）
proxyRoutes.get('/proxy/history', async (c: AppCtx) => {
  const list = await c.env.SNAP_KV.list<{ url: string; fetchedAt: string; status: number; size: number; truncated: boolean }>({ prefix: 'snap:' })
  const items = list.keys
    .filter((k) => k.metadata)
    .map((k) => ({ key: k.name, ...k.metadata }))
    .sort((a: any, b: any) => (a.fetchedAt < b.fetchedAt ? 1 : -1))
  return ok(c, { total: items.length, list: items })
})

// DELETE /proxy/snap/:key —— 删除一条快照
proxyRoutes.delete('/proxy/snap/:key', async (c: AppCtx) => {
  await c.env.SNAP_KV.delete(c.req.param('key') || '')
  return ok(c, null)
})
