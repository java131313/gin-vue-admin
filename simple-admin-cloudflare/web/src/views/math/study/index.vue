<script setup>
// 公式学习页面：按「代数 / 几何」分类浏览数学公式
//
// 布局：顶部分类切换 + 公式卡片网格；
//      点击卡片从右侧滑出详情抽屉：渲染好的公式 + 讲解 + 应用例题。
import { ref, onMounted } from 'vue'
import { getMathFormulas } from '@/api/math'
import { renderMath } from '@/utils/katex'

const CATEGORY_NAMES = { algebra: '代数', geometry: '几何' }

const category = ref('algebra') // 当前分类：algebra / geometry
const loading = ref(false)
const formulas = ref([])

// 详情抽屉
const drawer = ref(false)
const active = ref(null)

async function load() {
  loading.value = true
  try {
    const res = await getMathFormulas({ category: category.value })
    formulas.value = res.data
  } finally {
    loading.value = false
  }
}

// 打开公式详情
function openFormula(f) {
  active.value = f
  drawer.value = true
}

// 讲解 / 应用 按空行分段显示
function toParagraphs(text) {
  return (text || '').split(/\n+/).filter((s) => s.trim())
}

onMounted(load)
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-radio-group v-model="category" @change="load">
        <el-radio-button value="algebra">📐 代数</el-radio-button>
        <el-radio-button value="geometry">📏 几何</el-radio-button>
      </el-radio-group>
      <span class="count-hint">共 {{ formulas.length }} 个公式</span>
    </el-card>

    <!-- 公式卡片网格 -->
    <div v-loading="loading" class="formula-grid">
      <el-card
        v-for="f in formulas"
        :key="f.id"
        shadow="hover"
        class="formula-card"
        @click="openFormula(f)"
      >
        <div class="formula-name">{{ f.name }}</div>
        <!-- KaTeX 渲染公式预览（块级居中） -->
        <div class="formula-preview" v-html="renderMath(f.formula)" />
        <div class="formula-footer">
          <el-tag v-if="f.tag" type="info" size="small">{{ f.tag }}</el-tag>
          <span class="more">查看讲解 →</span>
        </div>
      </el-card>
    </div>
    <el-empty v-if="!loading && formulas.length === 0" description="该分类下还没有公式" />

    <!-- 公式详情抽屉 -->
    <el-drawer v-model="drawer" size="560px">
      <template #header>
        <span v-if="active" class="drawer-title">
          {{ active.name }}
          <el-tag :type="active.category === 'geometry' ? 'warning' : 'primary'" size="small">
            {{ CATEGORY_NAMES[active.category] }}
          </el-tag>
          <el-tag v-if="active.tag" type="info" size="small">{{ active.tag }}</el-tag>
        </span>
      </template>

      <template v-if="active">
        <!-- 渲染好的完整公式 -->
        <div class="drawer-formula" v-html="renderMath(active.formula)" />

        <h3 class="section-title">📖 公式讲解</h3>
        <p v-for="(p, i) in toParagraphs(active.content)" :key="'c' + i" class="section-para">
          {{ p }}
        </p>

        <template v-if="active.application">
          <h3 class="section-title">💡 应用例题</h3>
          <p v-for="(p, i) in toParagraphs(active.application)" :key="'a' + i" class="section-para">
            {{ p }}
          </p>
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

/* 公式卡片网格 */
.formula-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.formula-card {
  cursor: pointer;
}

.formula-name {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

/* 公式预览：限制高度，防止超长公式撑破卡片 */
.formula-preview {
  margin: 12px 0;
  font-size: 15px;
  overflow-x: auto;
  color: #303133;
}

.formula-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.more {
  color: #409eff;
  font-size: 13px;
}

/* 抽屉里的完整公式：放大居中 */
.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.drawer-formula {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  font-size: 20px;
  overflow-x: auto;
}

.section-title {
  margin: 24px 0 8px;
  font-size: 16px;
}

.section-para {
  margin: 8px 0;
  line-height: 1.9;
  color: #606266;
  white-space: pre-wrap;
}
</style>
