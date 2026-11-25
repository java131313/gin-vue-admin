// WebSocket 代理 Durable Object —— 一个实例承载一条「浏览器 ⇄ 目标服务」双向转发
//
// 生命周期：Worker 收到 /proxy/ws 的升级请求 → newUniqueId() 开一个本类实例 →
// 把浏览器 socket 交给实例 → 实例向目标 wss:// 发起升级连接 → 两条 socket 互转消息。
// 不用 hibernation：个人工具连接数小，事件监听模式代码更直白；DO 常驻内存，
// 空闲无消息时不产生 CPU 计费，连接保持。
export class ProxyDO {
  private browser: WebSocket | null = null
  private target: WebSocket | null = null

  constructor(_state: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const target = url.searchParams.get('target') || ''
    if (!/^wss?:\/\//i.test(target)) {
      return new Response('target must be ws:// or wss://', { status: 400 })
    }

    // 接受浏览器端 WebSocket
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.browser = server
    server.accept()

    // 向目标服务发起 WebSocket 升级连接（Workers 出站 ws 的正确姿势：
    // scheme 换成 http(s)，由 Upgrade 头触发协议切换；runtime 不吃 wss:// scheme）
    try {
      const httpUrl = target.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')
      const resp = await fetch(httpUrl, { headers: { Upgrade: 'websocket' } })
      const ws = resp.webSocket
      if (resp.status !== 101 || !ws) {
        this.sysSend(`连接目标失败：HTTP ${resp.status}`)
        server.close(1011, 'target refused')
        return new Response(null, { status: 101, webSocket: client })
      }
      this.target = ws
      ws.accept()
      this.sysSend('已连接目标服务')
      this.pipe(server, ws)
    } catch (e: any) {
      this.sysSend(`连接目标失败：${(e?.message || String(e)).slice(0, 300)}`)
      server.close(1011, 'target error')
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  // 双向转发：任一端消息原样发给对端（string / ArrayBuffer 都支持），
  // 任一端关闭则关掉另一端
  private pipe(browser: WebSocket, target: WebSocket) {
    browser.addEventListener('message', (ev) => {
      try {
        target.send(ev.data)
      } catch {
        /* 对端已断 */
      }
    })
    target.addEventListener('message', (ev) => {
      try {
        browser.send(ev.data)
      } catch {
        /* 对端已断 */
      }
    })
    browser.addEventListener('close', () => {
      try {
        target.close(1000, 'browser closed')
      } catch {
        /* 已断 */
      }
    })
    target.addEventListener('close', () => {
      try {
        browser.close(1000, 'target closed')
      } catch {
        /* 已断 */
      }
    })
  }

  private sysSend(msg: string) {
    try {
      this.browser?.send(JSON.stringify({ __sys: true, msg }))
    } catch {
      /* 已断 */
    }
  }
}
