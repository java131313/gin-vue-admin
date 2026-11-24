<script setup>
// AI 助手页面 —— 集成 Kimi（Moonshot AI）大模型的编程学习助手
//
// 工作方式：前端把整段对话记录发给后端 /api/ai/chat，
// 后端加上系统提示词后转发给 Kimi API，再把回复返回给前端。
// API Key 只存在于服务端，不会暴露给浏览器。
//
// 使用前需要配置：环境变量 KIMI_API_KEY（https://platform.moonshot.cn 申请）。
// 未配置时点击发送会收到明确的提示信息。
import { ref, nextTick } from 'vue'
import { chatAI } from '@/api/ai'

// messages：发给 Kimi 的完整对话记录（只含 user/assistant 角色）
const messages = ref([])
const input = ref('')
const sending = ref(false)
const listRef = ref(null) // 消息列表容器（用于自动滚动到底部）

// 快捷提问示例
const SUGGESTIONS = [
  '用 Python 写一个九九乘法表，并逐行注释',
  '什么是递归？用一个简单的例子解释一下',
  '帮我解释 HTTP 和 HTTPS 的区别',
  '写一个 JavaScript 函数，判断字符串是不是回文'
]

async function send(text) {
  const content = (text || input.value).trim()
  if (!content || sending.value) return

  // 1. 把用户消息加入对话记录并立即上屏
  messages.value.push({ role: 'user', content })
  input.value = ''
  sending.value = true
  scrollToBottom()

  try {
    // 2. 把整段对话发给后端，由后端代理调用 Kimi
    const res = await chatAI({ messages: messages.value })
    messages.value.push({ role: 'assistant', content: res.data.reply })
  } catch (e) {
    /* 错误信息已由拦截器提示（如未配置 API Key） */
    // 发送失败时把刚才那条用户消息撤回，方便重试
    messages.value.pop()
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function clearChat() {
  messages.value = []
}

// 新消息后自动滚动到底部
async function scrollToBottom() {
  await nextTick()
  if (listRef.value) {
    listRef.value.scrollTop = listRef.value.scrollHeight
  }
}
</script>

<template>
  <div class="chat-page">
    <!-- 消息列表 -->
    <div ref="listRef" class="msg-list">
      <!-- 空状态：显示欢迎语和快捷提问 -->
      <div v-if="messages.length === 0" class="welcome">
        <div class="welcome-icon">🤖</div>
        <h3>Kimi 编程学习助手</h3>
        <p class="welcome-tip">
          我是基于月之暗面 Kimi 大模型的 AI 助手，可以问我任何编程问题。
          <br />点击下方问题快速开始，或在底部输入框提问。
        </p>
        <div class="suggestions">
          <div v-for="s in SUGGESTIONS" :key="s" class="suggestion" @click="send(s)">
            {{ s }}
          </div>
        </div>
      </div>

      <!-- 消息气泡：用户靠右、助手靠左 -->
      <div v-for="(m, i) in messages" :key="i" class="msg-row" :class="m.role">
        <div class="bubble">{{ m.content }}</div>
      </div>

      <!-- 思考中的加载提示 -->
      <div v-if="sending" class="msg-row assistant">
        <div class="bubble thinking">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          Kimi 正在思考…
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-bar">
      <el-button :icon="'Delete'" circle title="清空对话" @click="clearChat" />
      <el-input
        v-model="input"
        type="textarea"
        :rows="2"
        resize="none"
        placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
        @keydown.enter.exact.prevent="send()"
      />
      <el-button type="primary" :loading="sending" :disabled="!input.trim()" @click="send()">
        发送
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px); /* 占满主区域高度（减去布局内边距） */
}

/* 消息列表：可滚动 */
.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
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

/* 消息行：用户靠右、助手靠左 */
.msg-row {
  display: flex;
  margin-bottom: 14px;
}

.msg-row.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 72%;
  padding: 10px 14px;
  border-radius: 10px;
  line-height: 1.8;
  font-size: 14px;
  white-space: pre-wrap; /* 保留换行（代码片段也靠它排版） */
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

/* 思考中的三个跳动小点 */
.thinking {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c0c4cc;
  animation: bounce 1.2s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

/* 输入区 */
.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 12px;
}

.input-bar :deep(.el-textarea__inner) {
  padding: 8px 12px;
}
</style>
