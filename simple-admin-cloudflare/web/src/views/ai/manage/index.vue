<script setup>
// AI 学习内容管理页面：历史/新闻/知识点/大模型的增删改查
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listAIContentsAdmin, createAIContent, updateAIContent, deleteAIContent } from '@/api/ai'

// 分类配置
const CATEGORIES = {
  history: { name: 'AI 历史' },
  news: { name: 'AI 新闻' },
  knowledge: { name: 'AI 知识点' },
  model: { name: '大模型' }
}

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 10, keyword: '', category: '' })

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const form = reactive({
  id: null,
  category: 'knowledge',
  title: '',
  summary: '',
  content: '',
  eventDate: '',
  tag: '',
  sort: 0
})

async function load() {
  loading.value = true
  try {
    const res = await listAIContentsAdmin(query)
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
    id: null, category: 'knowledge', title: '', summary: '',
    content: '', eventDate: '', tag: '', sort: 0
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
      await updateAIContent(form.id, { ...form })
      ElMessage.success('编辑成功')
    } else {
      await createAIContent({ ...form })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确定要删除「${row.title}」吗？`, '删除确认', { type: 'warning' })
  await deleteAIContent(row.id)
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
          <el-select v-model="query.category" clearable placeholder="全部分类" style="width: 130px" @change="onSearch">
            <el-option v-for="(cfg, key) in CATEGORIES" :key="key" :label="cfg.name" :value="key" />
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
          <el-button v-perm="'ai:create'" type="success" :icon="'Plus'" @click="openCreate">
            新增内容
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="分类" width="110" align="center">
          <template #default="{ row }">
            <el-tag type="info">{{ CATEGORIES[row.category]?.name || row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180">
          <template #default="{ row }"><b>{{ row.title }}</b></template>
        </el-table-column>
        <el-table-column prop="summary" label="简介" min-width="220" show-overflow-tooltip />
        <el-table-column prop="eventDate" label="日期" width="110" align="center" />
        <el-table-column prop="tag" label="标签" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.tag" size="small">{{ row.tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="70" align="center" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'ai:update'" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-perm="'ai:delete'" link type="danger" @click="onDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑内容' : '新增内容'" width="620px" top="4vh">
      <el-form label-width="90px">
        <el-form-item label="分类" required>
          <el-radio-group v-model="form.category">
            <el-radio-button v-for="(cfg, key) in CATEGORIES" :key="key" :value="key">
              {{ cfg.name }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="如：Transformer 与注意力机制" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.summary" placeholder="一句话简介（卡片上显示）" />
        </el-form-item>
        <el-form-item label="日期">
          <el-input v-model="form.eventDate" placeholder="如 1950 / 2024-05 / 2024年5月" style="width: 220px" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tag" placeholder="如 里程碑 / 开源 / 核心（可留空）" style="width: 220px" />
        </el-form-item>
        <el-form-item v-if="form.category === 'history'" label="排序号">
          <el-input-number v-model="form.sort" :min="0" />
          <span class="hint">时间线按排序号从小到大排列</span>
        </el-form-item>
        <el-form-item label="详细内容">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="7"
            placeholder="详细介绍，段落之间用一个空行分隔"
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

<style scoped>
.hint {
  margin-left: 10px;
  color: #c0c4cc;
  font-size: 12px;
}
</style>
