<script setup>
// 笔记功能 —— 左侧目录树（Sealos 对象存储懒加载），右侧 md-editor-v3 编辑/保存
//
// 存储：bucket 已开放读写 + CORS，前端直连 S3 兼容 API（list/GET/PUT/DELETE），
// 不经过后端。目录 = 以 / 结尾的 key 前缀；新建目录 = PUT 目录占位对象。
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { listNotes, readNote, saveNote, createNote, deleteNote, deleteNoteDir } from '@/api/notes'

const treeRef = ref(null)
const treeKey = ref(0) // 树整体重建的 key（新建/删除后刷新）
const selected = ref(null) // 当前选中的树节点 {key, name, isDir}
const current = ref(null) // 当前打开的文件 key
const content = ref('')
const savedContent = ref('') // 上次保存的内容，用于脏检查
const loading = ref(false)
const saving = ref(false)
const expandedKeys = ref([]) // 记住展开状态，重建树时恢复

const dirty = computed(() => current.value && content.value !== savedContent.value)

// ---------- 树懒加载 ----------

async function loadNode(node, resolve) {
  const prefix = node.level === 0 ? '' : node.data.key
  try {
    const children = (await listNotes(prefix)).map((n) => ({ ...n, isLeaf: !n.isDir }))
    resolve(children)
  } catch (e) {
    ElMessage.error(e.message)
    resolve([])
  }
}

function onNodeClick(data) {
  selected.value = data
  if (!data.isDir) openFile(data.key)
}

function onNodeExpand(data) {
  if (!expandedKeys.value.includes(data.key)) expandedKeys.value.push(data.key)
}

function onNodeCollapse(data) {
  expandedKeys.value = expandedKeys.value.filter((k) => k !== data.key)
}

// 选中项所在目录（新建操作的目标目录）
function targetDir() {
  if (!selected.value) return ''
  return selected.value.isDir
    ? selected.value.key
    : selected.value.key.slice(0, selected.value.key.lastIndexOf('/') + 1)
}

function refreshTree() {
  treeKey.value++
}

// ---------- 文件编辑 ----------

async function openFile(key) {
  // 有未保存修改时先确认
  if (dirty.value) {
    try {
      await ElMessageBox.confirm('当前笔记有未保存的修改，切换后将丢失，继续吗？', '未保存的修改', {
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
    content.value = await readNote(key)
    savedContent.value = content.value
    current.value = key
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
    await saveNote(current.value, content.value)
    savedContent.value = content.value
    ElMessage.success('已保存到对象存储')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

// ---------- 新建 / 删除 ----------

async function createFile() {
  const { value } = await ElMessageBox.prompt('新笔记文件名（在当前选中目录下创建）', '新建笔记', {
    inputPlaceholder: '例如：读书笔记.md',
    inputPattern: /^[^/]+\.md$/,
    inputErrorMessage: '文件名不能为空且以 .md 结尾（不能含 /）'
  })
  const name = value.trim()
  const prefix = targetDir()
  const key = prefix + name
  try {
    await createNote(key, `# ${name.replace(/\.md$/, '')}\n\n`)
    refreshTree()
    expandedKeys.value.push(prefix)
    openFile(key)
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function createDir() {
  const { value } = await ElMessageBox.prompt('新文件夹名称（在当前选中目录下创建）', '新建文件夹', {
    inputPlaceholder: '例如：工作',
    inputPattern: /^[^/]+$/,
    inputErrorMessage: '名称不能为空且不能含 /'
  })
  const name = value.trim()
  const prefix = targetDir()
  try {
    await createNote(prefix + name + '/', '')
    refreshTree()
    expandedKeys.value.push(prefix)
    ElMessage.success('文件夹已创建')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function remove() {
  if (!selected.value) return
  const node = selected.value
  const isDir = node.isDir
  const desc = isDir ? `文件夹「${node.name}」及其全部内容` : `「${node.name}」`
  try {
    await ElMessageBox.confirm(`确定删除${desc}吗？对象存储中不可恢复！`, '删除确认', {
      type: 'error',
      confirmButtonText: '永久删除'
    })
  } catch {
    return
  }
  try {
    if (isDir) await deleteNoteDir(node.key)
    else await deleteNote(node.key)
    if (current.value === node.key) {
      current.value = null
      content.value = ''
      savedContent.value = ''
    }
    selected.value = null
    refreshTree()
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

// 编辑器内 Ctrl/Cmd+S 快捷保存
function onEditorSave() {
  save()
}
</script>

<template>
  <div class="notes-page">
    <!-- 左侧：目录树 -->
    <div class="side">
      <div class="side-toolbar">
        <el-tooltip content="新建笔记" placement="top">
          <el-button size="small" :icon="'Document'" circle @click="createFile" />
        </el-tooltip>
        <el-tooltip content="新建文件夹" placement="top">
          <el-button size="small" :icon="'FolderAdd'" circle @click="createDir" />
        </el-tooltip>
        <el-tooltip content="删除选中" placement="top">
          <el-button size="small" type="danger" plain :icon="'Delete'" circle :disabled="!selected" @click="remove" />
        </el-tooltip>
        <el-tooltip content="刷新" placement="top">
          <el-button size="small" :icon="'Refresh'" circle class="refresh" @click="refreshTree" />
        </el-tooltip>
      </div>
      <el-scrollbar class="tree-scroll">
        <el-tree
          :key="treeKey"
          ref="treeRef"
          v-model:expanded-keys="expandedKeys"
          node-key="key"
          lazy
          :load="loadNode"
          :props="{ label: 'name', children: 'children', isLeaf: 'isLeaf' }"
          highlight-current
          :expand-on-click-node="true"
          @node-click="onNodeClick"
          @node-expand="onNodeExpand"
          @node-collapse="onNodeCollapse"
        >
          <template #default="{ data }">
            <span class="tree-node" :class="{ active: current === data.key }">
              <span class="icon">{{ data.isDir ? '📁' : '📄' }}</span>
              <span class="label">{{ data.name }}</span>
            </span>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>

    <!-- 右侧：编辑器 -->
    <div class="editor-wrap">
      <div v-if="current" class="editor-bar">
        <span class="file-path" :title="current">{{ current }}</span>
        <span v-if="dirty" class="dirty">● 未保存</span>
        <span class="spacer" />
        <el-button type="primary" size="small" :loading="saving" :disabled="!dirty" @click="save">
          保存
        </el-button>
      </div>
      <div v-if="current" v-loading="loading" class="editor-body">
        <MdEditor
          v-model="content"
          :toolbars="[
            'bold', 'underline', 'italic', 'strikeThrough', '-',
            'title', 'sub', 'sup', 'quote', 'unorderedList', 'orderedList', '-',
            'codeRow', 'code', 'link', 'image', 'table', '-',
            'revoke', 'next', 'save', '-', 'pageFullscreen', 'preview'
          ]"
          :style="{ height: '100%' }"
          @on-save="onEditorSave"
        />
      </div>

      <!-- 未打开文件 -->
      <div v-else class="welcome">
        <div class="welcome-icon">📝</div>
        <h3>笔记</h3>
        <p class="welcome-tip">
          笔记保存在 Sealos 对象存储中，左侧选择或新建笔记开始编辑；
          <br />支持 Markdown 双栏实时预览，Ctrl/⌘+S 快捷保存。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notes-page {
  display: flex;
  gap: 12px;
  height: calc(100vh - 140px);
}

/* ---------- 左侧树 ---------- */
.side {
  width: 280px;
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

.tree-scroll {
  flex: 1;
  padding: 6px;
}

.tree-node {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.tree-node .icon {
  font-size: 14px;
}

/* ---------- 右侧编辑器 ---------- */
.editor-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.editor-bar {
  display: flex;
  align-items: center;
  gap: 10px;
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
  max-width: 60%;
}

.dirty {
  color: #e6a23c;
  font-size: 12px;
}

.spacer {
  flex: 1;
}

.editor-body {
  flex: 1;
  min-height: 0;
}

/* ---------- 欢迎页 ---------- */
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

/* 移动端堆叠 */
@media (max-width: 768px) {
  .notes-page {
    flex-direction: column;
    height: auto;
  }

  .side {
    width: 100%;
    max-height: 220px;
  }

  .editor-wrap {
    min-height: 60vh;
  }
}
</style>
