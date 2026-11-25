<script setup>
// 文档查看器 —— Sealos 对象存储的 doc/excel/ppt/pdf 文本查看（只读）
//
// 左侧目录树 + 文件列表（类型图标区分），右侧按类型渲染：
//   PDF  → iframe（浏览器原生查看器，blob objectURL）
//   DOCX → mammoth 转 HTML（文章样式）
//   XLSX → SheetJS 转表格（sheet 页签切换）
//   PPTX → JSZip 提取每页文本（分页卡片）
// 老二进制 .doc/.ppt 提示下载。解析库全部动态 import，不进首屏包。
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listDocs,
  docType,
  docIcon,
  docUrl,
  fetchDocBuffer,
  fetchPdfBlobUrl,
  docxToHtml,
  xlsxToSheets,
  pptxToSlides
} from '@/api/docs'

const currentPrefix = ref('')
const currentName = ref('全部文档')
const files = ref([]) // 当前目录文档 [{key, name, type}]
const treeKey = ref(0)
const expandedKeys = ref([])
const loading = ref(false)

// 查看器状态
const viewing = ref(null) // 当前文档 {key, name, type}
const viewLoading = ref(false)
const pdfUrl = ref('') // PDF blob objectURL
const docHtml = ref('') // DOCX HTML
const sheets = ref([]) // XLSX [{name, html}]
const activeSheet = ref(0)
const slides = ref([]) // PPTX [{index, texts}]
const viewError = ref('')

// ---------- 目录树 ----------
async function loadNode(node, resolve) {
  const prefix = node.level === 0 ? '' : node.data.key
  try {
    const children = (await listDocs(prefix)).filter((n) => n.isDir).map((n) => ({ ...n, isLeaf: false }))
    resolve(children)
  } catch (e) {
    ElMessage.error(e.message)
    resolve([])
  }
}

function onNodeClick(data) {
  currentPrefix.value = data.key
  currentName.value = data.name
  loadFiles()
}

// ---------- 文件列表 ----------
async function loadFiles() {
  loading.value = true
  try {
    const list = await listDocs(currentPrefix.value)
    files.value = list
      .filter((f) => !f.isDir && docType(f.name))
      .map((f) => ({ key: f.key, name: f.name, type: docType(f.name) }))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

// ---------- 打开查看器 ----------
async function openDoc(file) {
  viewing.value = file
  viewError.value = ''
  docHtml.value = ''
  sheets.value = []
  slides.value = []
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = ''
  }
  // 老二进制：纯前端无可靠解析器
  if (file.type === 'doc' || file.type === 'ppt') {
    viewError.value = `.${file.type} 是老二进制格式，浏览器端无法可靠解析——请下载后用 Office/WPS 打开（新版另存为 .${file.type}x 即可在线查看）`
    return
  }
  viewLoading.value = true
  try {
    if (file.type === 'pdf') {
      pdfUrl.value = await fetchPdfBlobUrl(file.key)
    } else if (file.type === 'docx') {
      docHtml.value = await docxToHtml(await fetchDocBuffer(file.key))
    } else if (file.type === 'xlsx') {
      sheets.value = await xlsxToSheets(await fetchDocBuffer(file.key))
      activeSheet.value = 0
    } else if (file.type === 'pptx') {
      slides.value = await pptxToSlides(await fetchDocBuffer(file.key))
    }
  } catch (e) {
    viewError.value = '解析失败：' + (e?.message || e).toString().slice(0, 150)
  } finally {
    viewLoading.value = false
  }
}

function closeViewer() {
  viewing.value = null
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = ''
  }
}

function download(file) {
  const a = document.createElement('a')
  a.href = docUrl(file.key)
  a.download = file.name
  a.target = '_blank'
  a.click()
}

onMounted(loadFiles)
onBeforeUnmount(() => pdfUrl.value && URL.revokeObjectURL(pdfUrl.value))
</script>

<template>
  <div class="docs-page">
    <!-- 左侧：目录树 -->
    <div class="side">
      <div class="side-head">
        <span class="side-title">文档目录</span>
        <el-button size="small" :icon="'Refresh'" circle @click="treeKey++; loadFiles()" />
      </div>
      <el-scrollbar class="tree-scroll">
        <div
          class="root-node"
          :class="{ active: currentPrefix === '' }"
          @click="currentPrefix = ''; currentName = '全部文档'; loadFiles()"
        >
          🗂️ 全部文档
        </div>
        <el-tree
          :key="treeKey"
          v-model:expanded-keys="expandedKeys"
          node-key="key"
          lazy
          :load="loadNode"
          :props="{ label: 'name', children: 'children', isLeaf: 'isLeaf' }"
          highlight-current
          :expand-on-click-node="true"
          @node-click="onNodeClick"
        >
          <template #default="{ data }">
            <span class="tree-node">📁 {{ data.name }}</span>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>

    <!-- 中间：文件列表 -->
    <div class="list" :class="{ narrow: viewing }">
      <div class="list-head">{{ currentName }} · {{ files.length }} 个文档</div>
      <el-scrollbar v-loading="loading" class="list-scroll">
        <div
          v-for="f in files"
          :key="f.key"
          class="file-item"
          :class="{ active: viewing?.key === f.key }"
          @click="openDoc(f)"
        >
          <span class="f-icon">{{ docIcon(f.name) }}</span>
          <span class="f-name" :title="f.name">{{ f.name }}</span>
          <el-button link size="small" :icon="'Download'" title="下载" @click.stop="download(f)" />
        </div>
        <el-empty v-if="!loading && files.length === 0" description="这个目录没有可查看的文档" :image-size="70" />
      </el-scrollbar>
    </div>

    <!-- 右侧：查看器 -->
    <div v-if="viewing" class="viewer">
      <div class="viewer-head">
        <span class="v-title">{{ docIcon(viewing.name) }} {{ viewing.name }}</span>
        <span class="spacer" />
        <el-button size="small" :icon="'Download'" @click="download(viewing)">下载</el-button>
        <el-button size="small" :icon="'Close'" circle @click="closeViewer" />
      </div>

      <div v-loading="viewLoading" class="viewer-body">
        <div v-if="viewError" class="view-error">{{ viewError }}</div>

        <!-- PDF：浏览器原生查看器 -->
        <iframe v-else-if="viewing.type === 'pdf' && pdfUrl" :src="pdfUrl" class="pdf-frame" />

        <!-- DOCX：mammoth HTML -->
        <div v-else-if="viewing.type === 'docx'" class="doc-html" v-html="docHtml" />

        <!-- XLSX：SheetJS 表格 + sheet 页签 -->
        <div v-else-if="viewing.type === 'xlsx'" class="xlsx-wrap">
          <el-tabs v-if="sheets.length > 1" v-model="activeSheet" class="sheet-tabs">
            <el-tab-pane v-for="(s, i) in sheets" :key="i" :label="s.name" :name="i" />
          </el-tabs>
          <el-scrollbar class="sheet-scroll">
            <div class="sheet-html" v-html="sheets[activeSheet]?.html" />
          </el-scrollbar>
        </div>

        <!-- PPTX：分页文本卡片 -->
        <el-scrollbar v-else-if="viewing.type === 'pptx'" class="slides-scroll">
          <div v-for="s in slides" :key="s.index" class="slide-card">
            <div class="slide-no">第 {{ s.index }} 页</div>
            <div v-for="(t, i) in s.texts" :key="i" class="slide-text">{{ t }}</div>
            <el-empty v-if="!s.texts.length" description="本页无文本" :image-size="40" />
          </div>
          <el-empty v-if="!slides.length && !viewLoading" description="未提取到幻灯片" :image-size="60" />
        </el-scrollbar>
      </div>
    </div>

    <!-- 未打开文档时的欢迎区 -->
    <div v-else class="welcome">
      <div class="welcome-icon">📄</div>
      <h3>文档查看器</h3>
      <p class="welcome-tip">
        在线阅读对象存储中的 PDF / Word(docx) / Excel(xlsx,xls) / PPT(pptx)；
        <br />中间列表点击即开，PDF 用浏览器原生查看器，Office 文档解析为文本/表格。
      </p>
    </div>
  </div>
</template>

<style scoped>
.docs-page {
  display: flex;
  gap: 12px;
  height: calc(100vh - 140px);
}

/* ---------- 左侧目录树 ---------- */
.side {
  width: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #ebeef5;
}

.side-title {
  font-weight: 600;
  font-size: 14px;
}

.tree-scroll {
  flex: 1;
  padding: 6px;
}

.root-node {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 4px;
}

.root-node:hover {
  background: #f5f7fa;
}

.root-node.active {
  background: #ecf5ff;
}

.tree-node {
  font-size: 13px;
}

/* ---------- 中间文件列表 ---------- */
.list {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  transition: width 0.2s;
}

.list.narrow {
  width: 220px;
}

.list-head {
  padding: 10px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #ebeef5;
}

.list-scroll {
  flex: 1;
  padding: 6px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  font-size: 13px;
}

.file-item:hover {
  background: #f5f7fa;
}

.file-item.active {
  background: #ecf5ff;
}

.f-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

/* ---------- 右侧查看器 ---------- */
.viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.viewer-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #ebeef5;
}

.v-title {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spacer {
  flex: 1;
}

.viewer-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.view-error {
  margin: 20px;
  padding: 14px 16px;
  background: #fdf6ec;
  color: #e6a23c;
  border-radius: 8px;
  font-size: 13.5px;
  line-height: 1.8;
}

.pdf-frame {
  flex: 1;
  border: none;
  width: 100%;
}

/* DOCX 文章样式 */
.doc-html {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  line-height: 1.9;
  font-size: 14.5px;
  color: #303133;
  max-width: 860px;
}

.doc-html :deep(h1),
.doc-html :deep(h2),
.doc-html :deep(h3) {
  line-height: 1.5;
  margin: 18px 0 10px;
}

.doc-html :deep(table) {
  border-collapse: collapse;
  margin: 12px 0;
}

.doc-html :deep(td),
.doc-html :deep(th) {
  border: 1px solid #dcdfe6;
  padding: 6px 12px;
  font-size: 13.5px;
}

.doc-html :deep(img) {
  max-width: 100%;
}

/* XLSX 表格 */
.xlsx-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sheet-tabs {
  padding: 0 12px;
  flex-shrink: 0;
}

.sheet-scroll {
  flex: 1;
  padding: 12px;
}

.sheet-html :deep(table) {
  border-collapse: collapse;
  font-size: 13px;
}

.sheet-html :deep(td),
.sheet-html :deep(th) {
  border: 1px solid #e4e7ed;
  padding: 5px 10px;
  white-space: nowrap;
}

.sheet-html :deep(tr:first-child td),
.sheet-html :deep(th) {
  background: #f5f7fa;
  font-weight: 600;
}

/* PPTX 分页卡片 */
.slides-scroll {
  flex: 1;
  padding: 16px;
}

.slide-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 14px;
  background: #fafbfc;
}

.slide-no {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.slide-text {
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
  padding: 2px 0;
}

/* 欢迎区 */
.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
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
  .docs-page {
    flex-direction: column;
    height: auto;
  }

  .side,
  .list,
  .list.narrow {
    width: 100%;
    max-height: 200px;
  }

  .viewer {
    min-height: 65vh;
  }
}
</style>
