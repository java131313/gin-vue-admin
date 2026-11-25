<script setup>
// Mermaid Live Editor —— 编辑/预览 Sealos 对象存储中的 .mmd / .mermaid 文件
//
// 左侧 Mermaid DSL 代码编辑（等宽字体），右侧实时渲染 SVG 预览（500ms 防抖）；
// 文件存对象存储 mermaid/ 目录（纯文本，可与任何 Mermaid 工具互换）。
// 语法错误时预览区保留上次成功结果并显示错误提示。
import { ref, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import mermaid from 'mermaid'
import {
  listMermaids,
  readMermaid,
  saveMermaid,
  uploadMermaid,
  isMermaidFile,
  emptyMmd
} from '@/api/mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })

const files = ref([])
const current = ref(null) // 当前打开的 key
const code = ref('') // 编辑器内容
const savedCode = ref('') // 上次保存的内容（脏检查）
const svg = ref('') // 预览 SVG
const renderError = ref('') // 语法错误信息
const loading = ref(false)
const saving = ref(false)
const fileInputRef = ref(null)

const dirty = () => current.value && code.value !== savedCode.value

// ---------- 实时预览（防抖） ----------
let timer = null
watch(code, () => {
  clearTimeout(timer)
  timer = setTimeout(renderPreview, 500)
})

let renderSeq = 0
async function renderPreview() {
  const text = code.value.trim()
  if (!text) {
    svg.value = ''
    renderError.value = ''
    return
  }
  const seq = ++renderSeq
  const id = 'mmd-' + seq + '-' + Date.now()
  try {
    const { svg: s } = await mermaid.render(id, text)
    if (seq !== renderSeq) return // 已有更新的渲染
    svg.value = s
    renderError.value = ''
  } catch (e) {
    if (seq !== renderSeq) return
    renderError.value = (e?.message || '语法错误').split('\n')[0].slice(0, 200)
    // mermaid 渲染失败可能在 body 留临时元素，清掉
    document.getElementById(id)?.remove()
    document.getElementById('d' + id)?.remove()
  }
}

// ---------- 文件操作 ----------
async function loadFiles() {
  loading.value = true
  try {
    const list = await listMermaids()
    files.value = list.filter((f) => !f.isDir && isMermaidFile(f.name))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function openFile(row) {
  if (dirty()) {
    try {
      await ElMessageBox.confirm('当前文件有未保存修改，切换后将丢失，继续吗？', '未保存', {
        type: 'warning',
        confirmButtonText: '放弃修改',
        cancelButtonText: '再想想'
      })
    } catch {
      return
    }
  }
  loading.value = true
  try {
    const text = await readMermaid(row.key)
    code.value = text
    savedCode.value = text
    current.value = row.key
    renderPreview()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!current.value || saving.value) return
  saving.value = true
  try {
    await saveMermaid(current.value, code.value)
    savedCode.value = code.value
    ElMessage.success('已保存到对象存储')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

function download() {
  if (!current.value) return
  const blob = new Blob([code.value], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = current.value.split('/').pop()
  a.click()
  URL.revokeObjectURL(a.href)
}

// 下载渲染好的 SVG 矢量图
function downloadSvg() {
  if (!svg.value) {
    ElMessage.warning('暂无渲染结果')
    return
  }
  const blob = new Blob([svg.value], { type: 'image/svg+xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = (current.value?.split('/').pop() || 'diagram').replace(/\.(mmd|mermaid)$/i, '') + '.svg'
  a.click()
  URL.revokeObjectURL(a.href)
}

async function create() {
  const { value } = await ElMessageBox.prompt('新文件名称（存入 mermaid/ 目录）', '新建 Mermaid 图', {
    inputPlaceholder: '例如：登录流程',
    inputPattern: /^[^/]+$/,
    inputErrorMessage: '名称不能为空且不能含 /'
  })
  const name = value.trim().replace(/\.(mmd|mermaid)$/i, '')
  const key = 'mermaid/' + name + '.mmd'
  await saveMermaid(key, emptyMmd(name))
  await loadFiles()
  const row = files.value.find((f) => f.key === key)
  if (row) openFile(row)
}

function triggerUpload() {
  fileInputRef.value?.click()
}

async function onUpload(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!isMermaidFile(file.name)) {
    ElMessage.warning('只支持 .mmd / .mermaid 文件')
    return
  }
  try {
    const text = await file.text()
    await uploadMermaid(file.name, text)
    ElMessage.success('已上传到 mermaid/ 目录')
    loadFiles()
  } catch (err) {
    ElMessage.error('上传失败：' + err.message)
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」吗？存储中不可恢复！`, '删除确认', {
      type: 'error',
      confirmButtonText: '永久删除'
    })
  } catch {
    return
  }
  const { deleteNote } = await import('@/api/notes')
  await deleteNote(row.key)
  if (current.value === row.key) {
    current.value = null
    code.value = ''
    savedCode.value = ''
    svg.value = ''
  }
  loadFiles()
  ElMessage.success('已删除')
}

// Ctrl/⌘+S 快捷保存
function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    save()
  }
}

onMounted(loadFiles)
</script>

<template>
  <div class="mmd-page" @keydown="onKeydown">
    <!-- 左侧：文件列表 -->
    <div class="side">
      <div class="side-toolbar">
        <el-tooltip content="新建图" placement="top">
          <el-button size="small" :icon="'Plus'" circle @click="create" />
        </el-tooltip>
        <el-tooltip content="上传 .mmd/.mermaid" placement="top">
          <el-button size="small" :icon="'Upload'" circle @click="triggerUpload" />
        </el-tooltip>
        <el-tooltip content="刷新" placement="top">
          <el-button size="small" :icon="'Refresh'" circle class="refresh" @click="loadFiles" />
        </el-tooltip>
      </div>
      <input ref="fileInputRef" type="file" accept=".mmd,.mermaid" style="display: none" @change="onUpload" />
      <el-scrollbar v-loading="loading" class="side-list">
        <div
          v-for="row in files"
          :key="row.key"
          class="side-item"
          :class="{ active: current === row.key }"
          @click="openFile(row)"
        >
          <span class="icon">📊</span>
          <span class="name">{{ row.name }}</span>
          <el-button link type="danger" size="small" class="del" @click.stop="remove(row)">删</el-button>
        </div>
        <el-empty v-if="!loading && files.length === 0" description="还没有图，点 + 新建或上传" :image-size="60" />
      </el-scrollbar>
    </div>

    <!-- 右侧：编辑 + 预览 -->
    <div class="main">
      <div v-if="current" class="toolbar">
        <span class="file-path" :title="current">{{ current }}</span>
        <span v-if="dirty()" class="dirty">● 未保存</span>
        <span class="spacer" />
        <el-button size="small" @click="download">下载源码</el-button>
        <el-button size="small" @click="downloadSvg">下载 SVG</el-button>
        <el-button type="primary" size="small" :loading="saving" :disabled="!dirty()" @click="save">
          保存
        </el-button>
      </div>

      <div v-if="current" class="editor-split">
        <!-- 代码编辑 -->
        <div class="code-pane">
          <textarea
            v-model="code"
            class="code-input"
            spellcheck="false"
            placeholder="输入 Mermaid 语法，如：&#10;flowchart LR&#10;    A --> B"
          />
        </div>
        <!-- 实时预览 -->
        <div class="preview-pane">
          <div v-if="renderError" class="render-error">⚠ {{ renderError }}</div>
          <div class="preview-canvas" v-html="svg" />
          <el-empty v-if="!svg && !renderError" description="输入 Mermaid 语法后实时预览" :image-size="80" />
        </div>
      </div>

      <div v-if="!current" class="welcome">
        <div class="welcome-icon">📊</div>
        <h3>Mermaid Live Editor</h3>
        <p class="welcome-tip">
          流程图 / 时序图 / 甘特图…… 用文本画图表；文件存对象存储 mermaid/ 目录，
          <br />左侧写语法右侧实时出图，支持上传下载与 SVG 导出。Ctrl/⌘+S 保存。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mmd-page {
  display: flex;
  gap: 12px;
  height: calc(100vh - 140px);
}

/* ---------- 左侧文件列表 ---------- */
.side {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.side-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid #ebeef5;
}

.side-toolbar .refresh {
  margin-left: auto;
}

.side-list {
  flex: 1;
  padding: 8px;
  min-height: 0;
}

.side-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  font-size: 13px;
}

.side-item:hover {
  background: #f5f7fa;
}

.side-item.active {
  background: #ecf5ff;
}

.side-item .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

.side-item .del {
  opacity: 0;
}

.side-item:hover .del {
  opacity: 1;
}

/* ---------- 右侧编辑预览 ---------- */
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

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #ebeef5;
}

.file-path {
  font-size: 13px;
  color: #606266;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 36%;
}

.dirty {
  color: #e6a23c;
  font-size: 12px;
}

.spacer {
  flex: 1;
}

.editor-split {
  flex: 1;
  display: flex;
  min-height: 0;
}

.code-pane {
  width: 42%;
  border-right: 1px solid #ebeef5;
  display: flex;
}

.code-input {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 14px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
  background: #fafbfc;
}

.preview-pane {
  flex: 1;
  overflow: auto;
  padding: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
}

.preview-canvas {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.preview-canvas :deep(svg) {
  max-width: 100%;
  height: auto;
}

.render-error {
  background: #fef0f0;
  color: #f56c6c;
  font-size: 12.5px;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 10px;
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
  .mmd-page {
    flex-direction: column;
    height: auto;
  }

  .side {
    width: 100%;
    max-height: 180px;
  }

  .editor-split {
    flex-direction: column;
    min-height: 70vh;
  }

  .code-pane {
    width: 100%;
    min-height: 200px;
    border-right: none;
    border-bottom: 1px solid #ebeef5;
  }
}
</style>
