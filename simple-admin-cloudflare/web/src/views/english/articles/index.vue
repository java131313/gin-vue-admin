<script setup>
// 文章管理页面：阅读材料的增删改查
// 约定：正文（Content）和中文对照（ContentCN）都按空行分段，两边段落一一对应
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listArticles, createArticle, updateArticle, deleteArticle } from '@/api/article'

const LANG_NAMES = { en: '英语', ja: '日语' }

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 10, keyword: '', language: '' })

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const form = reactive({
  id: null,
  language: 'en',
  title: '',
  summary: '',
  tag: '',
  content: '',
  contentCN: ''
})

async function load() {
  loading.value = true
  try {
    const res = await listArticles(query)
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
    language: 'en',
    title: '',
    summary: '',
    tag: '',
    content: '',
    contentCN: ''
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
      await updateArticle(form.id, { ...form })
      ElMessage.success('编辑成功')
    } else {
      await createArticle({ ...form })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确定要删除文章《${row.title}》吗？`, '删除确认', {
    type: 'warning'
  })
  await deleteArticle(row.id)
  ElMessage.success('删除成功')
  load()
}

// 统计段落数（按空行拆分）
function paraCount(text) {
  return (text || '').split(/\n+/).filter((s) => s.trim()).length
}

onMounted(load)
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-form inline @submit.prevent>
        <el-form-item label="语言">
          <el-select v-model="query.language" clearable placeholder="全部语言" style="width: 120px" @change="onSearch">
            <el-option label="英语" value="en" />
            <el-option label="日语" value="ja" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="query.keyword"
            placeholder="标题 / 简介"
            clearable
            style="width: 220px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="'Search'" @click="onSearch">搜索</el-button>
          <el-button v-perm="'art:create'" type="success" :icon="'Plus'" @click="openCreate">
            新增文章
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="语言" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.language === 'ja' ? 'danger' : 'primary'">{{ LANG_NAMES[row.language] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180">
          <template #default="{ row }">
            <b>{{ row.title }}</b>
          </template>
        </el-table-column>
        <el-table-column prop="summary" label="简介" min-width="200" show-overflow-tooltip />
        <el-table-column label="段落数" width="90" align="center">
          <template #default="{ row }">{{ paraCount(row.content) }}</template>
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
            <el-button v-perm="'art:update'" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-perm="'art:delete'" link type="danger" @click="onDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑文章' : '新增文章'" width="640px" top="4vh">
      <el-form label-width="90px">
        <el-form-item label="语言">
          <el-radio-group v-model="form.language">
            <el-radio value="en">🇬🇧 英语</el-radio>
            <el-radio value="ja">🇯🇵 日语</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="文章标题" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.summary" placeholder="一句话简介，显示在阅读列表页（可留空）" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tag" placeholder="如：初级、科普、文化（可留空）" style="width: 220px" />
        </el-form-item>
        <el-form-item label="正文" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            placeholder="原文内容。段落之间用一个空行分隔，阅读页按段落对照显示"
          />
        </el-form-item>
        <el-form-item label="中文对照">
          <el-input
            v-model="form.contentCN"
            type="textarea"
            :rows="8"
            placeholder="中文翻译。段落数量和顺序要与上面正文一一对应（可留空）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
