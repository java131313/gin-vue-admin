// 文档查看接口 —— Sealos 对象存储的 doc/excel/ppt/pdf 文本查看
//
// 复用笔记的直连通道列目录；文档内容 fetch 成 ArrayBuffer 后按类型解析：
//   pdf        → Blob objectURL 喂 iframe（浏览器原生查看器）
//   docx       → mammoth.convertToHtml（文本+基本格式）
//   xlsx/xls   → SheetJS 转 HTML 表格（多 sheet）
//   pptx       → JSZip 解包提取每页 <a:t> 文本（文本级分页阅读）
//   doc/ppt    → 老二进制格式纯前端无可靠解析器，提示下载
import { listNotes } from './notes'

const BASE = 'https://objectstorageapi.bja.sealos.run/mpzfivcp-watchwonderful/'

export const DOC_TYPES = {
  pdf: { exts: ['pdf'], label: 'PDF', icon: '📕' },
  docx: { exts: ['docx'], label: 'Word', icon: '📘' },
  doc: { exts: ['doc'], label: 'Word(旧)', icon: '📘' },
  xlsx: { exts: ['xlsx', 'xls'], label: 'Excel', icon: '📗' },
  pptx: { exts: ['pptx'], label: 'PPT', icon: '📙' },
  ppt: { exts: ['ppt'], label: 'PPT(旧)', icon: '📙' }
}

const EXT_MAP = {}
for (const [type, cfg] of Object.entries(DOC_TYPES)) {
  for (const e of cfg.exts) EXT_MAP[e] = type
}

/** 文件扩展名 → 文档类型（不支持返回 null） */
export function docType(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  return EXT_MAP[ext] || null
}

export const docIcon = (name) => DOC_TYPES[docType(name)]?.icon || '📄'

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}

export const docUrl = (key) => BASE + encodeURI(key)

/** 拉取文档内容（ArrayBuffer）；PDF 用 Blob objectURL */
export async function fetchDocBuffer(key) {
  const res = await fetch(docUrl(key))
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.arrayBuffer()
}

export async function fetchPdfBlobUrl(key) {
  const buf = await fetchDocBuffer(key)
  return URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
}

/** DOCX → HTML（mammoth 懒加载，不进首屏包） */
export async function docxToHtml(arrayBuffer) {
  const mammoth = await import('mammoth')
  const result = await mammoth.convertToHtml({ arrayBuffer })
  return result.value // HTML 字符串（标题/段落/表格/列表）
}

/** XLSX/XLS → [{name, html}]（SheetJS 懒加载；sheet_to_html 直接出表格） */
export async function xlsxToSheets(arrayBuffer) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  return wb.SheetNames.map((name) => ({
    name,
    html: XLSX.utils.sheet_to_html(wb.Sheets[name], { header: '', footer: '' })
  }))
}

/** PPTX → [{index, texts[]}]（JSZip 解包，提取每页 slide 的 <a:t> 文本） */
export async function pptxToSlides(arrayBuffer) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(arrayBuffer)
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
  const slides = []
  for (let i = 0; i < slideNames.length; i++) {
    const xml = await zip.file(slideNames[i]).async('text')
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    // <a:t> 带命名空间，用 getElementsByTagNameNS 通配
    const texts = [...doc.getElementsByTagNameNS('*', 't')]
      .map((t) => t.textContent.trim())
      .filter(Boolean)
    slides.push({ index: i + 1, texts })
  }
  return slides
}

/** 列出某前缀下的直接子节点 */
export const listDocs = (prefix = '') => listNotes(prefix)
