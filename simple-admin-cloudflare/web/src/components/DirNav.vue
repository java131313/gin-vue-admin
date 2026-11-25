<script setup>
// 目录导航 —— 桌面端内联侧栏 / 移动端悬浮抽屉（自适应）
//
// 手机访问时内联目录会把内容挤下去且底部目录看不到，改为：
// 左下角浮动按钮唤起 el-drawer 悬浮目录，抽屉内目录多了自然滚动，
// 点选后自动收起。桌面端保持原内联侧栏。
//
// showFiles=false（默认）：纯目录树（相册/文档/音乐，文件在中间列表）
// showFiles=true：目录+文件混合树（笔记/思维导图/Mermaid，文件可点选）
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { listNotes } from '@/api/notes'

const props = defineProps({
  title: { type: String, default: '目录' },
  rootLabel: { type: String, default: '全部' },
  current: { type: String, default: '' }, // 当前选中 key（高亮）
  showFiles: { type: Boolean, default: false }
})
const emit = defineEmits(['select']) // (node: {key, name, isDir})

const isMobile = ref(window.innerWidth <= 768)
const drawer = ref(false)
const treeKey = ref(0)
const expandedKeys = ref([])
let resizeHandler

async function loadNode(node, resolve) {
  const prefix = node.level === 0 ? '' : node.data.key
  try {
    const children = await listNotes(prefix)
    resolve(
      props.showFiles
        ? children.map((n) => ({ ...n, isLeaf: !n.isDir }))
        : children.filter((n) => n.isDir).map((n) => ({ ...n, isLeaf: false }))
    )
  } catch (e) {
    ElMessage.error(e.message)
    resolve([])
  }
}

function pick(node) {
  emit('select', node)
  drawer.value = false // 移动端选完自动收起
}

function onRootClick() {
  pick({ key: '', name: props.rootLabel, isDir: true })
}

function onNodeClick(data) {
  pick(data)
}

function refresh() {
  treeKey.value++
}

onMounted(() => {
  resizeHandler = () => {
    isMobile.value = window.innerWidth <= 768
  }
  window.addEventListener('resize', resizeHandler)
})
onBeforeUnmount(() => window.removeEventListener('resize', resizeHandler))
</script>

<template>
  <!-- 桌面端：内联侧栏 -->
  <div v-if="!isMobile" class="dir-nav">
    <div class="dir-head">
      <span class="dir-title">{{ title }}</span>
      <div class="dir-actions">
        <slot name="toolbar" />
        <el-button size="small" :icon="'Refresh'" circle title="刷新" @click="refresh" />
      </div>
    </div>
    <el-scrollbar class="dir-scroll">
      <!-- 传了默认 slot 就用自定义内容（文件列表等），否则用内置目录树 -->
      <slot v-if="$slots.default" :close="() => (drawer = false)" />
      <template v-else>
        <div class="root-node" :class="{ active: current === '' }" @click="onRootClick">
          🗂️ {{ rootLabel }}
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
            <span class="tree-node">{{ data.isDir ? '📁' : '📄' }} {{ data.name }}</span>
          </template>
        </el-tree>
      </template>
    </el-scrollbar>
  </div>

  <!-- 移动端：浮动按钮 + 悬浮抽屉（目录多了抽屉内滚动） -->
  <template v-else>
    <el-button
      class="dir-fab"
      type="primary"
      :icon="'FolderOpened'"
      circle
      size="large"
      title="打开目录"
      @click="drawer = true"
    />
    <el-drawer
      v-model="drawer"
      direction="ltr"
      :title="title"
      size="80%"
      destroy-on-close
      class="dir-drawer"
    >
      <div class="drawer-toolbar">
        <slot name="toolbar" />
        <el-button size="small" :icon="'Refresh'" circle title="刷新" @click="refresh" />
      </div>
      <div class="drawer-scroll">
        <slot v-if="$slots.default" :close="() => (drawer = false)" />
        <template v-else>
          <div class="root-node" :class="{ active: current === '' }" @click="onRootClick">
            🗂️ {{ rootLabel }}
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
              <span class="tree-node">{{ data.isDir ? '📁' : '📄' }} {{ data.name }}</span>
            </template>
          </el-tree>
        </template>
      </div>
    </el-drawer>
  </template>
</template>

<style scoped>
/* ---------- 桌面端内联侧栏 ---------- */
.dir-nav {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.dir-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #ebeef5;
}

.dir-title {
  font-weight: 600;
  font-size: 14px;
}

.dir-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dir-scroll {
  flex: 1;
  min-height: 0;
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

/* ---------- 移动端浮动按钮 + 抽屉 ---------- */
.dir-fab {
  position: fixed;
  left: 16px;
  bottom: 24px;
  z-index: 100;
  box-shadow: 0 4px 14px rgba(64, 158, 255, 0.45);
}

.drawer-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

/* 抽屉内滚动：原生 overflow，触摸友好 */
.drawer-scroll {
  height: calc(100% - 46px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 去掉 el-drawer body 默认内边距，让滚动区撑满 */
:deep(.el-drawer__body) {
  padding: 12px 16px;
  overflow: hidden;
}
</style>
