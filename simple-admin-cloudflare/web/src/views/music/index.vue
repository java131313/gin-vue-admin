<script setup>
// 音乐播放 —— Sealos 对象存储音频（mp3/wav/ogg/flac/m4a 等）
//
// 左侧目录树，中间音频文件列表（当前目录即播放列表），右侧播放面板：
// HTML5 <audio controls> 原生控件 + 上一首/下一首 + 播完自动下一首。
// 音频走 Blob objectURL（绕开 octet-stream+nosniff 封锁），wma 仅列出提示不支持。
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { listMusic, isAudioFile, isPlayable, audioUrl, fetchAudioBlobUrl } from '@/api/music'

const currentPrefix = ref('')
const currentName = ref('全部音乐')
const playlist = ref([]) // 当前目录音频 [{key, name, playable}]
const treeKey = ref(0)
const expandedKeys = ref([])
const loading = ref(false)

// 播放器状态
const audioEl = ref(null)
const currentIndex = ref(-1)
const currentUrl = ref('')
const trackLoading = ref(false)
const playing = ref(false)

const currentTrack = () => (currentIndex.value >= 0 ? playlist.value[currentIndex.value] : null)

// ---------- 目录树 ----------
async function loadNode(node, resolve) {
  const prefix = node.level === 0 ? '' : node.data.key
  try {
    const children = (await listMusic(prefix)).filter((n) => n.isDir).map((n) => ({ ...n, isLeaf: false }))
    resolve(children)
  } catch (e) {
    ElMessage.error(e.message)
    resolve([])
  }
}

function onNodeClick(data) {
  currentPrefix.value = data.key
  currentName.value = data.name
  loadPlaylist()
}

// ---------- 播放列表 ----------
async function loadPlaylist() {
  loading.value = true
  stopTrack() // 切目录停掉当前播放
  try {
    const list = await listMusic(currentPrefix.value)
    playlist.value = list
      .filter((f) => !f.isDir && isAudioFile(f.name))
      .map((f) => ({ key: f.key, name: f.name, playable: isPlayable(f.name) }))
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

// ---------- 播放控制 ----------
async function playAt(i) {
  const track = playlist.value[i]
  if (!track) return
  if (!track.playable) {
    ElMessage.warning('wma 格式浏览器无法解码，请下载后用本地播放器打开')
    return
  }
  stopTrack(false)
  currentIndex.value = i
  trackLoading.value = true
  try {
    currentUrl.value = await fetchAudioBlobUrl(track.key)
    await nextTick()
    await audioEl.value?.play().catch(() => {})
  } catch (e) {
    ElMessage.error('加载失败：' + (e?.message || e))
    currentIndex.value = -1
  } finally {
    trackLoading.value = false
  }
}

function stopTrack(clearIndex = true) {
  audioEl.value?.pause()
  if (currentUrl.value) {
    URL.revokeObjectURL(currentUrl.value)
    currentUrl.value = ''
  }
  if (clearIndex) currentIndex.value = -1
  playing.value = false
}

function next() {
  if (currentIndex.value < playlist.value.length - 1) playAt(currentIndex.value + 1)
}

function prev() {
  if (currentIndex.value > 0) playAt(currentIndex.value - 1)
}

function onEnded() {
  // 播完自动下一首；已是最后一首则停
  if (currentIndex.value < playlist.value.length - 1) next()
  else playing.value = false
}

function download(track) {
  const a = document.createElement('a')
  a.href = audioUrl(track.key)
  a.download = track.name
  a.target = '_blank'
  a.click()
}

function fmtName(name) {
  return name.replace(/\.[^.]+$/, '')
}

onMounted(loadPlaylist)
onBeforeUnmount(stopTrack)
</script>

<template>
  <div class="music-page">
    <!-- 左侧：目录树 -->
    <div class="side">
      <div class="side-head">
        <span class="side-title">音乐目录</span>
        <el-button size="small" :icon="'Refresh'" circle @click="treeKey++; loadPlaylist()" />
      </div>
      <el-scrollbar class="tree-scroll">
        <div
          class="root-node"
          :class="{ active: currentPrefix === '' }"
          @click="currentPrefix = ''; currentName = '全部音乐'; loadPlaylist()"
        >
          🗂️ 全部音乐
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

    <!-- 中间：播放列表 -->
    <div class="list">
      <div class="list-head">{{ currentName }} · {{ playlist.length }} 首</div>
      <el-scrollbar v-loading="loading" class="list-scroll">
        <div
          v-for="(t, i) in playlist"
          :key="t.key"
          class="track"
          :class="{ active: currentIndex === i, disabled: !t.playable }"
          @click="playAt(i)"
        >
          <span class="t-icon">
            <span v-if="currentIndex === i && playing" class="eq"><i /><i /><i /></span>
            <span v-else-if="currentIndex === i">▶</span>
            <span v-else>🎵</span>
          </span>
          <span class="t-name" :title="t.name">{{ fmtName(t.name) }}</span>
          <span v-if="!t.playable" class="t-badge">wma</span>
          <el-button link size="small" :icon="'Download'" title="下载" @click.stop="download(t)" />
        </div>
        <el-empty v-if="!loading && playlist.length === 0" description="这个目录没有音频文件" :image-size="70" />
      </el-scrollbar>
    </div>

    <!-- 右侧：播放面板 -->
    <div class="player">
      <template v-if="currentTrack()">
        <div class="disc" :class="{ spinning: playing }">💿</div>
        <div class="p-name">{{ fmtName(currentTrack().name) }}</div>
        <div class="p-path">{{ currentTrack().key }}</div>
        <div class="p-controls">
          <el-button :icon="'ArrowLeft'" circle :disabled="currentIndex <= 0" @click="prev" />
          <el-button
            v-if="!playing"
            type="primary"
            :icon="'VideoPlay'"
            circle
            size="large"
            @click="audioEl?.play()"
          />
          <el-button v-else type="primary" :icon="'VideoPause'" circle size="large" @click="audioEl?.pause()" />
          <el-button :icon="'ArrowRight'" circle :disabled="currentIndex >= playlist.length - 1" @click="next" />
        </div>
        <audio
          ref="audioEl"
          :src="currentUrl"
          controls
          class="audio-bar"
          @ended="onEnded"
          @play="playing = true"
          @pause="playing = false"
        />
        <div v-if="trackLoading" class="p-loading">加载音频中…</div>
        <div class="p-tip">播完自动下一首 · 原生控件支持倍速/进度/音量</div>
      </template>

      <div v-else class="welcome">
        <div class="welcome-icon">🎧</div>
        <h3>音乐播放</h3>
        <p class="welcome-tip">
          支持 mp3 / wav / ogg / flac / m4a / opus；
          <br />点击中间列表任意曲目开始播放，当前目录即播放列表。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.music-page {
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

/* ---------- 中间播放列表 ---------- */
.list {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
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

.track {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  font-size: 13px;
}

.track:hover {
  background: #f5f7fa;
}

.track.active {
  background: #ecf5ff;
}

.track.disabled {
  opacity: 0.55;
}

.t-icon {
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.t-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

.t-badge {
  font-size: 11px;
  color: #e6a23c;
  border: 1px solid #e6a23c;
  border-radius: 4px;
  padding: 0 4px;
}

/* 播放中的跳动均衡器 */
.eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}

.eq i {
  width: 3px;
  background: #409eff;
  animation: eq-bounce 0.9s infinite ease-in-out;
}

.eq i:nth-child(2) {
  animation-delay: 0.25s;
}

.eq i:nth-child(3) {
  animation-delay: 0.5s;
}

@keyframes eq-bounce {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 14px;
  }
}

/* ---------- 右侧播放面板 ---------- */
.player {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 24px;
  gap: 12px;
}

.disc {
  font-size: 88px;
  line-height: 1;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
}

.disc.spinning {
  animation: spin 6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.p-name {
  font-size: 17px;
  font-weight: 600;
  color: #303133;
  text-align: center;
  word-break: break-all;
}

.p-path {
  font-size: 12px;
  color: #c0c4cc;
  font-family: monospace;
  word-break: break-all;
  text-align: center;
}

.p-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 6px 0;
}

.audio-bar {
  width: 100%;
  max-width: 480px;
}

.p-loading {
  color: #e6a23c;
  font-size: 13px;
}

.p-tip {
  color: #c0c4cc;
  font-size: 12px;
}

.welcome {
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
  .music-page {
    flex-direction: column;
    height: auto;
  }

  .side,
  .list {
    width: 100%;
    max-height: 200px;
  }

  .player {
    min-height: 420px;
  }
}
</style>
