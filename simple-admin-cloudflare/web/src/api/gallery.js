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

/** 列出某前缀下的直接子节点（含目录和图片，调用方自行过滤） */
export const listGallery = (prefix = '') => listNotes(prefix)
