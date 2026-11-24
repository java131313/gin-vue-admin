<script setup>
// 阅读练习页面：双语对照阅读 + 生词收藏
//
// 两种模式：
//   列表模式：按语言筛选文章卡片，点击进入阅读
//   阅读模式：原文段落在上、中文对照在下逐段对齐；
//            用鼠标选中任意单词 → 点「收藏生词」→ 弹出对话框（自动带入所在例句）→ 存入词库
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getReadingList, getArticle, collectWord } from '@/api/article'

const LANG_NAMES = { en: '英语', ja: '日语' }

// ---------- 列表模式 ----------
const loading = ref(false)
const articles = ref([])
const total = ref(0)
const query = reactive({ page: 1, size: 12, language: 'all' })

// ---------- 阅读模式 ----------
const article = ref(null) // 当前阅读的文章（含正文）
const reading = ref(false) // true=阅读模式，false=列表模式

// 段落对照：原文和中文都按空行拆分成数组，按下标一一对齐
const paragraphs = computed(() => {
  if (!article.value) return []
  const originals = article.value.content.split(/\n+/).filter((s) => s.trim())
  const translated = (article.value.contentCN || '').split(/\n+/).filter((s) => s.trim())
  return originals.map((text, i) => ({
    text, // 原文段落
    cn: translated[i] || '' // 对应的中文段落（没有则空）
  }))
})

// ---------- 生词收藏 ----------
const selection = ref('') // 当前鼠标选中的文字
const collectVisible = ref(false)
const savingWord = ref(false)
const collectForm = reactive({
  language: 'en',
  word: '',
  phonetic: '',
  meaning: '',
  example: '',
  exampleCN: '',
  tag: ''
})

async function load() {
  loading.value = true
  try {
    const res = await getReadingList(query)
    articles.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

// 打开文章进入阅读模式
async function openArticle(id) {
  const res = await getArticle(id)
  article.value = res.data
  reading.value = true
  selection.value = ''
  window.scrollTo(0, 0)
}

function backToList() {
  reading.value = false
  article.value = null
  load() // 回到列表时刷新（可能有新收藏/新增文章）
}

// 监听正文上的鼠标抬起事件：读取用户选中的文字（选中单个单词或短语）
function onMouseUp() {
  const sel = window.getSelection().toString().trim()
  // 太长的选中（比如整段）不认为是查词，忽略
  selection.value = sel && sel.length <= 30 ? sel : ''
}

// 从段落中找出包含目标词的例句（按 。！？.!? 切句），找不到就用整个段落
function findSentence(paragraph, word) {
  const sentences = paragraph.match(/[^。！？.!?]+[。！？.!?]*/g) || [paragraph]
  const hit = sentences.find((s) => s.includes(word))
  return (hit || paragraph).trim().slice(0, 200)
}

// 打开收藏对话框：预填语言、单词、所在例句
function openCollect() {
  if (!selection.value) return
  const text = selection.value
  collectForm.language = article.value.language
  collectForm.word = text
  collectForm.phonetic = ''
  collectForm.meaning = ''
  collectForm.tag = article.value.tag || ''
  // 找包含选中词的段落，把所在句子作为例句，整段中文作为例句翻译
  const para = paragraphs.value.find((p) => p.text.includes(text))
  collectForm.example = para ? findSentence(para.text, text) : ''
  collectForm.exampleCN = para ? para.cn : ''
  collectVisible.value = true
}

// 确认收藏：调用后端（单词已存在时后端会标记 exists=true）
async function onCollectSubmit() {
  savingWord.value = true
  try {
    const res = await collectWord({ ...collectForm })
    if (res.data.exists) {
      ElMessage.info(`「${collectForm.word}」已在词库中，去背单词页复习吧`)
    } else {
      ElMessage.success(`已收藏「${collectForm.word}」🎉，去背单词页学习吧`)
    }
    collectVisible.value = false
    selection.value = ''
    window.getSelection().removeAllRanges() // 清除页面上的选中高亮
  } finally {
    savingWord.value = false
  }
}

load()
</script>

<template>
  <div>
    <!-- ================= 阅读模式 ================= -->
    <template v-if="reading && article">
      <el-card shadow="never">
        <div class="reader-header">
          <el-button :icon="'Back'" @click="backToList">返回列表</el-button>
          <h2 class="reader-title">
            {{ article.title }}
            <el-tag :type="article.language === 'ja' ? 'danger' : 'primary'" size="small">
              {{ LANG_NAMES[article.language] }}
            </el-tag>
            <el-tag v-if="article.tag" type="info" size="small">{{ article.tag }}</el-tag>
          </h2>
          <!-- 选中文字后可点击：把选中的生词收藏进词库 -->
          <el-button
            type="warning"
            :icon="'Star'"
            :disabled="!selection"
            @click="openCollect"
          >
            收藏生词{{ selection ? `「${selection}」` : '' }}
          </el-button>
        </div>
        <div v-if="!selection" class="select-hint">💡 用鼠标选中文章里的单词，即可收藏为生词</div>
      </el-card>

      <!-- 正文：逐段对照（原文 + 中文） -->
      <el-card shadow="never" style="margin-top: 16px" @mouseup="onMouseUp">
        <div v-for="(p, i) in paragraphs" :key="i" class="para-block">
          <p class="para-original">{{ p.text }}</p>
          <p v-if="p.cn" class="para-cn">{{ p.cn }}</p>
        </div>
      </el-card>
    </template>

    <!-- ================= 列表模式 ================= -->
    <template v-else>
      <el-card shadow="never">
        <el-radio-group v-model="query.language" @change="query.page = 1; load()">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="en">🇬🇧 英语</el-radio-button>
          <el-radio-button value="ja">🇯🇵 日语</el-radio-button>
        </el-radio-group>
      </el-card>

      <div v-loading="loading" class="article-grid">
        <el-card
          v-for="a in articles"
          :key="a.id"
          shadow="hover"
          class="article-card"
          @click="openArticle(a.id)"
        >
          <div class="article-title">
            {{ a.title }}
            <el-tag :type="a.language === 'ja' ? 'danger' : 'primary'" size="small">
              {{ LANG_NAMES[a.language] }}
            </el-tag>
          </div>
          <div v-if="a.summary" class="article-summary">{{ a.summary }}</div>
          <div class="article-meta">
            <el-tag v-if="a.tag" type="info" size="small">{{ a.tag }}</el-tag>
            <span class="article-date">{{ new Date(a.updatedAt).toLocaleDateString() }}</span>
          </div>
        </el-card>
      </div>
      <el-empty v-if="!loading && articles.length === 0" description="该语言下还没有文章，请在「文章管理」中添加" />

      <el-pagination
        v-if="total > query.size"
        v-model:current-page="query.page"
        :page-size="query.size"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top: 16px; justify-content: center"
        @current-change="load"
      />
    </template>

    <!-- 收藏生词对话框 -->
    <el-dialog v-model="collectVisible" title="收藏生词" width="520px">
      <el-form label-width="90px">
        <el-form-item label="单词" required>
          <el-input v-model="collectForm.word" placeholder="选中的生词（可修改）" />
        </el-form-item>
        <el-form-item label="音标/读音">
          <el-input v-model="collectForm.phonetic" placeholder="可留空，以后在词库里补" />
        </el-form-item>
        <el-form-item label="释义" required>
          <el-input v-model="collectForm.meaning" placeholder="这个单词是什么意思？" />
        </el-form-item>
        <el-form-item label="例句">
          <el-input v-model="collectForm.example" type="textarea" :rows="2" placeholder="已自动带入文章中的句子" />
        </el-form-item>
        <el-form-item label="例句翻译">
          <el-input v-model="collectForm.exampleCN" type="textarea" :rows="2" placeholder="已自动带入对应中文段落" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="collectVisible = false">取 消</el-button>
        <el-button type="primary" :loading="savingWord" @click="onCollectSubmit">收藏到词库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 列表模式：文章卡片网格 */
.article-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.article-card {
  cursor: pointer;
}

.article-title {
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 6px;
}

.article-summary {
  margin-top: 8px;
  color: #666;
  font-size: 14px;
  line-height: 1.6;
}

.article-meta {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.article-date {
  color: #aaa;
  font-size: 12px;
}

/* 阅读模式 */
.reader-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.reader-title {
  margin: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-hint {
  margin-top: 10px;
  color: #909399;
  font-size: 13px;
}

.para-block {
  margin-bottom: 22px;
}

.para-original {
  font-size: 18px;
  line-height: 1.9;
  margin: 0;
  color: #303133;
}

/* 中文对照：灰色小字跟在原文下面 */
.para-cn {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.8;
  color: #909399;
}
</style>
