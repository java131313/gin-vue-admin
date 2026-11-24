<script setup>
// 背单词页面 —— Anki 式翻卡片
//
// 交互流程：
//   1. 进入页面 → 自动抽一批「未掌握」的单词
//   2. 卡片正面是单词，点击卡片（或按钮）翻面看释义和例句
//   3. 根据自己的记忆情况点「认识 / 不认识」→ 自动进入下一张
//   4. 连续答对 3 次的单词会被标记为「已掌握」
//   5. 一批练完后可以开始新一轮，或切换「全部复习」模式
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getStudyBatch, reviewWord, getStudyStats } from '@/api/study'

// ---------- 学习统计 ----------
const stats = ref({ total: 0, mastered: 0, reviewedToday: 0, languages: [] })

// 语言显示名映射
const LANG_NAMES = { en: '英语', ja: '日语' }

// ---------- 卡片状态 ----------
const batch = ref([]) // 本批单词数组
const index = ref(0) // 当前是第几张（下标从 0 开始）
const flipped = ref(false) // 卡片是否已翻面
const mode = ref('unmastered') // unmastered=只练没掌握的 all=全部复习
const language = ref('all') // all=英日混合 en=只学英语 ja=只学日语
const loading = ref(false)

// 当前单词
const current = computed(() => batch.value[index.value] || null)
// 是否练完了本批
const finished = computed(() => batch.value.length > 0 && index.value >= batch.value.length)
// 完全没有词库数据
const emptyBank = computed(() => stats.value.total === 0)

// 拉取统计和一批新单词
async function start(newMode) {
  mode.value = newMode || mode.value
  loading.value = true
  try {
    const [s, b] = await Promise.all([
      getStudyStats(),
      getStudyBatch({ mode: mode.value, size: 20, language: language.value })
    ])
    stats.value = s.data
    batch.value = b.data
    index.value = 0
    flipped.value = false
  } finally {
    loading.value = false
  }
}

// 翻面
function onFlip() {
  flipped.value = true
}

// 回答「认识 / 不认识」：记录结果，然后翻到正面、进入下一张
async function onAnswer(correct) {
  if (!current.value) return
  const res = await reviewWord({ wordId: current.value.id, correct })
  // 单词刚被标记为「已掌握」时给个鼓励提示
  if (correct && res.data.mastered) {
    ElMessage.success(`「${current.value.word}」已掌握 🎉`)
  }
  flipped.value = false // 下一张要先显示正面
  index.value++
}

// 用浏览器自带的语音合成朗读单词（Web Speech API，无需后端）
// 根据单词的语言选择对应的朗读语音：英语 en-US，日语 ja-JP
function speak(text, lang) {
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = lang === 'ja' ? 'ja-JP' : 'en-US'
  speechSynthesis.cancel() // 停止上一个朗读，避免叠加
  speechSynthesis.speak(utter)
}

// 每换一张新卡片时自动朗读一遍（浏览器可能要求先有过点击交互才允许发声）
watch(current, (word) => {
  if (word && !flipped.value) {
    try {
      speak(word.word, word.language)
    } catch (e) {
      /* 某些浏览器禁止自动播放语音，忽略即可，用户可以点 🔊 按钮 */
    }
  }
})

onMounted(() => start('unmastered'))
</script>

<template>
  <div class="study-page" v-loading="loading">
    <!-- 顶部统计 -->
    <el-card shadow="never" class="stats-card">
      <div class="stats">
        <div class="stat-item">
          <span class="num">{{ stats.total }}</span>
          <span class="label">词库总量</span>
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
          <!-- 语言选择：混合 = 英语日语一起抽；统计按语言分别展示掌握进度 -->
          <el-radio-group v-model="language" @change="start(mode)">
            <el-radio-button value="all">🌍 混合</el-radio-button>
            <el-radio-button value="en">🇬🇧 英语</el-radio-button>
            <el-radio-button value="ja">🇯🇵 日语</el-radio-button>
          </el-radio-group>
          <el-radio-group v-model="mode" style="margin-left: 12px" @change="start(mode)">
            <el-radio-button value="unmastered">未掌握</el-radio-button>
            <el-radio-button value="all">全部复习</el-radio-button>
          </el-radio-group>
        </div>
      </div>
      <!-- 按语言展示掌握进度 -->
      <div class="lang-stats">
        <span v-for="l in stats.languages" :key="l.language" class="lang-stat">
          {{ LANG_NAMES[l.language] || l.language }}：已掌握 {{ l.mastered }}/{{ l.total }}
        </span>
      </div>
    </el-card>

    <!-- 空词库提示 -->
    <el-empty v-if="emptyBank && !loading" description="词库还是空的，请先在「词库管理」里添加单词">
    </el-empty>

    <!-- 全部掌握 / 练完一批的结束画面 -->
    <el-card v-else-if="finished" shadow="never" class="done-card">
      <template v-if="mode === 'unmastered' && stats.mastered >= stats.total">
        <div class="done-icon">🏆</div>
        <p class="done-text">太棒了！词库里的 {{ stats.total }} 个单词全部掌握！</p>
        <el-button @click="start('all')">全部复习一遍</el-button>
      </template>
      <template v-else>
        <div class="done-icon">✅</div>
        <p class="done-text">本批 {{ batch.length }} 张卡片复习完成！</p>
        <el-button type="primary" @click="start(mode)">再来一轮</el-button>
        <el-button v-if="mode === 'unmastered'" @click="start('all')">全部复习</el-button>
      </template>
    </el-card>

    <!-- 背单词卡片 -->
    <template v-else-if="current">
      <!-- 进度条 -->
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
          <!-- 正面：单词 -->
          <div class="face front">
            <el-tag class="lang-tag" :type="current.language === 'ja' ? 'danger' : 'primary'">
              {{ LANG_NAMES[current.language] || current.language }}
            </el-tag>
            <div class="word">{{ current.word }}</div>
            <div class="phonetic">{{ current.phonetic }}</div>
            <el-button
              circle
              class="speak-btn"
              :icon="'Headset'"
              @click.stop="speak(current.word, current.language)"
            />
            <div class="hint">点击卡片查看释义</div>
          </div>
          <!-- 背面：释义 + 例句（rotateY(180deg) 翻转过来） -->
          <div class="face back">
            <div class="meaning">{{ current.meaning }}</div>
            <div class="example">{{ current.example }}</div>
            <div class="example-cn">{{ current.exampleCN }}</div>
          </div>
        </div>
      </div>

      <!-- 操作按钮：先翻面，再判断认识与否 -->
      <div class="actions">
        <template v-if="!flipped">
          <el-button type="primary" size="large" @click="onFlip">翻面</el-button>
        </template>
        <template v-else>
          <el-button type="danger" size="large" @click="onAnswer(false)">😵 不认识</el-button>
          <el-button type="success" size="large" @click="onAnswer(true)">😀 认识</el-button>
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
  gap: 36px;
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

.lang-stats {
  margin-top: 10px;
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #909399;
}

.lang-tag {
  position: absolute;
  top: 14px;
  left: 14px;
}

.progress-row {
  display: flex;
  align-items: center;
  margin: 20px 0;
}

/* --- 3D 翻牌效果 --- */
/* perspective 给子元素提供纵深： rotateY 旋转时看起来有立体感 */
.card-scene {
  perspective: 1200px;
  cursor: pointer;
}

.flip-card {
  position: relative;
  height: 300px;
  /* preserve-3d：让正反两面处在同一个三维空间里，翻面时一起旋转 */
  transform-style: preserve-3d;
  transition: transform 0.5s;
}

.flip-card.flipped {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  /* 背面朝向用户时隐藏 */
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
  text-align: center;
}

.word {
  font-size: 44px;
  font-weight: bold;
  color: #303133;
}

.phonetic {
  margin-top: 8px;
  color: #909399;
  font-size: 18px;
}

.speak-btn {
  margin-top: 16px;
}

.hint {
  position: absolute;
  bottom: 16px;
  color: #c0c4cc;
  font-size: 13px;
}

.meaning {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.example {
  margin-top: 20px;
  color: #606266;
  font-size: 16px;
}

.example-cn {
  margin-top: 8px;
  color: #909399;
  font-size: 14px;
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
