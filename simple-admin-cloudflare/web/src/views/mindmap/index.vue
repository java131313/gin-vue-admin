<script setup>
// 思维导图 —— 读取/编辑 Sealos 对象存储中的 FreeMind (.mm) 文件
//
// 编辑用 jsMind（双击改文本、拖拽移动、按钮增删节点），保存时序列化回
// FreeMind 标准 XML 写回对象存储；支持上传本地 .mm 和下载当前导图。
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import jsMind from 'jsmind'
import 'jsmind/style/jsmind.css'
import 'jsmind/draggable-node' // 拖拽移动节点插件（导入即注册；包的 exports 提供此别名）
import {
  listMindmaps,
  readMindmap,
  saveMindmap,
  uploadMindmap,
  emptyMM,
  isValidMM,
  mmDoc
} from '@/api/mindmap'

const files = ref([]) // mindmap/ 目录下的 .mm 文件
const current = ref(null) // 当前打开的 key
const loading = ref(false)
const saving = ref(false)
const dirty = ref(false)
const containerRef = ref(null)
const fileInputRef = ref(null)
let jm = null // jsMind 实例

// 初始化 jsMind 画布
function initMind(doc) {
  if (jm) {
    jm.show(doc) // 已有实例：换数据
    return
  }
  jm = new jsMind({
    container: containerRef.value,
    theme: 'primary',
    mode: 'side', // 双侧布局，贴近 FreeMind 风格
    support_html: false,
    editable: true // 双击编辑文本
  })
  jm.show(doc)
}

async function loadFiles() {
  loading.value = true
  try {
    const list = await listMindmaps()
    files.value = list.filter((f) => !f.isDir && f.name.endsWith('.mm'))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

// 当前选中节点 id（增删改围绕它操作）
function selectedNode() {
  const n = jm?.get_selected_node()
  if (!n) {
    ElMessage.warning('先点击选中一个节点')
    return null
  }
  return n
}

// 打开文件
async function openFile(row) {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm('当前导图有未保存修改，切换后将丢失，继续吗？', '未保存', {
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
    const xml = await readMindmap(row.key)
    current.value = row.key // 先让画布可见（v-show）
    dirty.value = false
    await nextTick() // 等 DOM 显示后再初始化 jsMind，否则 0 尺寸容器渲染不可见
    initMind(mmDoc(xml, row.name))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

// 节点操作
// 生成节点 id（jsmind 的 id 生成器是模块私有的，自行实现）
const newId = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

function addNode(sibling = false) {
  if (!current.value) return
  const n = selectedNode()
  if (!n) return
  // add_node(父节点对象, 新节点id, 文本)；同级时父节点取选中节点的 parent
  const parent = sibling && n.parent ? n.parent : n
  jm.add_node(parent, newId(), '新节点')
  dirty.value = true
}

function removeNode() {
  if (!current.value) return
  const n = selectedNode()
  if (!n) return
  if (n.isroot) {
    ElMessage.warning('根节点不能删除')
    return
  }
  jm.remove_node(n.id)
  dirty.value = true
}

// 编辑/拖拽后标记脏数据（jsMind 事件）
function onMindEdit() {
  dirty.value = true
}

// 保存：jsMind 树 → FreeMind XML → PUT 回存储
async function save() {
  if (!current.value || !jm) return
  saving.value = true
  try {
    // getData().data 即序列化后的 FreeMind XML（jsmind 内置 freemind 格式双向）
    await saveMindmap(current.value, jm.get_data('freemind').data)
    dirty.value = false
    ElMessage.success('已保存到对象存储')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

// 下载当前导图为 .mm 文件
function download() {
  if (!jm || !current.value) return
  const blob = new Blob([jm.get_data('freemind').data], { type: 'application/xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = current.value.split('/').pop()
  a.click()
  URL.revokeObjectURL(a.href)
}

// 新建空白导图
async function create() {
  const { value } = await ElMessageBox.prompt('新导图名称（存入 mindmap/ 目录）', '新建思维导图', {
    inputPlaceholder: '例如：学习计划',
    inputPattern: /^[^/]+$/,
    inputErrorMessage: '名称不能为空且不能含 /'
  })
  const name = value.trim()
  const key = 'mindmap/' + name + '.mm'
  await saveMindmap(key, emptyMM(name))
  await loadFiles()
  await nextTick()
  const row = files.value.find((f) => f.key === key)
  if (row) openFile(row)
}

// 上传本地 .mm 文件
function triggerUpload() {
  fileInputRef.value?.click()
}

async function onUpload(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // 允许重复选同一文件
  if (!file) return
  if (!file.name.endsWith('.mm')) {
    ElMessage.warning('只支持 FreeMind .mm 文件')
    return
  }
  try {
    const text = await file.text()
    if (!isValidMM(text)) throw new Error('不是有效的 FreeMind .mm 文件')
    await uploadMindmap(file.name, text)
    ElMessage.success('已上传到 mindmap/ 目录')
    loadFiles()
  } catch (err) {
    ElMessage.error('上传失败：' + err.message)
  }
}

// 删除导图
async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」吗？存储中不可恢复！`, '删除确认', {
      type: 'error',
      confirmButtonText: '永久删除'
    })
  } catch {
    return
  }
  // 复用笔记的删除接口
  const { deleteNote } = await import('@/api/notes')
  await deleteNote(row.key)
  if (current.value === row.key) {
    current.value = null
    jm = null
    containerRef.value.innerHTML = ''
  }
  loadFiles()
  ElMessage.success('已删除')
}

onMounted(loadFiles)
</script>

<template>
  <div class="mm-page">
    <!-- 左侧：导图文件列表 -->
    <div class="side">
      <div class="side-toolbar">
        <el-tooltip content="新建导图" placement="top">
          <el-button size="small" :icon="'Plus'" circle @click="create" />
        </el-tooltip>
        <el-tooltip content="上传 .mm 文件" placement="top">
          <el-button size="small" :icon="'Upload'" circle @click="triggerUpload" />
        </el-tooltip>
        <el-tooltip content="刷新" placement="top">
          <el-button size="small" :icon="'Refresh'" circle class="refresh" @click="loadFiles" />
        </el-tooltip>
      </div>
      <input ref="fileInputRef" type="file" accept=".mm" style="display: none" @change="onUpload" />
      <el-scrollbar v-loading="loading" class="side-list">
        <div
          v-for="row in files"
          :key="row.key"
          class="side-item"
          :class="{ active: current === row.key }"
          @click="openFile(row)"
        >
          <span class="icon">🧠</span>
          <span class="name">{{ row.name }}</span>
          <el-button link type="danger" size="small" class="del" @click.stop="remove(row)">删</el-button>
        </div>
        <el-empty v-if="!loading && files.length === 0" description="还没有导图，点 + 新建或上传" :image-size="60" />
      </el-scrollbar>
    </div>

    <!-- 右侧：画布 -->
    <div class="main">
      <div v-if="current" class="toolbar">
        <span class="file-path" :title="current">{{ current }}</span>
        <span v-if="dirty" class="dirty">● 未保存</span>
        <span class="spacer" />
        <el-button size="small" @click="addNode(false)">添加子节点</el-button>
        <el-button size="small" @click="addNode(true)">添加同级</el-button>
        <el-button size="small" type="danger" plain @click="removeNode">删除节点</el-button>
        <el-button size="small" @click="download">下载</el-button>
        <el-button type="primary" size="small" :loading="saving" :disabled="!dirty" @click="save">
          保存
        </el-button>
      </div>
      <div v-show="current" ref="containerRef" class="canvas" @dblclick="onMindEdit" />

      <div v-if="!current" class="welcome">
        <div class="welcome-icon">🧠</div>
        <h3>思维导图</h3>
        <p class="welcome-tip">
          导图保存在 Sealos 对象存储的 mindmap/ 目录（FreeMind .mm 标准格式，可与桌面
          FreeMind/XMind 互换）；<br />双击节点改文本，拖拽移动节点，支持上传与下载。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mm-page {
  display: flex;
  gap: 12px;
  height: calc(100vh - 140px);
}

/* ---------- 左侧文件列表 ---------- */
.side {
  width: 260px;
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

/* ---------- 右侧画布 ---------- */
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
  max-width: 32%;
}

.dirty {
  color: #e6a23c;
  font-size: 12px;
}

.spacer {
  flex: 1;
}

.canvas {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #fafafa;
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
  .mm-page {
    flex-direction: column;
    height: auto;
  }

  .side {
    width: 100%;
    max-height: 200px;
  }

  .canvas {
    min-height: 60vh;
  }
}
</style>
