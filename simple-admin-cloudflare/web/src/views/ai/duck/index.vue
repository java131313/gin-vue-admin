<script setup>
// Duck.ai AI 问答 —— 匿名免登录的 AI 聊天（GPT-4o mini / Claude Haiku / Llama / Mistral）
//
// 每次提问由后端代理调用 Duck.ai，问题和答案自动存档（ai_chats 表）；
// 左侧是历史记录，可按「学XX」主题过滤；每条问答都能归类到某个学习主题，
// 作为该主题的信息源积累。匿名额度有限：每用户每天 20 条。
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDuckaiModels, askDuckai, getDuckaiChats, classifyDuckaiChat, deleteDuckaiChat } from '@/api/duckai'
import { getCustomModules } from '@/api/custom'

const models = ref([]) // Duck.ai 可选模型
const model = ref('') // 当前选择的模型
const modules = ref([]) // 「学XX」主题（归类用）
const question = ref('')
const sending = ref(false)
const remaining = ref(null) // 今日剩余提问次数
const current = ref(null) // 当前查看的问答（历史点击或新提问）

// 历史列表
const history = ref([])
const total = ref(0)
const page = ref(1)
const filterModuleId = ref(0) // 0 全部 / -1 未归类 / >0 某主题
const loadingHistory = ref(false)

// 快捷提问示例
const SUGGESTIONS = [
  '用一句话解释什么是 Docker 容器',
  'Kubernetes 的 Pod 是什么？',
  'TCP 为什么需要三次握手？',
  '什么是闭包？举个 JavaScript 例子'
]

async function loadModels() {
  const res = await getDuckaiModels()
  models.value = res.data
  model.value = res.data[0]?.id || ''
}

async function loadModules() {
  const res = await getCustomModules()
  modules.value = res.data
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    const res = await getDuckaiChats({ page: page.value, pageSize: 20, moduleId: filterModuleId.value })
    history.value = res.data.list
    total.value = res.data.total
  } finally {
    loadingHistory.value = false
  }
}

function switchFilter(id) {
  filterModuleId.value = id
  page.value = 1
  loadHistory()
}

function showChat(row) {
  current.value = row
}

// 提问：存档在服务端完成，成功后把新记录插到历史最前面
async function send(text) {
  const q = (text || question.value).trim()
  if (!q || sending.value) return
  question.value = ''
  sending.value = true
  try {
    const res = await askDuckai({ question: q, model: model.value })
    remaining.value = res.data.remaining
    const mod = modules.value.find((m) => m.id === res.data.moduleId)
    const row = {
      id: res.data.id,
      question: q,
      answer: res.data.answer,
      model: res.data.model,
      status: 'ok',
      created_at: new Date().toISOString(),
      module_id: res.data.moduleId || null,
      module_name: mod?.name || null
    }
    current.value = row
    // 当前过滤条件下看不到这条时（比如在主题过滤视图里），刷新列表
    if (filterModuleId.value === 0 || filterModuleId.value === -1) {
      history.value.unshift(row)
      total.value++
    } else {
      loadHistory()
    }
  } catch {
    /* 错误已由拦截器提示；失败记录也存了档，刷新历史可见原因 */
    loadHistory()
  } finally {
    sending.value = false
  }
}

// 归类到「学XX」主题（当前查看的这条）
async function classify(row, moduleId) {
  await classifyDuckaiChat(row.id, { moduleId: moduleId || null })
  row.module_id = moduleId || null
  row.module_name = modules.value.find((m) => m.id === moduleId)?.name || null
  ElMessage.success(moduleId ? '已归类到「' + row.module_name + '」' : '已取消归类')
  loadHistory() // 过滤视图下该行可能应该消失
}

async function remove(row) {
  await ElMessageBox.confirm('确定删除这条问答记录吗？', '删除确认', { type: 'warning' })
  await deleteDuckaiChat(row.id)
  ElMessage.success('已删除')
  if (current.value?.id === row.id) current.value = null
  loadHistory()
}

// 时间格式化（ISO → 本地可读）
function fmtTime(t) {
  if (!t) return ''
  const d = new Date(t.replace(' ', 'T') + (t.includes('Z') || t.includes('+') ? '' : 'Z'))
  return isNaN(d) ? t : d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  loadModels()
  loadModules()
  loadHistory()
})
</script>

<template>
  <div class="duck-page">
    <!-- 左侧：历史记录 -->
    <div class="side">
      <div class="side-head">
        <span class="side-title">问答历史</span>
        <el-select
          :model-value="filterModuleId"
          size="small"
          class="filter"
          placeholder="全部"
          @change="switchFilter"
        >
          <el-option label="全部" :value="0" />
          <el-option label="未归类" :value="-1" />
          <el-option v-for="m in modules" :key="m.id" :label="m.icon + ' ' + m.name" :value="m.id" />
        </el-select>
      </div>

      <div v-loading="loadingHistory" class="side-list">
        <div
          v-for="row in history"
          :key="row.id"
          class="side-item"
          :class="{ active: current?.id === row.id }"
          @click="showChat(row)"
        >
          <div class="side-q">{{ row.question }}</div>
          <div class="side-meta">
            <span v-if="row.module_name" class="tag mod">{{ row.module_icon }} {{ row.module_name }}</span>
            <span v-else class="tag none">未归类</span>
            <span v-if="row.status === 'error'" class="tag err">失败</span>
            <span class="time">{{ fmtTime(row.created_at) }}</span>
          </div>
        </div>
        <el-empty v-if="!loadingHistory && history.length === 0" description="还没有问答记录" :image-size="60" />
      </div>

      <div v-if="total > 20" class="side-pager">
        <el-pagination
          v-model:current-page="page"
          layout="prev, pager, next"
          :total="total"
          :page-size="20"
          small
          @current-change="loadHistory"
        />
      </div>
    </div>

    <!-- 右侧：对话区 -->
    <div class="main">
      <div class="toolbar">
        <el-select v-model="model" size="small" class="model-select">
          <el-option v-for="m in models" :key="m.id" :label="m.name" :value="m.id" />
        </el-select>
        <span v-if="remaining !== null" class="remaining">今日剩余 {{ remaining }} 次</span>
        <span class="spacer" />
        <template v-if="current">
          <el-select
            :model-value="current.module_id || ''"
            size="small"
            class="classify"
            placeholder="归类到学的主题…"
            clearable
            @change="classify(current, $event)"
          >
            <el-option v-for="m in modules" :key="m.id" :label="m.icon + ' ' + m.name" :value="m.id" />
          </el-select>
          <el-button size="small" type="danger" plain :icon="'Delete'" @click="remove(current)">删除</el-button>
        </template>
      </div>

      <!-- 当前问答详情 -->
      <div class="dialog">
        <template v-if="current">
          <div class="msg-row user">
            <div class="bubble">{{ current.question }}</div>
          </div>
          <div class="msg-row assistant">
            <div class="bubble" :class="{ err: current.status === 'error' }">
              {{ current.status === 'error' ? current.error : current.answer }}
            </div>
          </div>
        </template>

        <!-- 空状态 -->
        <div v-else class="welcome">
          <div class="welcome-icon">🦆</div>
          <h3>Duck.ai 匿名 AI 问答</h3>
          <p class="welcome-tip">
            基于 DuckDuckGo AI 的免费问答，无需任何 API Key；问题和答案自动存档，
            <br />可归类到左侧「学的主题」做信息源积累。每人每天限 20 次。
            <br /><span class="warn">注意：Duck.ai 近期加强了人机验证，回答可能失败——失败原因会存档在历史里。</span>
          </p>
          <div class="suggestions">
            <div v-for="s in SUGGESTIONS" :key="s" class="suggestion" @click="send(s)">{{ s }}</div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="input-bar">
        <el-input
          v-model="question"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
          @keydown.enter.exact.prevent="send()"
        />
        <el-button type="primary" :loading="sending" :disabled="!question.trim()" @click="send()">
          提问
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.duck-page {
  display: flex;
  gap: 12px;
  height: calc(100vh - 140px);
}

/* ---------- 左侧历史 ---------- */
.side {
  width: 300px;
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

.filter {
  width: 140px;
}

.side-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.side-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}

.side-item:hover {
  background: #f5f7fa;
}

.side-item.active {
  background: #ecf5ff;
}

.side-q {
  font-size: 13px;
  color: #303133;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.side-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
}

.tag {
  padding: 0 6px;
  border-radius: 4px;
  line-height: 18px;
}

.tag.mod {
  background: #ecf5ff;
  color: #409eff;
}

.tag.none {
  background: #f4f4f5;
  color: #909399;
}

.tag.err {
  background: #fef0f0;
  color: #f56c6c;
}

.time {
  color: #c0c4cc;
  margin-left: auto;
}

.side-pager {
  padding: 8px;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: center;
}

/* ---------- 右侧对话 ---------- */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.model-select {
  width: 220px;
}

.classify {
  width: 200px;
}

.remaining {
  font-size: 12px;
  color: #e6a23c;
}

.spacer {
  flex: 1;
}

.dialog {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.msg-row {
  display: flex;
  margin-bottom: 14px;
}

.msg-row.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 10px;
  line-height: 1.8;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-row.user .bubble {
  background: #409eff;
  color: #fff;
}

.msg-row.assistant .bubble {
  background: #f4f4f5;
  color: #303133;
}

.bubble.err {
  background: #fef0f0;
  color: #f56c6c;
}

/* 欢迎区 */
.welcome {
  text-align: center;
  padding: 48px 20px;
}

.welcome-icon {
  font-size: 48px;
}

.welcome-tip {
  color: #909399;
  line-height: 1.9;
  margin: 12px 0 24px;
}

.welcome-tip .warn {
  color: #e6a23c;
  font-size: 13px;
}

.suggestions {
  max-width: 560px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.suggestion {
  padding: 10px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  transition: all 0.2s;
}

.suggestion:hover {
  border-color: #409eff;
  color: #409eff;
}

/* 输入区 */
.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 12px;
}

/* 移动端：隐藏左侧历史栏，归入口换行 */
@media (max-width: 768px) {
  .duck-page {
    flex-direction: column;
    height: auto;
  }

  .side {
    width: 100%;
    max-height: 240px;
  }

  .model-select {
    width: 150px;
  }

  .classify {
    width: 140px;
  }

  .bubble {
    max-width: 92%;
  }
}
</style>
