<script setup>
// Go 学习页面 —— 三个分类：
//   基础知识 / 框架知识：卡片 → 抽屉（讲解 + 示例代码）
//   Go 代码题：卡片 → 抽屉（题目 → 运行参考代码 → 查看答案讲解）
//
// 「在线运行」把代码发给后端，由后端代理到 Go 官方 Playground（go.dev/_/compile），
// 不需要本地安装 Go 就能跑代码。
import { ref, watch } from 'vue'
import { getGoContents, runGoCode } from '@/api/go'

const CATEGORIES = {
  basics: { name: '📘 基础知识', display: 'cards' },
  framework: { name: '🧩 框架知识', display: 'cards' },
  code: { name: '💻 代码题', display: 'cards' }
}

// 难度对应标签颜色
const DIFF_COLORS = { 简单: 'success', 中等: 'warning', 困难: 'danger' }

const category = ref('basics')
const loading = ref(false)
const list = ref([])

// 详情抽屉
const drawer = ref(false)
const active = ref(null)
// 参考答案是否展开（代码题先思考再看答案）
const showAnswer = ref(false)

// 在线运行相关状态
const running = ref(false)
const runOutput = ref('')
const runError = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await getGoContents({ category: category.value })
    list.value = res.data
  } finally {
    loading.value = false
  }
}

function openDetail(item) {
  active.value = item
  showAnswer.value = false // 每次打开都先隐藏答案
  runOutput.value = ''
  drawer.value = true
}

// 正文按空行分段
function toParagraphs(text) {
  return (text || '').split(/\n+/).filter((s) => s.trim())
}

// 在线运行参考代码
async function onRun() {
  if (!active.value?.code) return
  running.value = true
  runOutput.value = ''
  runError.value = false
  try {
    const res = await runGoCode(active.value.code)
    runOutput.value = res.data.output
    runError.value = runOutput.value.includes('【编译错误】') || runOutput.value.includes('panic')
  } catch (e) {
    /* 错误已由拦截器提示 */
  } finally {
    running.value = false
  }
}

watch(category, load)
load()
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-radio-group v-model="category">
        <el-radio-button v-for="(cfg, key) in CATEGORIES" :key="key" :value="key">
          {{ cfg.name }}
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

        <!-- ===== 代码题：先思考 → 运行 / 看答案 ===== -->
        <template v-if="active.category === 'code'">
          <div class="code-actions">
            <el-button type="success" size="small" :icon="'VideoPlay'" :loading="running" @click="onRun">
              运行参考代码
            </el-button>
            <el-button v-if="!showAnswer" size="small" @click="showAnswer = true">
              查看参考答案
            </el-button>
          </div>

          <!-- 运行输出 -->
          <div v-if="runOutput" class="run-output" :class="{ error: runError }">
            <div class="run-label">运行结果：</div>
            <pre>{{ runOutput }}</pre>
          </div>

          <!-- 参考答案（点击后显示） -->
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
}

.code-title {
  margin: 18px 0 8px;
}

/* 代码块：深色底 + 等宽字体 */
.code-block {
  background: #282c34;
  color: #abb2bf;
  padding: 14px 16px;
  border-radius: 8px;
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
  white-space: pre;
}

/* 运行输出 */
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
