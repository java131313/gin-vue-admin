// 相册接口 —— Sealos 对象存储图片浏览（只读）
//
// 复用笔记的直连通道：目录树导航 + 按扩展名过滤图片文件。
// 图片 URL 公开可读，<img> 直引；content-disposition: attachment 只影响
// 导航下载，不影响 <img> 渲染（正好让「下载」零成本实现）。
import { listNotes } from './notes'

const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)$/i

export const isImageFile = (name) => IMG_EXT.test(name)

const BASE = 'https://objectstorageapi.bja.sealos.run/mpzfivcp-watchwonderful/'

/** 图片的直链 URL（key 含中文/空格需编码，保留 / 分隔） */
export const imageUrl = (key) => BASE + encodeURI(key)

/** 按扩展名推断 MIME（Sealos 统一返回 octet-stream + nosniff，需前端自建 Blob） */
const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon'
}
export const mimeOf = (name) => MIME[(name.split('.').pop() || '').toLowerCase()] || 'image/png'

/**
 * fetch 图片内容并转为 Blob objectURL（绕开 octet-stream + nosniff 的渲染封锁）。
 * 调用方负责在组件卸载/切换目录时 revokeObjectURL。
 */
export async function fetchImageBlobUrl(key) {
  const res = await fetch(imageUrl(key))
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const buf = await res.arrayBuffer()
  return URL.createObjectURL(new Blob([buf], { type: mimeOf(key) }))
}

/** 列出某前缀下的直接子节点（含目录和图片，调用方自行过滤） */
export const listGallery = (prefix = '') => listNotes(prefix)
