// 网页快照接口（反向代理：服务端抓取 → KV 缓存 → 读取渲染）
import request from '@/utils/request'

// 抓取网址（data: {url}）→ {key, url, status, size, fetchedAt, truncated}
export const fetchSnapshot = (data) => request.post('/proxy/fetch', data)

// 从 KV 读取快照正文（渲染 iframe srcdoc / 源码展示）
export const getSnapshot = (key) => request.get(`/proxy/snap/${key}`)

// 快照历史列表（KV metadata，不含正文）
export const getSnapshotHistory = () => request.get('/proxy/history')

// 删除快照
export const deleteSnapshot = (key) => request.delete(`/proxy/snap/${key}`)
