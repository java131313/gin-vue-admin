<script setup>
// 考试记录页面：历次测验的得分与答题详情
import { ref, onMounted } from 'vue'
import { listExams, getExamResult } from '@/api/exam'

const TYPE_NAMES = { choice: '选择题', blank: '填空题', qa: '问答题' }
const SUBJECT_NAMES = { language: '学语言', math: '学数学', custom: '自定义' }

const loading = ref(false)
const rows = ref([])

// 详情弹窗
const detailVisible = ref(false)
const detail = ref(null) // {exam, items}

async function load() {
  loading.value = true
  try {
    const res = await listExams()
    rows.value = res.data
  } finally {
    loading.value = false
  }
}

async function openDetail(id) {
  const res = await getExamResult(id)
  detail.value = res.data
  detailVisible.value = true
}

function scoreTagType(score) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'danger'
}

onMounted(load)
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="试卷" min-width="200" />
        <el-table-column prop="total" label="题数" width="80" align="center" />
        <el-table-column label="得分" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'done'" :type="scoreTagType(row.score)">
              {{ row.score }} 分
            </el-tag>
            <el-tag v-else type="info">未交卷</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="考试时间" width="180">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="row.status !== 'done'" @click="openDetail(row.id)">
              答题详情
            </el-button>
          </template>
        </el-table-column>
        <template #empty>还没有考试记录，去「开始考试」考一场吧</template>
      </el-table>
    </el-card>

    <!-- 答题详情弹窗 -->
    <el-dialog v-model="detailVisible" title="答题详情" width="720px" top="4vh">
      <template v-if="detail">
        <div v-for="(item, i) in detail.items" :key="item.questionId" class="item">
          <div class="item-title">
            <el-tag size="small" :type="item.subject === 'math' ? 'warning' : 'primary'">
              {{ SUBJECT_NAMES[item.subject] }} · {{ TYPE_NAMES[item.qType] }}
            </el-tag>
            <span class="verdict" :class="{ wrong: !item.correct }">
              {{ item.correct ? '✔' : '✘' }}
            </span>
            {{ i + 1 }}. {{ item.content }}
          </div>
          <div class="item-body">
            <div>我的答案：{{ item.userAnswer || '（未作答）' }}</div>
            <div>参考答案：{{ item.answer }}</div>
            <div class="analysis">解析：{{ item.analysis }}</div>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.item {
  padding: 12px 0;
  border-bottom: 1px dashed #ebeef5;
}

.item:last-child {
  border-bottom: none;
}

.item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.8;
  white-space: pre-wrap;
  margin-bottom: 6px;
}

.verdict {
  font-weight: bold;
  color: #67c23a;
}

.verdict.wrong {
  color: #f56c6c;
}

.item-body {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 10px 14px;
  line-height: 2;
  font-size: 14px;
  white-space: pre-wrap;
}

.analysis {
  color: #909399;
}
</style>
