<script setup>
// 公式管理页面：数学公式的增删改查
//
// Formula 字段填 LaTeX 语法（如 a^2 + b^2 = c^2），
// 对话框里有实时预览，边写边看渲染效果。
import { reactive, ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listFormulas, createFormula, updateFormula, deleteFormula } from '@/api/formula'
import { renderMath } from '@/utils/katex'

const CATEGORY_NAMES = { algebra: '代数', geometry: '几何' }

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 10, keyword: '', category: '' })

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const form = reactive({
  id: null,
  category: 'algebra',
  name: '',
  formula: '',
  content: '',
  application: '',
  tag: ''
})

// 公式输入的实时预览（computed 自动跟随输入变化）
const preview = computed(() => renderMath(form.formula))

async function load() {
  loading.value = true
  try {
    const res = await listFormulas(query)
    rows.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function onSearch() {
  query.page = 1
  load()
}

function openCreate() {
  isEdit.value = false
  Object.assign(form, {
    id: null,
    category: 'algebra',
    name: '',
    formula: '',
    content: '',
    application: '',
    tag: ''
  })
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  Object.assign(form, { ...row })
  dialogVisible.value = true
}

async function onSubmit() {
  saving.value = true
  try {
    if (isEdit.value) {
      await updateFormula(form.id, { ...form })
      ElMessage.success('编辑成功')
    } else {
      await createFormula({ ...form })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确定要删除公式「${row.name}」吗？`, '删除确认', {
    type: 'warning'
  })
  await deleteFormula(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-form inline @submit.prevent>
        <el-form-item label="分类">
          <el-select v-model="query.category" clearable placeholder="全部分类" style="width: 120px" @change="onSearch">
            <el-option label="代数" value="algebra" />
            <el-option label="几何" value="geometry" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="query.keyword"
            placeholder="公式名称 / 讲解"
            clearable
            style="width: 220px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="'Search'" @click="onSearch">搜索</el-button>
          <el-button v-perm="'formula:create'" type="success" :icon="'Plus'" @click="openCreate">
            新增公式
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="分类" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.category === 'geometry' ? 'warning' : 'primary'">
              {{ CATEGORY_NAMES[row.category] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="公式名称" min-width="160">
          <template #default="{ row }">
            <b>{{ row.name }}</b>
          </template>
        </el-table-column>
        <!-- 公式列：KaTeX 实时渲染（行内模式，不居中） -->
        <el-table-column label="公式" min-width="180">
          <template #default="{ row }">
            <span class="cell-math" v-html="renderMath(row.formula, false)" />
          </template>
        </el-table-column>
        <el-table-column prop="tag" label="标签" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.tag" type="info">{{ row.tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="120">
          <template #default="{ row }">{{ new Date(row.updatedAt).toLocaleDateString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'formula:update'" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-perm="'formula:delete'" link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="load"
        @size-change="onSearch"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑公式' : '新增公式'" width="640px" top="4vh">
      <el-form label-width="90px">
        <el-form-item label="分类">
          <el-radio-group v-model="form.category">
            <el-radio value="algebra">📐 代数</el-radio>
            <el-radio value="geometry">📏 几何</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="公式名称" required>
          <el-input v-model="form.name" placeholder="如：勾股定理" />
        </el-form-item>
        <el-form-item label="公式" required>
          <el-input
            v-model="form.formula"
            placeholder="LaTeX 语法，如：a^2 + b^2 = c^2 或 S = \pi r^2"
          />
        </el-form-item>
        <!-- 实时预览：输入时立即看到渲染效果 -->
        <el-form-item label="效果预览">
          <div class="preview-box" v-html="preview" />
        </el-form-item>
        <el-form-item label="讲解" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="5"
            placeholder="公式的含义、符号说明、推导思路。段落之间用一个空行分隔"
          />
        </el-form-item>
        <el-form-item label="应用例题">
          <el-input
            v-model="form.application"
            type="textarea"
            :rows="5"
            placeholder="典型例题和完整解答（可留空），段落之间用一个空行分隔"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tag" placeholder="如：初中、高中（可留空）" style="width: 220px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.cell-math {
  font-size: 15px;
}

.preview-box {
  min-height: 48px;
  padding: 10px 16px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 18px;
  overflow-x: auto;
  width: 100%;
}
</style>
