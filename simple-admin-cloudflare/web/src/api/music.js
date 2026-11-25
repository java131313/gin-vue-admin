// 音乐播放接口 —— Sealos 对象存储音频文件（只读 + 播放列表）
//
// 复用笔记的直连通道列目录；音频内容 fetch 成 Blob objectURL 喂 <audio>
// （与相册同方案，绕开 octet-stream + nosniff 的媒体加载封锁）。
// 大文件（flac 等）会全量下载后播放——个人音乐库可接受。
import { listNotes } from './notes'

const BASE = 'https://objectstorageapi.bja.sealos.run/mpzfivcp-watchwonderful/'

const MIME = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  opus: 'audio/opus',
  wma: 'audio/x-ms-wma' // 浏览器不支持解码，仅列出提示
}

const AUDIO_EXT = new RegExp('\\.(' + Object.keys(MIME).join('|') + ')$', 'i')

export const isAudioFile = (name) => AUDIO_EXT.test(name)

/** 浏览器可播放（wma 不行） */
export const isPlayable = (name) => !/\.wma$/i.test(name)

export const audioUrl = (key) => BASE + encodeURI(key)

export const audioMime = (name) => MIME[(name.split('.').pop() || '').toLowerCase()] || 'audio/mpeg'

/** fetch 音频并转 Blob objectURL；调用方负责 revokeObjectURL */
export async function fetchAudioBlobUrl(key) {
  const res = await fetch(audioUrl(key))
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const buf = await res.arrayBuffer()
  return URL.createObjectURL(new Blob([buf], { type: audioMime(key) }))
}

/** 列出某前缀下的直接子节点 */
export const listMusic = (prefix = '') => listNotes(prefix)
