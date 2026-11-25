// Mermaid 图接口 —— Sealos 对象存储（复用笔记的直连通道）
//
// 存储约定：bucket 下 mermaid/ 目录，文件为 Mermaid DSL 纯文本（.mmd / .mermaid）。
// 编辑/预览全在前端（mermaid.js 渲染 SVG），后端零改动。
import { listNotes, readNote, saveNote } from './notes'

const DIR = 'mermaid/'

export const listMermaids = () => listNotes(DIR)
export const readMermaid = (key) => readNote(key)
export const saveMermaid = (key, text) => saveNote(key, text)
export const uploadMermaid = (fileName, text) => saveNote(DIR + fileName, text)

export const isMermaidFile = (name) => /\.(mmd|mermaid)$/i.test(name)

export const emptyMmd = (name) =>
  `%% ${name}\nflowchart LR\n    A[开始] --> B{判断}\n    B -->|是| C[处理]\n    B -->|否| D[结束]\n    C --> D\n`
