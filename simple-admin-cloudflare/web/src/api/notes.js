// 笔记接口 —— 直连 Sealos 对象存储（S3 兼容，bucket 已开放读写 + CORS）
//
// 存储结构：key 即路径，目录 = 以 / 结尾的 key 前缀（S3 无真实目录）。
// 列举用 ListObjectsV2（delimiter=/ 分层），读写用普通 PUT/GET/DELETE，
// 全部为浏览器直连 fetch，不经过后端。
const BASE = 'https://objectstorageapi.bja.sealos.run/mpzfivcp-watchwonderful/'

// key 转 URL：保留 / 路径分隔，其余部分编码（中文/空格等）
const keyUrl = (key) => BASE + encodeURI(key)

// 取路径最后一段做显示名（'go中的gin/基础.md' → '基础.md'）
const baseName = (key) => {
  const s = key.endsWith('/') ? key.slice(0, -1) : key
  return s.split('/').pop() || key
}

// 解析 ListObjectsV2 的 XML：目录（CommonPrefixes）在前、文件在后，各自按名称排序
function parseListXml(xmlText, prefix) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const dirs = [...doc.querySelectorAll('CommonPrefixes > Prefix')].map((p) => ({
    key: p.textContent,
    name: baseName(p.textContent),
    isDir: true
  }))
  const files = [...doc.querySelectorAll('Contents > Key')]
    .map((k) => k.textContent)
    .filter((k) => k !== prefix && !k.endsWith('/')) // 排除目录占位对象自身
    .map((k) => ({ key: k, name: baseName(k), isDir: false }))
  const cmp = (a, b) => a.name.localeCompare(b.name, 'zh-CN')
  return [...dirs.sort(cmp), ...files.sort(cmp)]
}

/**
 * 列出某个前缀下的直接子节点（目录 + 文件）
 * @param {string} prefix 目录 key（如 '聊斋/'，根目录传 ''）
 * @returns {Promise<Array<{key:string,name:string,isDir:boolean}>>}
 */
export async function listNotes(prefix = '') {
  const res = await fetch(`${BASE}?list-type=2&delimiter=/&prefix=${encodeURIComponent(prefix)}`)
  if (!res.ok) throw new Error(`列举失败（HTTP ${res.status}）`)
  return parseListXml(await res.text(), prefix)
}

/** 读取文件内容 */
export async function readNote(key) {
  const res = await fetch(keyUrl(key))
  if (!res.ok) throw new Error(`读取失败（HTTP ${res.status}）`)
  return res.text()
}

/**
 * 保存文件（S3 PUT 天然幂等；不存在则创建）
 * @returns {Promise<void>} 失败抛错
 */
export async function saveNote(key, content) {
  const res = await fetch(keyUrl(key), {
    method: 'PUT',
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    body: content
  })
  if (!res.ok) throw new Error(`保存失败（HTTP ${res.status}）`)
}

/** 新建空文件 / 目录占位对象 */
export const createNote = (key, content = '') => saveNote(key, content)

/** 删除单个文件 */
export async function deleteNote(key) {
  const res = await fetch(keyUrl(key), { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`删除失败（HTTP ${res.status}）`)
}

/** 删除目录：递归列出前缀下所有 key 逐个删（S3 无批量删除，这里并行发） */
export async function deleteNoteDir(prefix) {
  let token = ''
  const keys = []
  do {
    const url = `${BASE}?list-type=2&prefix=${encodeURIComponent(prefix)}` +
      (token ? `&continuation-token=${encodeURIComponent(token)}` : '')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`列举目录失败（HTTP ${res.status}）`)
    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')
    keys.push(...[...doc.querySelectorAll('Contents > Key')].map((k) => k.textContent))
    token = doc.querySelector('NextContinuationToken')?.textContent || ''
  } while (token)
  await Promise.all(keys.map((k) => fetch(keyUrl(k), { method: 'DELETE' })))
}
