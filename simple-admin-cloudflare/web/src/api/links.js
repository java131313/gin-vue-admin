// 链接管家接口 —— 网址收藏，数据存 Sealos 对象存储（links/links.json）
//
// 与笔记/导图同一架构：整个收藏集是一个 JSON 文件，读-改-写整体保存，
// 双端（本地/CF）共享一份数据。favicon 走 Google s2 服务，失败回退首字母图标。
import { readNote, saveNote } from './notes'

const FILE = 'links/links.json'

export const newId = () => 'lk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/** 读取全部链接（文件不存在/损坏时返回空数组） */
export async function loadLinks() {
  try {
    const text = await readNote(FILE)
    const j = JSON.parse(text)
    return Array.isArray(j.links) ? j.links : []
  } catch {
    return [] // 首次使用文件不存在
  }
}

/** 整体保存 */
export async function saveLinks(links) {
  await saveNote(FILE, JSON.stringify({ links }, null, 2))
}

/** 从 URL 提取域名（favicon/展示用） */
export function domainOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/** favicon 地址（Google s2；加载失败由调用方回退字母图标） */
export const faviconUrl = (url) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainOf(url))}&sz=64`
