<script setup>
// 错题本页面 —— 考试答错的题自动收录到这里
//
// 两种使用方式：
//   列表模式：查看全部错题、展开答案解析、手动标记「已掌握」移出错题本
//   复习模式：抽认卡式复习——看题 → 显示答案 → 「已掌握」移出 / 「还需巩固」下一张
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listWrongBook, masterWrong } from '@/api/exam'
import { renderMath } from '@/utils/katex'

const TYPE_NAMES = { choice: '选择题', blank: '填空题', qa: '问答题' }
const SUBJECT_NAMES = { language: '学语言', math: '学数学' }

const loading = ref(false)
const rows = ref([]) // 错题列表

// 展开显示答案解析的行
const expanded = ref({})

// ---------- 复习模式（抽认卡） ----------
const reviewing = ref(false)
const reviewIndex = ref(0)
const showAnswer = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await listWrongBook()
    rows.value = res.data
  } finally {
    loading.value = false
  }
}

function toggleExpand(id) {
  expanded.value[id] = !expanded.value[id]
}

// 标记已掌握（移出错题本）
async function onMaster(row) {
  await masterWrong(row.id)
  ElMessage.success('已掌握，从错题本移除')
  // 复习模式下推进到下一张
  if (reviewing.value) {
    nextCard()
  }
  load()
}

async function onMasterWithConfirm(row) {
  await ElMessageBox.confirm('确定已经掌握这道题了吗？', '标记已掌握', { type: 'info' })
  onMaster(row)
}

// ---------- 复习模式 ----------
function startReview() {
  if (rows.value.length === 0) {
    ElMessage.info('错题本还是空的，先去考一场试吧')
    return
  }
  reviewIndex.value = 0
  showAnswer.value = false
  reviewing.value = true
}

function nextCard() {
  showAnswer.value = false
  // 延迟切下一张，让卡片先翻回正面
  setTimeout(() => {
    reviewIndex.value++
    if (reviewIndex.value >= rows.value.length) {
      reviewing.value = false
      ElMessage.success('复习完成！')
      load()
    }
  }, 200)
}

function exitReview() {
  reviewing.value = false
  load()
}

// 选择题选项拆分
function optionList(q) {
  return (q.options || '').split('\n').filter((s) => s.trim())
}

onMounted(load)
</script>

<template>
  <div>
    <!-- ================= 复习模式 ================= -->
    <template v-if="reviewing">
      <el-card shadow="never">
        <div class="review-header">
          <el-button :icon="'Back'" @click="exitReview">退出复习</el-button>
          <span>第 {{ reviewIndex + 1 }} / {{ rows.length }} 题</span>
          <el-progress
            :percentage="Math.round((reviewIndex / rows.length) * 100)"
            style="flex: 1; max-width: 300px"
          />
        </div>
      </el-card>

      <el-card v-if="rows[reviewIndex]" shadow="never" class="card-wrap">
        <div class="tags">
          <el-tag :type="rows[reviewIndex].question.subject === 'math' ? 'warning' : 'primary'" size="small">
            {{ SUBJECT_NAMES[rows[reviewIndex].question.subject] }}
          </el-tag>
          <el-tag type="info" size="small">{{ TYPE_NAMES[rows[reviewIndex].question.qType] }}</el-tag>
          <el-tag v-if="rows[reviewIndex].wrongCount > 1" type="danger" size="small">
            错 {{ rows[reviewIndex].wrongCount }} 次
          </el-tag>
        </div>

        <!-- 题目 -->
        <div class="q-content">{{ rows[reviewIndex].question.content }}</div>
        <div v-if="rows[reviewIndex].question.qType === 'choice'" class="q-options">
          <div
            v-for="(opt, j) in optionList(rows[reviewIndex].question)"
            :key="j"
            class="q-option"
          >
            <span v-if="rows[reviewIndex].question.subject === 'math'" v-html="renderMath(opt, false)" />
            <span v-else>{{ opt }}</span>
          </div>
        </div>

        <!-- 答案（点击后显示） -->
        <template v-if="showAnswer">
          <div class="answer-box">
            <div class="ans-line">参考答案：{{ rows[reviewIndex].question.answer }}</div>
            <div class="ans-line analysis">解析：{{ rows[reviewIndex].question.analysis }}</div>
          </div>
          <div class="card-actions">
            <el-button type="danger" plain @click="nextCard">还需巩固，下一张</el-button>
            <el-button type="success" @click="onMaster(rows[reviewIndex])">已掌握，移出错题本</el-button>
          </div>
        </template>
        <div v-else class="card-actions">
          <el-button type="primary" size="large" @click="showAnswer = true">显示答案</el-button>
        </div>
      </el-card>
    </template>

    <!-- ================= 列表模式 ================= -->
    <template v-else>
      <el-card shadow="never">
        <el-button type="warning" :icon="'MagicStick'" :disabled="rows.length === 0" @click="startReview">
          开始复习（{{ rows.length }} 道错题）
        </el-button>
      </el-card>

      <el-card shadow="never" style="margin-top: 16px">
        <el-table v-loading="loading" :data="rows" border>
          <el-table-column label="科目" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.question.subject === 'math' ? 'warning' : 'primary'" size="small">
                {{ SUBJECT_NAMES[row.question.subject] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="题型" width="90" align="center">
            <template #default="{ row }">
              <el-tag type="info" size="small">{{ TYPE_NAMES[row.question.qType] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="题目" min-width="280">
            <template #default="{ row }">
              <div style="white-space: pre-wrap">{{ row.question.content }}</div>
              <!-- 展开的答案解析 -->
              <div v-if="expanded[row.id]" class="answer-box" style="margin-top: 8px">
                <div>参考答案：{{ row.question.answer }}</div>
                <div class="analysis">解析：{{ row.question.analysis }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="错误次数" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.wrongCount > 1" type="danger" size="small">{{ row.wrongCount }}</el-tag>
              <span v-else style="color: #909399">1</span>
            </template>
          </el-table-column>
          <el-table-column label="最近答错" width="120">
            <template #default="{ row }">{{ new Date(row.lastWrongAt).toLocaleDateString() }}</template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="toggleExpand(row.id)">
                {{ expanded[row.id] ? '收起解析' : '查看解析' }}
              </el-button>
              <el-button link type="success" @click="onMasterWithConfirm(row)">已掌握</el-button>
            </template>
          </el-table-column>
          <template #empty>错题本是空的，答错的题会自动收录到这里</template>
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.review-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-wrap {
  margin-top: 16px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
}

.tags {
  display: flex;
  gap: 6px;
}

.q-content {
  margin: 16px 0;
  font-size: 17px;
  line-height: 1.9;
  white-space: pre-wrap;
}

.q-options {
  margin-bottom: 16px;
}

.q-option {
  padding: 4px 0;
}

.answer-box {
  background: #fdf6ec;
  border-radius: 6px;
  padding: 12px 16px;
  line-height: 2;
  font-size: 14px;
  white-space: pre-wrap;
}

.analysis {
  color: #909399;
}

.card-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
