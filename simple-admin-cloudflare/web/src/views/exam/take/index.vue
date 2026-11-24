<script setup>
// 开始考试页面 —— 四步流程：
//   1. 配置题量 → 2. 答题 → 3. 对答案（客观题自动判分，问答题对照参考要点自评）→ 4. 总分
//
// 题目由后端从「词库 + 公式库」动态生成，始终与学习内容同步。
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { generateExam, submitExam, finishExam } from '@/api/exam'
import { getCustomModules } from '@/api/custom'
import { renderMath } from '@/utils/katex'

// ---------- 流程控制 ----------
const step = ref('config') // config / answering / grading / done

// ---------- 第 1 步：配置 ----------
// source=general：从词库+公式库出题；source=custom：从自定义科目的条目出题
const config = reactive({ choiceCount: 4, blankCount: 3, qaCount: 2, source: 'general', customModuleId: null })
const generating = ref(false)
const customModules = ref([]) // 自定义科目下拉选项

// 选择「自定义科目」时加载科目列表
async function loadCustomModules() {
  if (customModules.value.length) return
  const res = await getCustomModules()
  customModules.value = res.data
  if (res.data.length && !config.customModuleId) {
    config.customModuleId = res.data[0].id
  }
}

// ---------- 第 2 步：答题 ----------
const exam = ref(null)
const questions = ref([])
const answers = reactive({}) // {questionId: 用户的答案}
const submitting = ref(false)

// ---------- 第 3 步：对答案 ----------
const results = ref([]) // 判分结果（含答案和解析）
const qaSelfGrade = reactive({}) // {questionId: true/false} 问答题自评
const finishing = ref(false)

// ---------- 第 4 步：成绩 ----------
const finalResult = ref(null)

// 题型显示名
const TYPE_NAMES = { choice: '选择题', blank: '填空题', qa: '问答题' }
const SUBJECT_NAMES = { language: '学语言', math: '学数学', custom: '自定义' }

// 按类型分组题目（保持原始顺序）
const choiceQuestions = computed(() => questions.value.filter((q) => q.qType === 'choice'))
const blankQuestions = computed(() => questions.value.filter((q) => q.qType === 'blank'))
const qaQuestions = computed(() => questions.value.filter((q) => q.qType === 'qa'))

// 选择题选项：后端按 \n 分隔存储，拆成数组
function optionList(q) {
  return (q.options || '').split('\n').filter((s) => s.trim())
}

// 题目文本渲染：数学题的题干和选项用 KaTeX 渲染 LaTeX 公式
function richText(text, subject) {
  if (subject !== 'math') return text
  // 题干里有中文说明，只有公式部分能渲染，所以这里只做简单处理：
  // 含反斜杠（LaTeX 特征）的片段才渲染
  if (!text || !text.includes('\\')) return text
  return renderMath(text)
}

// 生成试卷
async function onGenerate() {
  generating.value = true
  try {
    // 自定义科目来源：带上科目 ID
    const payload = { ...config }
    if (config.source !== 'custom') {
      delete payload.customModuleId
      payload.customModuleId = 0
    }
    const res = await generateExam(payload)
    exam.value = res.data.exam
    questions.value = res.data.questions
    // 初始化答案
    for (const q of questions.value) answers[q.id] = ''
    step.value = 'answering'
  } catch (e) {
    /* 错误信息已由拦截器统一提示 */
  } finally {
    generating.value = false
  }
}

// 提交答卷（客观题自动判分）
async function onSubmit() {
  // 检查是否全部作答（问答题允许留空，但给出提示）
  const unanswered = questions.value.filter((q) => !answers[q.id])
  if (unanswered.length > 0) {
    await ElMessageBox_confirm(unanswered.length)
  }
  submitting.value = true
  try {
    const payload = questions.value.map((q) => ({
      questionId: q.id,
      userAnswer: answers[q.id]
    }))
    const res = await submitExam(exam.value.id, { answers: payload })
    results.value = res.data.results
    step.value = 'grading'
    window.scrollTo(0, 0)
  } finally {
    submitting.value = false
  }
}

// 简单的确认弹窗（抽出来避免每次引入组件）
async function ElMessageBox_confirm(count) {
  await ElMessageBox.confirm(`还有 ${count} 道题没有作答，确定要交卷吗？`, '交卷确认', {
    type: 'warning'
  })
}

// 某道题的判分结果
function resultOf(id) {
  return results.value.find((r) => r.questionId === id)
}

// 全部问答题都已自评后才能完成评分
const allQAGraded = computed(() =>
  qaQuestions.value.every((q) => qaSelfGrade[q.id] !== undefined)
)

// 完成评分
async function onFinish() {
  finishing.value = true
  try {
    const qaResults = qaQuestions.value.map((q) => ({
      questionId: q.id,
      correct: !!qaSelfGrade[q.id]
    }))
    const res = await finishExam(exam.value.id, { qaResults })
    finalResult.value = res.data
    step.value = 'done'
    window.scrollTo(0, 0)
  } finally {
    finishing.value = false
  }
}

// 重新开始
function reset() {
  step.value = 'config'
  exam.value = null
  questions.value = []
  finalResult.value = null
  results.value = []
}
</script>

<template>
  <div>
    <!-- ============ 第 1 步：配置试卷 ============ -->
    <el-card v-if="step === 'config'" shadow="never">
      <h3 style="margin-top: 0">📝 生成一份测验卷</h3>
      <p class="tip">
        「语言+数学综合」从词库和公式库出题；「自定义科目」从通用模板的知识点条目出题。
        选择题给释义选单词/给名称选公式/给描述选条目，填空题默写，问答题讲述含义与应用。
      </p>
      <el-form label-width="120px" style="max-width: 520px">
        <el-form-item label="题目来源">
          <el-radio-group v-model="config.source">
            <el-radio-button value="general">语言 + 数学综合</el-radio-button>
            <el-radio-button value="custom" @change="loadCustomModules">自定义科目</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="config.source === 'custom'" label="选择科目">
          <el-select v-model="config.customModuleId" placeholder="选择科目" style="width: 240px">
            <el-option
              v-for="m in customModules"
              :key="m.id"
              :label="`${m.icon || '📚'} ${m.name}（${m.itemCount} 条）`"
              :value="m.id"
            />
          </el-select>
          <span v-if="customModules.length === 0" class="hint">还没有科目，请到「自定义学习 → 模板管理」创建</span>
        </el-form-item>
        <el-form-item label="选择题数量">
          <el-input-number v-model="config.choiceCount" :min="0" :max="20" />
        </el-form-item>
        <el-form-item label="填空题数量">
          <el-input-number v-model="config.blankCount" :min="0" :max="20" />
        </el-form-item>
        <el-form-item label="问答题数量">
          <el-input-number v-model="config.qaCount" :min="0" :max="10" />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="generating"
            :disabled="config.source === 'custom' && !config.customModuleId"
            @click="onGenerate"
          >
            开始考试
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- ============ 第 2 步：答题 ============ -->
    <template v-else-if="step === 'answering'">
      <el-card shadow="never">
        <h3 style="margin-top: 0">{{ exam.title }}</h3>
        <p class="tip">共 {{ questions.length }} 题 · 问答题请写下要点，交卷后对照参考答案自评</p>
      </el-card>

      <!-- 选择题 -->
      <el-card v-if="choiceQuestions.length" shadow="never" class="section">
        <h4>一、选择题（{{ choiceQuestions.length }} 题）</h4>
        <div v-for="(q, i) in choiceQuestions" :key="q.id" class="question">
          <div class="q-title">
            <el-tag size="small" :type="q.subject === 'math' ? 'warning' : 'primary'">
              {{ SUBJECT_NAMES[q.subject] }}
            </el-tag>
            {{ i + 1 }}. {{ q.content }}
          </div>
          <!-- 数学题的选项是 LaTeX，用 KaTeX 渲染；语言题直接显示文本 -->
          <el-radio-group v-model="answers[q.id]" class="options">
            <el-radio
              v-for="(opt, j) in optionList(q)"
              :key="j"
              :value="opt"
              class="option"
            >
              <span v-if="q.subject === 'math'" v-html="renderMath(opt, false)" />
              <span v-else>{{ opt }}</span>
            </el-radio>
          </el-radio-group>
        </div>
      </el-card>

      <!-- 填空题 -->
      <el-card v-if="blankQuestions.length" shadow="never" class="section">
        <h4>二、填空题（{{ blankQuestions.length }} 题）</h4>
        <div v-for="(q, i) in blankQuestions" :key="q.id" class="question">
          <div class="q-title">
            <el-tag size="small" type="primary">学语言</el-tag>
            {{ i + 1 }}. {{ q.content }}
          </div>
          <el-input
            v-model="answers[q.id]"
            placeholder="请输入答案"
            style="max-width: 320px"
          />
        </div>
      </el-card>

      <!-- 问答题 -->
      <el-card v-if="qaQuestions.length" shadow="never" class="section">
        <h4>三、问答题（{{ qaQuestions.length }} 题）</h4>
        <div v-for="(q, i) in qaQuestions" :key="q.id" class="question">
          <div class="q-title">
            <el-tag size="small" type="warning">学数学</el-tag>
            {{ i + 1 }}. {{ q.content }}
          </div>
          <el-input
            v-model="answers[q.id]"
            type="textarea"
            :rows="4"
            placeholder="写下你的解答要点……"
          />
        </div>
      </el-card>

      <div class="actions">
        <el-button size="large" type="primary" :loading="submitting" @click="onSubmit">
          交卷并查看结果
        </el-button>
      </div>
    </template>

    <!-- ============ 第 3 步：对答案 ============ -->
    <template v-else-if="step === 'grading'">
      <el-card shadow="never">
        <h3 style="margin-top: 0">✅ 客观题判分结果</h3>
        <p class="tip">
          选择题和填空题已自动判分；问答题请对照参考答案为自己评分。
        </p>
      </el-card>

      <el-card shadow="never" class="section">
        <div v-for="q in questions" :key="q.id" class="question">
          <div class="q-title">
            <el-tag size="small" :type="q.subject === 'math' ? 'warning' : 'primary'">
              {{ SUBJECT_NAMES[q.subject] }} · {{ TYPE_NAMES[q.qType] }}
            </el-tag>
            {{ q.content }}
          </div>

          <!-- 客观题：直接显示对错 -->
          <template v-if="q.qType !== 'qa'">
            <div class="verdict" :class="{ wrong: !resultOf(q.id)?.correct }">
              {{ resultOf(q.id)?.correct ? '✔ 回答正确' : '✘ 回答错误' }}
            </div>
            <div class="answer-box">
              <div>你的答案：{{ resultOf(q.id)?.userAnswer || '（未作答）' }}</div>
              <div>正确答案：{{ resultOf(q.id)?.answer }}</div>
              <div class="analysis">解析：{{ resultOf(q.id)?.analysis }}</div>
            </div>
          </template>

          <!-- 问答题：展示参考答案，自评对错 -->
          <template v-else>
            <div class="answer-box">
              <div>你的答案：{{ resultOf(q.id)?.userAnswer || '（未作答）' }}</div>
              <div class="analysis">参考答案：{{ resultOf(q.id)?.answer }}</div>
              <div class="analysis">评分要点：{{ resultOf(q.id)?.analysis }}</div>
            </div>
            <div class="self-grade">
              <span>对照参考答案，你答对了吗？</span>
              <el-button
                size="small"
                :type="qaSelfGrade[q.id] === true ? 'success' : 'default'"
                @click="qaSelfGrade[q.id] = true"
              >
                ✔ 答对了
              </el-button>
              <el-button
                size="small"
                :type="qaSelfGrade[q.id] === false ? 'danger' : 'default'"
                @click="qaSelfGrade[q.id] = false"
              >
                ✘ 没答好
              </el-button>
            </div>
          </template>
        </div>

        <div class="actions">
          <el-button
            size="large"
            type="primary"
            :disabled="!allQAGraded"
            :loading="finishing"
            @click="onFinish"
          >
            完成评分{{ qaQuestions.length && !allQAGraded ? '（请先完成问答题自评）' : '' }}
          </el-button>
        </div>
      </el-card>
    </template>

    <!-- ============ 第 4 步：成绩 ============ -->
    <el-card v-else-if="step === 'done'" shadow="never">
      <div class="score-wrap">
        <div class="score-num">{{ finalResult.score }}</div>
        <div class="score-label">分</div>
      </div>
      <p class="tip" style="text-align: center">
        共 {{ finalResult.total }} 题，答对 {{ finalResult.correctCount }} 题，
        其中 {{ finalResult.wrongCollected }} 道错题已自动收入错题本
      </p>
      <div class="actions">
        <el-button type="primary" @click="$router.push('/exam/wrong')">查看错题本</el-button>
        <el-button @click="$router.push('/exam/records')">考试记录</el-button>
        <el-button @click="reset">再来一场</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.tip {
  color: #909399;
  line-height: 1.8;
}

.hint {
  margin-left: 10px;
  color: #c0c4cc;
  font-size: 12px;
}

.section {
  margin-top: 16px;
}

.question {
  padding: 14px 0;
  border-bottom: 1px dashed #ebeef5;
}

.question:last-child {
  border-bottom: none;
}

.q-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.options {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.option {
  height: auto;
  padding: 4px 0;
  margin-right: 0;
}

.verdict {
  margin: 4px 0 6px;
  font-weight: bold;
  color: #67c23a;
}

.verdict.wrong {
  color: #f56c6c;
}

.answer-box {
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

.self-grade {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.score-wrap {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin: 24px 0 8px;
}

.score-num {
  font-size: 72px;
  font-weight: bold;
  color: #409eff;
}

.score-label {
  font-size: 20px;
  color: #909399;
  margin-left: 6px;
}
</style>
