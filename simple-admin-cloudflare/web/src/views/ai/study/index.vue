<script setup>
// AI 学习页面 —— 四个分类，四种展示方式：
//   AI 历史   → 时间线（从早到晚）
//   AI 新闻   → 新闻卡片列表（新的在前）
//   AI 知识点 → 卡片网格 + 详情抽屉
//   大模型    → 卡片网格 + 详情抽屉
import { ref, watch } from 'vue'
import { getAIContents } from '@/api/ai'

// 分类配置：key → 显示名 + 展示方式
const CATEGORIES = {
  history: { name: '📜 AI 历史', display: 'timeline' },
  news: { name: '📰 AI 新闻', display: 'news' },
  knowledge: { name: '💡 AI 知识点', display: 'cards' },
  model: { name: '🤖 大模型', display: 'cards' }
}

const category = ref('history')
const loading = ref(false)
const list = ref([])

// 详情抽屉（知识点 / 大模型）
const drawer = ref(false)
const active = ref(null)

async function load() {
  loading.value = true
  try {
    const res = await getAIContents({ category: category.value })
    list.value = res.data
  } finally {
    loading.value = false
  }
}

function openDetail(item) {
  active.value = item
  drawer.value = true
}

// 正文按空行分段
function toParagraphs(text) {
  return (text || '').split(/\n+/).filter((s) => s.trim())
}

// 切换分类时重新加载；初次进入也触发
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
    </el-card>

    <!-- ================= AI 历史：时间线 ================= -->
    <el-card v-if="CATEGORIES[category].display === 'timeline'" v-loading="loading" shadow="never" class="section">
      <el-timeline style="padding-left: 4px">
        <el-timeline-item
          v-for="item in list"
          :key="item.id"
          :timestamp="item.eventDate"
          placement="top"
          type="primary"
        >
          <h4 class="item-title">
            {{ item.title }}
            <el-tag v-if="item.tag" type="info" size="small">{{ item.tag }}</el-tag>
          </h4>
          <p v-for="(p, i) in toParagraphs(item.content)" :key="i" class="item-para">{{ p }}</p>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <!-- ================= AI 新闻：新闻列表 ================= -->
    <el-card v-else-if="CATEGORIES[category].display === 'news'" v-loading="loading" shadow="never" class="section">
      <div v-for="item in list" :key="item.id" class="news-item">
        <div class="news-date">{{ item.eventDate }}</div>
        <div class="news-body">
          <h4 class="item-title">
            {{ item.title }}
            <el-tag v-if="item.tag" type="warning" size="small">{{ item.tag }}</el-tag>
          </h4>
          <p class="news-summary">{{ item.summary }}</p>
          <p v-for="(p, i) in toParagraphs(item.content)" :key="i" class="item-para">{{ p }}</p>
        </div>
      </div>
      <el-empty v-if="!loading && list.length === 0" description="暂无新闻，管理员可在「内容管理」中添加" />
    </el-card>

    <!-- ================= 知识点 / 大模型：卡片网格 ================= -->
    <template v-else>
      <div v-loading="loading" class="card-grid">
        <el-card v-for="item in list" :key="item.id" shadow="hover" class="item-card" @click="openDetail(item)">
          <div class="card-title">{{ item.title }}</div>
          <div class="card-summary">{{ item.summary }}</div>
          <div class="card-footer">
            <el-tag v-if="item.tag" type="info" size="small">{{ item.tag }}</el-tag>
            <el-tag v-if="item.eventDate" size="small">{{ item.eventDate }}</el-tag>
            <span class="more">查看详情 →</span>
          </div>
        </el-card>
      </div>
      <el-empty v-if="!loading && list.length === 0" description="该分类下暂无内容" />

      <!-- 详情抽屉 -->
      <el-drawer v-model="drawer" size="520px">
        <template #header>
          <span v-if="active" class="drawer-title">
            {{ active.title }}
            <el-tag v-if="active.tag" type="info" size="small">{{ active.tag }}</el-tag>
            <el-tag v-if="active.eventDate" size="small">{{ active.eventDate }}</el-tag>
          </span>
        </template>
        <template v-if="active">
          <p v-for="(p, i) in toParagraphs(active.content)" :key="i" class="item-para">{{ p }}</p>
        </template>
      </el-drawer>
    </template>
  </div>
</template>

<style scoped>
.section {
  margin-top: 16px;
}

.item-title {
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-para {
  margin: 6px 0;
  line-height: 1.9;
  color: #606266;
  white-space: pre-wrap;
}

/* 新闻 */
.news-item {
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px dashed #ebeef5;
}

.news-item:last-child {
  border-bottom: none;
}

.news-date {
  flex-shrink: 0;
  width: 80px;
  font-weight: bold;
  color: #409eff;
}

.news-body {
  flex: 1;
}

.news-summary {
  margin: 4px 0;
  color: #303133;
  font-weight: 500;
}

/* 卡片网格 */
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
</style>
