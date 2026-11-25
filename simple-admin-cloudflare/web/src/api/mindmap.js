// 思维导图接口 —— Sealos 对象存储（复用笔记的直连通道）+ FreeMind (.mm) 格式
//
// 存储约定：bucket 下 mindmap/ 目录，文件为 FreeMind 标准 XML（.mm）。
// 编辑器 jsMind 0.9 内置 freemind 格式双向解析（load/get_data），
// 不需要手写 XML 转换：show({meta, format:'freemind', data: xml}) 加载，
// getData().data 即序列化后的 XML。
import { listNotes, readNote, saveNote } from './notes'

const DIR = 'mindmap/'

export const listMindmaps = () => listNotes(DIR)
export const readMindmap = (key) => readNote(key)
export const saveMindmap = (key, xml) => saveNote(key, xml)
export const uploadMindmap = (fileName, xml) => saveNote(DIR + fileName, xml)

export const emptyMM = (name) =>
  `<map version="1.0.1"><node TEXT="${escapeXml(name)}"><node TEXT="分支 1"/><node TEXT="分支 2"/></node></map>`

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 校验 FreeMind XML 结构（上传前检查） */
export function isValidMM(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return !doc.querySelector('parsererror') && !!doc.querySelector('map > node')
}

/** jsMind show/getData 用的包装格式；给缺 ID 的 node 自动补 ID（jsMind 加载强制要求） */
export function mmDoc(xml, name = '') {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  let seq = 0
  const stamp = Date.now().toString(36)
  doc.querySelectorAll('node').forEach((n) => {
    if (!n.getAttribute('ID')) n.setAttribute('ID', 'mm-' + stamp + '-' + ++seq)
  })
  const serialized = new XMLSerializer().serializeToString(doc)
  return { meta: { name, author: 'simple-admin', version: '1.0' }, format: 'freemind', data: serialized }
}
