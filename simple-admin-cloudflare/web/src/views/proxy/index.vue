<script setup>
// 网页快照 —— 反向代理 + KV 缓存
//
// 流程（严格按需求）：输入网址 → 服务端（Worker）访问目标 → 内容存 KV →
// 前端再从 KV 读取（GET /proxy/snap/:key）渲染到页面。
// 渲染用 iframe srcdoc + sandbox（禁脚本，防抓取页面 JS 读走本站 token），
// 相对资源经 <base href> 指向原站可加载个大概；「源码」tab 看原始 HTML。
// 历史列表点击直接读 KV 渲染，不再走网络抓取。
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchSnapshot, getSnapshot, getSnapshotHistory, deleteSnapshot } from '@/api/proxy'
import { getToken } from '@/utils/auth'

const url = ref('')
const fetching = ref(false)
const current = ref(null) // 当前快照 {key, url, status, size, fetchedAt, truncated}
const html = ref('')
const view = ref('render') // render | source
const history = ref([])
const loadingHistory = ref(false)
const iframeKey = ref(0) // srcdoc 变化时重建 iframe
const mode = ref('snapshot') // snapshot | ws

// 注入 <base href>：让抓来的页面里相对路径的图片/样式指向原站
const framedHtml = (doc, originalUrl) => {
  const base = `<base href="${originalUrl}">`
  if (/<head[^>]*>/i.test(doc)) return doc.replace(/<head[^>]*>/i, (m) => m + base)
  if (/<html[^>]*>/i.test(doc)) return doc.replace(/<html[^>]*>/i, (m) => m + '<head>' + base + '</head>')
  return base + doc
}

async function snapshotFromKV(key) {
  // 从 KV 读取正文并渲染（历史点击 + 抓取完成后都用这条路径）
  const res = await getSnapshot(key)
  current.value = { key, url: res.data.url, ...res.data }
  html.value = res.data.html
  iframeKey.value++
  view.value = 'render'
}

// 抓取：服务端访问 → 存 KV → 从 KV 读取渲染
async function grab() {
  const target = url.value.trim()
  if (!target || fetching.value) return
  if (!/^https?:\/\//i.test(target)) {
    ElMessage.warning('请输入完整网址（含 http:// 或 https://）')
    return
  }
  fetching.value = true
  try {
    const res = await fetchSnapshot({ url: target })
    if (res.data.truncated) ElMessage.warning('页面超过 2MB，已截断保存')
    await snapshotFromKV(res.data.key) // 存完后从 KV 读出来渲染
    loadHistory()
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    fetching.value = false
  }
}

// 历史：直接读 KV 渲染（不重新抓取）
async function openHistory(row) {
  try {
    await snapshotFromKV(row.key)
  } catch (e) {
    ElMessage.error(e.message || '读取快照失败')
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.url}」的快照吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  await deleteSnapshot(row.key)
  if (current.value?.key === row.key) {
    current.value = null
    html.value = ''
  }
  loadHistory()
  ElMessage.success('已删除')
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    const res = await getSnapshotHistory()
    history.value = res.data.list
  } finally {
    loadingHistory.value = false
  }
}

function fmtTime(t) {
  if (!t) return ''
  const d = new Date(t)
  return isNaN(d) ? t : d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(loadHistory)

// ---------- WS 代理模式 ----------

const wsUrl = ref('wss://echo.websocket.org')
const sock = ref(null)
const wsStatus = ref('disconnected') // disconnected | connecting | open | closed
const wsLog = ref([]) // {dir: 'in'|'out'|'sys', text, time}
const wsInput = ref('')

const wsStatusText = {
  disconnected: '未连接',
  connecting: '连接中…',
  open: '已连接',
  closed: '已断开'
}

function pushLog(dir, text) {
  wsLog.value.push({ dir, text, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) })
  if (wsLog.value.length > 500) wsLog.value.splice(0, wsLog.value.length - 500)
}

function wsConnect() {
  const target = wsUrl.value.trim()
  if (!/^wss?:\/\//i.test(target)) {
    ElMessage.warning('请输入 ws:// 或 wss:// 地址')
    return
  }
  wsDisconnect(true)
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  // WebSocket 握手无法带 Authorization 头，JWT 走 query 参数（服务端校验）
  const token = encodeURIComponent(getToken())
  const s = new WebSocket(`${proto}://${location.host}/api/proxy/ws?token=${token}&target=${encodeURIComponent(target)}`)
  sock.value = s
  wsStatus.value = 'connecting'
  pushLog('sys', `正在通过 Worker 代理连接 ${target} …`)

  s.onopen = () => {
    wsStatus.value = 'open'
    pushLog('sys', '浏览器 ⇄ Worker 通道已建立（等待目标握手消息）')
  }
  s.onmessage = async (ev) => {
    // DO 注入的系统消息（JSON 且带 __sys 标记）按系统消息显示
    if (typeof ev.data === 'string') {
      try {
        const j = JSON.parse(ev.data)
        if (j && j.__sys) {
          pushLog('sys', j.msg)
          return
        }
      } catch {
        /* 普通文本消息 */
      }
      pushLog('in', ev.data)
    } else if (ev.data instanceof Blob) {
      pushLog('in', `[二进制 ${ev.data.size} 字节] ${(await ev.data.text()).slice(0, 200)}`)
    } else {
      pushLog('in', `[二进制 ${ev.data.byteLength ?? '?'} 字节]`)
    }
  }
  s.onclose = (ev) => {
    wsStatus.value = 'closed'
    pushLog('sys', `连接关闭（code=${ev.code}${ev.reason ? '，' + ev.reason : ''}）`)
    if (sock.value === s) sock.value = null
  }
  s.onerror = () => pushLog('sys', '通道异常（查看目标地址是否正确、是否允许跨源）')
}

function wsDisconnect(silent = false) {
  if (sock.value) {
    sock.value.close(1000, 'user disconnect')
    sock.value = null
    if (!silent) pushLog('sys', '已手动断开')
  }
}

function wsSend() {
  const text = wsInput.value
  if (!text || !sock.value || sock.value.readyState !== 1) return
  sock.value.send(text)
  pushLog('out', text)
  wsInput.value = ''
}
</script>

<template>
  <div class="proxy-page">
    <!-- 顶部：模式切换 + 各自输入条 -->
    <div class="bar">
      <el-radio-group v-model="mode" size="small" class="mode">
        <el-radio-button value="snapshot">网页快照</el-radio-button>
        <el-radio-button value="ws">WS 代理</el-radio-button>
      </el-radio-group>

      <template v-if="mode === 'snapshot'">
        <el-input
          v-model="url"
          placeholder="输入要抓取的网址，如 https://example.com"
          clearable
          @keyup.enter="grab"
        >
          <template #prepend>网址</template>
        </el-input>
        <el-button type="primary" :loading="fetching" :disabled="!url.trim()" @click="grab">
          抓取
        </el-button>
      </template>

      <template v-else>
        <el-input
          v-model="wsUrl"
          placeholder="输入 ws:// 或 wss:// 地址，如 wss://echo.websocket.org"
          clearable
          :disabled="wsStatus === 'open' || wsStatus === 'connecting'"
          @keyup.enter="wsConnect"
        >
          <template #prepend>WS</template>
        </el-input>
        <el-button
          v-if="wsStatus !== 'open' && wsStatus !== 'connecting'"
          type="primary"
          :disabled="!wsUrl.trim()"
          @click="wsConnect"
        >
          连接
        </el-button>
        <el-button v-else type="danger" plain @click="wsDisconnect()">断开</el-button>
        <span class="ws-state" :class="wsStatus">{{ wsStatusText[wsStatus] }}</span>
      </template>
    </div>

    <!-- WS 代理模式：消息面板 -->
    <div v-if="mode === 'ws'" class="ws-body">
      <el-scrollbar ref="wsScroll" class="ws-log">
        <div v-for="(m, i) in wsLog" :key="i" class="ws-line" :class="m.dir">
          <span class="ws-time">{{ m.time }}</span>
          <span class="ws-dir">{{ m.dir === 'out' ? '↑ 发送' : m.dir === 'in' ? '↓ 接收' : '⚙ 系统' }}</span>
          <span class="ws-text">{{ m.text }}</span>
        </div>
        <el-empty v-if="wsLog.length === 0" description="连接后此处显示消息流（↑发 ↓收 ⚙系统）" :image-size="60" />
      </el-scrollbar>
      <div class="ws-input-bar">
        <el-input
          v-model="wsInput"
          placeholder="输入要发送的消息，Enter 发送"
          :disabled="wsStatus !== 'open'"
          @keyup.enter="wsSend"
        />
        <el-button type="primary" :disabled="wsStatus !== 'open' || !wsInput" @click="wsSend">发送</el-button>
      </div>
    </div>

    <div v-if="mode === 'snapshot'" class="body">
      <!-- 左侧：快照历史 -->
      <div class="side">
        <div class="side-head">快照历史（KV，7 天过期）</div>
        <el-scrollbar v-loading="loadingHistory" class="side-list">
          <div
            v-for="row in history"
            :key="row.key"
            class="side-item"
            :class="{ active: current?.key === row.key }"
            @click="openHistory(row)"
          >
            <div class="side-url">{{ row.url }}</div>
            <div class="side-meta">
              <span class="tag" :class="row.status === 200 ? 'ok' : 'bad'">{{ row.status }}</span>
              <span v-if="row.truncated" class="tag warn">截断</span>
              <span class="time">{{ fmtTime(row.fetchedAt) }}</span>
              <el-button link type="danger" size="small" class="del" @click.stop="remove(row)">删</el-button>
            </div>
          </div>
          <el-empty v-if="!loadingHistory && history.length === 0" description="还没有快照" :image-size="60" />
        </el-scrollbar>
      </div>

      <!-- 右侧：渲染区 -->
      <div class="main">
        <template v-if="current">
          <div class="main-bar">
            <el-radio-group v-model="view" size="small">
              <el-radio-button value="render">渲染页面</el-radio-button>
              <el-radio-button value="source">HTML 源码</el-radio-button>
            </el-radio-group>
            <span class="info">
              {{ current.status }} · {{ (html.length / 1024).toFixed(1) }} KB · {{ fmtTime(current.fetchedAt) }}
              <template v-if="current.truncated"> · 已截断</template>
            </span>
            <a :href="current.url" target="_blank" class="origin">访问原站 ↗</a>
          </div>
          <!-- sandbox 禁脚本：抓来的页面 JS 不会以本站身份运行 -->
          <iframe
            v-if="view === 'render'"
            :key="iframeKey"
            class="frame"
            :srcdoc="framedHtml(html, current.url)"
            sandbox=""
          />
          <pre v-else class="source"><code>{{ html }}</code></pre>
        </template>

        <div v-else class="welcome">
          <div class="welcome-icon">🌐</div>
          <h3>网页快照</h3>
          <p class="welcome-tip">
            输入网址后由服务端访问目标页面、内容存入 KV，再从 KV 读取渲染到这里；
            <br />渲染为无脚本快照（sandbox），历史记录点击直接读 KV，不会重新抓取。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.proxy-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px);
}

/* 顶部输入条 */
.bar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  align-items: center;
}

.bar .mode {
  flex-shrink: 0;
}

.ws-state {
  flex-shrink: 0;
  font-size: 13px;
}

.ws-state.open {
  color: #67c23a;
}

.ws-state.connecting {
  color: #e6a23c;
}

.ws-state.closed,
.ws-state.disconnected {
  color: #909399;
}

/* WS 消息面板 */
.ws-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  min-height: 0;
}

.ws-log {
  flex: 1;
  padding: 10px 12px;
}

.ws-line {
  display: flex;
  gap: 8px;
  padding: 3px 0;
  font-size: 13px;
  line-height: 1.6;
  font-family: monospace;
}

.ws-time {
  color: #c0c4cc;
  flex-shrink: 0;
}

.ws-dir {
  flex-shrink: 0;
  width: 56px;
}

.ws-line.out .ws-dir {
  color: #409eff;
}

.ws-line.in .ws-dir {
  color: #67c23a;
}

.ws-line.sys .ws-dir {
  color: #e6a23c;
}

.ws-text {
  white-space: pre-wrap;
  word-break: break-all;
  color: #303133;
}

.ws-input-bar {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid #ebeef5;
}

/* 主体：左历史右渲染 */
.body {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}

/* 左侧历史 */
.side {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.side-head {
  padding: 10px 12px;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid #ebeef5;
}

.side-list {
  flex: 1;
  padding: 8px;
}

.side-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}

.side-item:hover {
  background: #f5f7fa;
}

.side-item.active {
  background: #ecf5ff;
}

.side-url {
  font-size: 13px;
  color: #303133;
  word-break: break-all;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.side-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
}

.tag {
  padding: 0 6px;
  border-radius: 4px;
  line-height: 18px;
}

.tag.ok {
  background: #f0f9eb;
  color: #67c23a;
}

.tag.bad {
  background: #fef0f0;
  color: #f56c6c;
}

.tag.warn {
  background: #fdf6ec;
  color: #e6a23c;
}

.time {
  color: #c0c4cc;
}

.del {
  margin-left: auto;
}

/* 右侧渲染 */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.main-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #ebeef5;
}

.info {
  font-size: 12px;
  color: #909399;
}

.origin {
  margin-left: auto;
  font-size: 13px;
  color: #409eff;
  text-decoration: none;
}

.frame {
  flex: 1;
  border: none;
  width: 100%;
  background: #fff;
}

.source {
  flex: 1;
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  background: #f8f8f8;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 欢迎页 */
.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.welcome-icon {
  font-size: 48px;
}

.welcome-tip {
  color: #909399;
  line-height: 1.9;
  margin-top: 12px;
}

/* 移动端 */
@media (max-width: 768px) {
  .proxy-page {
    height: auto;
  }

  .body {
    flex-direction: column;
  }

  .side {
    width: 100%;
    max-height: 220px;
  }

  .frame,
  .source {
    min-height: 55vh;
  }

  .ws-body {
    min-height: 55vh;
  }
}
</style>
