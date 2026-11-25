<script setup>
// 相册 —— Sealos 对象存储图片浏览（只读，含 SVG）
//
// 左侧目录树（懒加载，只显示目录），右侧当前目录图片网格；
// 点击缩略图打开 Element Plus 图片查看器（缩放/旋转/左右切换），
// 卡片上的下载按钮利用 S3 的 content-disposition: attachment 直接下载。
// 纯只读：不提供上传/删除/编辑。
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { listGallery, isImageFile, imageUrl, fetchImageBlobUrl } from '@/api/gallery'
import DirNav from '@/components/DirNav.vue'

const currentPrefix = ref('') // 当前目录前缀（'' = 根）
const currentName = ref('全部图片')
const images = ref([]) // 当前目录图片 [{key, name, url}]
const loading = ref(false)

// DirNav 目录选择（桌面树 / 手机抽屉共用）
function onDirSelect(node) {
  currentPrefix.value = node.key
  currentName.value = node.name
  loadImages()
}

// ---------- 图片加载（fetch → Blob objectURL，绕开 octet-stream+nosniff 封锁） ----------
async function loadImages() {
  loading.value = true
  // 释放上一批 objectURL，防内存泄漏
  images.value.forEach((i) => i.blobUrl && URL.revokeObjectURL(i.blobUrl))
  images.value = []
  try {
    const list = await listGallery(currentPrefix.value)
    const files = list.filter((f) => !f.isDir && isImageFile(f.name))
    images.value = files.map((f) => ({ key: f.key, name: f.name, blobUrl: '', loading: true, error: false }))
    // 6 并发拉取（浏览器对单域连接数有限，池化避免瞬时并发爆炸）
    let idx = 0
    const worker = async () => {
      while (idx < images.value.length) {
        const img = images.value[idx++]
        try {
          img.blobUrl = await fetchImageBlobUrl(img.key)
        } catch {
          img.error = true
        } finally {
          img.loading = false
        }
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

// 查看器地址列表（只含已加载成功的，与网格点击的 initial-index 对齐）
const loadedImages = () => images.value.filter((i) => i.blobUrl)
const previewList = () => loadedImages().map((i) => i.blobUrl)
const loadedIndex = (img) => loadedImages().indexOf(img)

// 下载：优先 blobUrl（同源 download 属性可靠），未加载完回退原始 URL
//（S3 的 content-disposition: attachment 会强制下载）
function download(img) {
  const a = document.createElement('a')
  a.href = img.blobUrl || imageUrl(img.key)
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
    <!-- 左侧：目录导航（桌面内联 / 手机悬浮抽屉） -->
    <DirNav title="图片目录" root-label="全部图片" :current="currentPrefix" @select="onDirSelect" />

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
          <div v-for="img in images" :key="img.key" class="card">
            <el-image
              v-if="img.blobUrl"
              :src="img.blobUrl"
              :preview-src-list="previewList()"
              :initial-index="loadedIndex(img)"
              fit="cover"
              class="thumb"
            />
            <div v-else class="thumb img-placeholder" :class="{ err: img.error }">
              {{ img.error ? '加载失败' : '加载中…' }}
            </div>
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
  min-height: 0;
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
