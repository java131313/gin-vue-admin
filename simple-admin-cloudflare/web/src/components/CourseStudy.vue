<script setup>
// 课程学习通用组件 —— 学NodeJS / 学Vue / 学React 三个模块共用
//
// 三个模块的内容结构完全相同（基础知识 / 框架知识 / 代码题），
// 所以学习页只写一份，通过 module 属性切换模块；views 下的三个页面只是它的薄包装。
//
// 在线运行：Node 代码题是纯 JavaScript，直接在浏览器沙箱中运行（utils/runner.js）；
// Vue/React 代码题是组件代码，需要在本地工程中运行，页面给出提示。
import { ref, watch } from 'vue'
import { getCourseContents } from '@/api/course'
import { runJS } from '@/utils/runner'

// 模块配置：模块名 → 分类名 + 是否支持浏览器内运行
const MODULES = {
  node: { name: '🟢 学NodeJS', runnable: true },
  vue: { name: '🟣 学Vue', runnable: false },
  react: { name: '🔵 学React', runnable: false },
  java: { name: '☕ 学Java', runnable: false },
  python: { name: '🐍 学Python', runnable: false }
}
const CATEGORIES = {
  basics: '📘 基础知识',
  framework: '🧩 框架知识',
  code: '💻 代码题'
}
const DIFF_COLORS = { 简单: 'success', 中等: 'warning', 困难: 'danger' }

// 本组件接收一个 module 属性（node / vue / react）
const props = defineProps({
  module: { type: String, required: true }
})

const category = ref('basics')
const loading = ref(false)
const list = ref([])

// 详情抽屉
const drawer = ref(false)
const active = ref(null)
const showAnswer = ref(false) // 代码题的参考答案是否展开

// 在线运行（仅 Node 模块）
const running = ref(false)
const runOutput = ref('')
const runError = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await getCourseContents({ module: props.module, category: category.value })
    list.value = res.data
  } finally {
    loading.value = false
  }
}

function openDetail(item) {
  active.value = item
  showAnswer.value = false
  runOutput.value = ''
  drawer.value = true
}

function toParagraphs(text) {
  return (text || '').split(/\n+/).filter((s) => s.trim())
}

// 在浏览器沙箱中运行代码（runner 会同步执行后再等 1 秒收集异步输出）
async function onRun() {
  if (!active.value?.code) return
  running.value = true
  runOutput.value = ''
  runError.value = false
  try {
    runOutput.value = await runJS(active.value.code)
    runError.value = runOutput.value.includes('运行错误')
  } finally {
    running.value = false
  }
}

// 切换分类重新加载；module 变化时（理论上不会）也重新加载
watch([category, () => props.module], load)
load()
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-radio-group v-model="category">
        <el-radio-button v-for="(name, key) in CATEGORIES" :key="key" :value="key">
          {{ name }}
        </el-radio-button>
      </el-radio-group>
      <span class="count-hint">共 {{ list.length }} 篇</span>
    </el-card>

    <!-- 卡片网格 -->
    <div v-loading="loading" class="card-grid">
      <el-card v-for="item in list" :key="item.id" shadow="hover" class="item-card" @click="openDetail(item)">
        <div class="card-title">{{ item.title }}</div>
        <div class="card-summary">{{ item.summary }}</div>
        <div class="card-footer">
          <el-tag v-if="item.difficulty" :type="DIFF_COLORS[item.difficulty] || 'info'" size="small">
            {{ item.difficulty }}
          </el-tag>
          <el-tag v-if="item.tag" type="info" size="small">{{ item.tag }}</el-tag>
          <span class="more">查看详情 →</span>
        </div>
      </el-card>
    </div>
    <el-empty v-if="!loading && list.length === 0" description="该分类下暂无内容" />

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawer" size="580px">
      <template #header>
        <span v-if="active" class="drawer-title">
          {{ active.title }}
          <el-tag v-if="active.difficulty" :type="DIFF_COLORS[active.difficulty] || 'info'" size="small">
            {{ active.difficulty }}
          </el-tag>
          <el-tag v-if="active.tag" type="info" size="small">{{ active.tag }}</el-tag>
        </span>
      </template>

      <template v-if="active">
        <!-- 讲解 / 题目描述 -->
        <p v-for="(p, i) in toParagraphs(active.content)" :key="'c' + i" class="item-para">{{ p }}</p>

        <!-- ===== 代码题 ===== -->
        <template v-if="active.category === 'code'">
          <div class="code-actions">
            <!-- Node 的纯 JS 题可以浏览器运行；Vue/React 给出提示 -->
            <el-button
              v-if="MODULES[module].runnable"
              type="success"
              size="small"
              :icon="'VideoPlay'"
              :loading="running"
              @click="onRun"
            >
              运行参考代码
            </el-button>
            <el-tooltip v-else content="组件代码需要在本地工程中运行（npm run dev）" placement="top">
              <el-tag type="info" effect="plain">在本地工程中运行</el-tag>
            </el-tooltip>
            <el-button v-if="!showAnswer" size="small" @click="showAnswer = true">
              查看参考答案
            </el-button>
          </div>

          <!-- 运行输出 -->
          <div v-if="runOutput" class="run-output" :class="{ error: runError }">
            <div class="run-label">运行结果：</div>
            <pre>{{ runOutput }}</pre>
          </div>

          <!-- 参考答案 -->
          <template v-if="showAnswer">
            <h4 class="code-title">参考答案</h4>
            <pre class="code-block"><code>{{ active.code }}</code></pre>
          </template>
        </template>

        <!-- ===== 基础/框架：直接展示示例代码 ===== -->
        <template v-else-if="active.code">
          <h4 class="code-title">示例代码</h4>
          <pre class="code-block"><code>{{ active.code }}</code></pre>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.count-hint {
  margin-left: 16px;
  color: #909399;
  font-size: 13px;
}

.card-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.item-card {
  cursor: pointer;
}

.card-title {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.card-summary {
  margin-top: 8px;
  color: #606266;
  font-size: 14px;
  line-height: 1.7;
}

.card-footer {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.more {
  margin-left: auto;
  color: #409eff;
  font-size: 13px;
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.item-para {
  margin: 8px 0;
  line-height: 1.9;
  color: #606266;
  white-space: pre-wrap;
}

.code-actions {
  margin: 16px 0 10px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.code-title {
  margin: 18px 0 8px;
}

.code-block {
  background: #282c34;
  color: #abb2bf;
  padding: 14px 16px;
  border-radius: 8px;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
  white-space: pre;
}

.run-output {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 8px;
}

.run-output.error {
  background: #fef0f0;
  border-color: #fde2e2;
}

.run-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.run-output pre {
  margin: 0;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
