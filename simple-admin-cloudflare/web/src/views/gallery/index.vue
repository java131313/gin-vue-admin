<script setup>
// 相册 —— Sealos 对象存储图片浏览（只读，含 SVG）
//
// 左侧目录树（懒加载，只显示目录），右侧当前目录图片网格；
// 点击缩略图打开 Element Plus 图片查看器（缩放/旋转/左右切换），
// 卡片上的下载按钮利用 S3 的 content-disposition: attachment 直接下载。
// 纯只读：不提供上传/删除/编辑。
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { listGallery, isImageFile, imageUrl } from '@/api/gallery'

const currentPrefix = ref('') // 当前目录前缀（'' = 根）
const currentName = ref('全部图片')
const images = ref([]) // 当前目录图片 [{key, name, url}]
const loading = ref(false)
const treeKey = ref(0)
const expandedKeys = ref([])

// ---------- 目录树（懒加载，只保留目录节点） ----------
async function loadNode(node, resolve) {
  const prefix = node.level === 0 ? '' : node.data.key
  try {
    const children = (await listGallery(prefix))
      .filter((n) => n.isDir)
      .map((n) => ({ ...n, isLeaf: false }))
    resolve(children)
  } catch (e) {
    ElMessage.error(e.message)
    resolve([])
  }
}

function onNodeClick(data) {
  currentPrefix.value = data.key
  currentName.value = data.name
  loadImages()
}

function onNodeExpand(data) {
  if (!expandedKeys.value.includes(data.key)) expandedKeys.value.push(data.key)
}

// ---------- 图片加载 ----------
async function loadImages() {
  loading.value = true
  try {
    const list = await listGallery(currentPrefix.value)
    images.value = list
      .filter((f) => !f.isDir && isImageFile(f.name))
      .map((f) => ({ key: f.key, name: f.name, url: imageUrl(f.key) }))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

// 查看器的图片地址列表（保持与网格同序，initial-index 对齐）
const previewList = () => images.value.map((i) => i.url)

// 下载：S3 响应带 content-disposition: attachment，直接打开即下载
function download(img) {
  const a = document.createElement('a')
  a.href = img.url
  a.download = img.name
  a.target = '_blank'
  a.click()
}

function fmtName(name) {
  return name.length > 22 ? name.slice(0, 20) + '…' : name
}

onMounted(loadImages)
</script>

<template>
  <div class="gallery-page">
    <!-- 左侧：目录树（只读导航） -->
    <div class="side">
      <div class="side-head">
        <span class="side-title">图片目录</span>
        <el-button size="small" :icon="'Refresh'" circle @click="treeKey++; loadImages()" />
      </div>
      <el-scrollbar class="tree-scroll">
        <div
          class="root-node"
          :class="{ active: currentPrefix === '' }"
          @click="currentPrefix = ''; currentName = '全部图片'; loadImages()"
        >
          🗂️ 全部图片
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
          @node-expand="onNodeExpand"
        >
          <template #default="{ data }">
            <span class="tree-node">📁 {{ data.name }}</span>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>

    <!-- 右侧：图片网格 -->
    <div class="main">
      <div class="toolbar">
        <span class="path">{{ currentName }}</span>
        <span class="count">{{ images.length }} 张</span>
        <span class="spacer" />
        <span class="hint">点击放大 · 查看器内可缩放/旋转/切换</span>
      </div>

      <el-scrollbar v-loading="loading" class="grid-scroll">
        <div v-if="images.length" class="grid">
          <div v-for="(img, i) in images" :key="img.key" class="card">
            <el-image
              :src="img.url"
              :preview-src-list="previewList()"
              :initial-index="i"
              fit="cover"
              lazy
              class="thumb"
            >
              <template #placeholder>
                <div class="img-placeholder">加载中…</div>
              </template>
              <template #error>
                <div class="img-placeholder err">加载失败</div>
              </template>
            </el-image>
            <div class="meta">
              <span class="name" :title="img.name">{{ fmtName(img.name) }}</span>
              <el-button link size="small" :icon="'Download'" title="下载" @click="download(img)" />
            </div>
          </div>
        </div>
        <el-empty v-else-if="!loading" description="这个目录没有图片" :image-size="80" />
      </el-scrollbar>
    </div>
  </div>
</template>

<style scoped>
.gallery-page {
  display: flex;
  gap: 12px;
  height: calc(100vh - 140px);
}

/* ---------- 左侧目录树 ---------- */
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

/* ---------- 右侧网格 ---------- */
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
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #ebeef5;
}

.path {
  font-weight: 600;
  font-size: 14px;
}

.count {
  font-size: 12px;
  color: #909399;
}

.spacer {
  flex: 1;
}

.hint {
  font-size: 12px;
  color: #c0c4cc;
}

.grid-scroll {
  flex: 1;
  padding: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

.card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.thumb {
  width: 100%;
  height: 150px;
  display: block;
  background: #f5f7fa;
  cursor: zoom-in;
}

.img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 12px;
  background: #f5f7fa;
}

.img-placeholder.err {
  color: #f56c6c;
}

.meta {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
}

.meta .name {
  flex: 1;
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 移动端 */
@media (max-width: 768px) {
  .gallery-page {
    flex-direction: column;
    height: auto;
  }

  .side {
    width: 100%;
    max-height: 200px;
  }

  .grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
}
</style>
