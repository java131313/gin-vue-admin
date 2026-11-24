<script setup>
// 自定义学习 · 卡片学习页 —— 通用模板的「学什么 + 复习什么」
//
// 选择一个科目（如学Rust），像背单词一样翻卡片：
// 正面是条目名，点击翻面看讲解，然后判断「认识 / 不认识」，
// 连续答对 3 次自动掌握。统计按科目、按人独立追踪。
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getCustomModules, getCustomBatch, reviewCustomItem, getCustomStats } from '@/api/custom'

// ---------- 科目选择 ----------
const modules = ref([])
const currentModule = ref(null) // 当前科目 ID

// ---------- 统计 ----------
const stats = ref({ total: 0, mastered: 0, reviewedToday: 0 })

// ---------- 卡片状态 ----------
const batch = ref([])
const index = ref(0)
const flipped = ref(false)
const mode = ref('unmastered') // unmastered=只练没掌握的 all=全部
const loading = ref(false)

const current = computed(() => batch.value[index.value] || null)
const finished = computed(() => batch.value.length > 0 && index.value >= batch.value.length)
const emptyModule = computed(() => stats.value.total === 0)

async function load() {
  if (!currentModule.value) return
  loading.value = true
  try {
    const [s, b] = await Promise.all([
      getCustomStats({ moduleId: currentModule.value }),
      getCustomBatch({ moduleId: currentModule.value, mode: mode.value, size: 20 })
    ])
    stats.value = s.data
    batch.value = b.data
    index.value = 0
    flipped.value = false
  } finally {
    loading.value = false
  }
}

function onFlip() {
  flipped.value = true
}

async function onAnswer(correct) {
  if (!current.value) return
  const res = await reviewCustomItem({ itemId: current.value.id, correct })
  if (correct && res.data.mastered) {
    ElMessage.success(`「${current.value.title}」已掌握 🎉`)
  }
  flipped.value = false
  index.value++
}

// ---------- 初始化 ----------
async function init() {
  const res = await getCustomModules()
  modules.value = res.data
  if (modules.value.length > 0) {
    currentModule.value = modules.value[0].id
    load()
  }
}

watch(currentModule, load)
onMounted(init)
</script>

<template>
  <div class="study-page" v-loading="loading">
    <!-- 科目选择 -->
    <el-card shadow="never" class="stats-card">
      <div class="stats">
        <el-select v-model="currentModule" placeholder="选择科目" style="min-width: 200px">
          <el-option
            v-for="m in modules"
            :key="m.id"
            :label="`${m.icon || '📚'} ${m.name}（${m.itemCount} 条）`"
            :value="m.id"
          />
        </el-select>
        <div class="stat-item">
          <span class="num">{{ stats.total }}</span>
          <span class="label">条目总数</span>
        </div>
        <div class="stat-item">
          <span class="num success">{{ stats.mastered }}</span>
          <span class="label">已掌握</span>
        </div>
        <div class="stat-item">
          <span class="num warning">{{ stats.total - stats.mastered }}</span>
          <span class="label">未掌握</span>
        </div>
        <div class="stat-item">
          <span class="num">{{ stats.reviewedToday }}</span>
          <span class="label">今日已复习</span>
        </div>
        <div class="mode-switch">
          <el-radio-group v-model="mode" @change="load">
            <el-radio-button value="unmastered">未掌握</el-radio-button>
            <el-radio-button value="all">全部</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </el-card>

    <!-- 没有科目 -->
    <el-empty v-if="modules.length === 0" description="还没有自定义科目，请管理员到「模板管理」创建（比如：学Rust、考研政治）" />

    <!-- 空科目 -->
    <el-empty v-else-if="emptyModule" description="该科目下还没有条目，请管理员到「模板管理」添加知识点" />

    <!-- 练完一轮 -->
    <el-card v-else-if="finished" shadow="never" class="done-card">
      <div class="done-icon">✅</div>
      <p class="done-text">本批 {{ batch.length }} 张卡片复习完成！</p>
      <el-button type="primary" @click="load">再来一轮</el-button>
    </el-card>

    <!-- 卡片 -->
    <template v-else-if="current">
      <div class="progress-row">
        <el-progress
          :percentage="Math.round((index / batch.length) * 100)"
          :format="() => `${index + 1} / ${batch.length}`"
          style="flex: 1"
        />
      </div>

      <!-- 3D 翻面卡片 -->
      <div class="card-scene" @click="onFlip">
        <div class="flip-card" :class="{ flipped }">
          <!-- 正面：条目名 -->
          <div class="face front">
            <el-tag v-if="current.tag" class="tag" size="small">{{ current.tag }}</el-tag>
            <div class="word">{{ current.title }}</div>
            <div class="hint">点击卡片查看讲解</div>
          </div>
          <!-- 背面：讲解 -->
          <div class="face back">
            <div class="back-title">{{ current.title }}</div>
            <div class="meaning">{{ current.content }}</div>
          </div>
        </div>
      </div>

      <div class="actions">
        <template v-if="!flipped">
          <el-button type="primary" size="large" @click="onFlip">翻面</el-button>
        </template>
        <template v-else>
          <el-button type="danger" size="large" @click="onAnswer(false)">😵 没记住</el-button>
          <el-button type="success" size="large" @click="onAnswer(true)">😀 记住了</el-button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.study-page {
  max-width: 640px;
  margin: 0 auto;
}

.stats-card :deep(.el-card__body) {
  padding: 14px 20px;
}

.stats {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.num {
  font-size: 22px;
  font-weight: bold;
}

.num.success {
  color: #67c23a;
}

.num.warning {
  color: #e6a23c;
}

.label {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.mode-switch {
  margin-left: auto;
}

.progress-row {
  display: flex;
  align-items: center;
  margin: 20px 0;
}

/* --- 3D 翻牌效果 --- */
.card-scene {
  perspective: 1200px;
  cursor: pointer;
}

.flip-card {
  position: relative;
  height: 300px;
  transform-style: preserve-3d;
  transition: transform 0.5s;
}

.flip-card.flipped {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}

.front {
  background: #fff;
}

.back {
  background: #f0f7ff;
  transform: rotateY(180deg);
  justify-content: flex-start;
  overflow-y: auto;
}

.tag {
  position: absolute;
  top: 14px;
  left: 14px;
}

.word {
  font-size: 36px;
  font-weight: bold;
  color: #303133;
  text-align: center;
}

.hint {
  position: absolute;
  bottom: 16px;
  color: #c0c4cc;
  font-size: 13px;
}

.back-title {
  font-size: 20px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 12px;
}

.meaning {
  font-size: 16px;
  line-height: 1.9;
  color: #606266;
  white-space: pre-wrap;
}

.actions {
  margin-top: 24px;
  display: flex;
  justify-content: center;
  gap: 24px;
}

.done-card :deep(.el-card__body) {
  text-align: center;
  padding: 48px 20px;
}

.done-icon {
  font-size: 56px;
}

.done-text {
  margin: 16px 0 24px;
  color: #606266;
  font-size: 16px;
}
</style>
