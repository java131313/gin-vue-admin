<script setup>
// 课程内容管理通用组件 —— 学NodeJS / 学Vue / 学React 三个模块共用
// 通过 module 属性固定管理的模块，分类切换在组件内部
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listCourseContentsAdmin,
  createCourseContent,
  updateCourseContent,
  deleteCourseContent
} from '@/api/course'

const CATEGORIES = {
  basics: '基础知识',
  framework: '框架知识',
  code: '代码题'
}

// 本组件接收一个 module 属性
const props = defineProps({
  module: { type: String, required: true }
})

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 10, keyword: '', category: '' })

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const form = reactive({
  id: null,
  module: props.module,
  category: 'basics',
  title: '',
  summary: '',
  content: '',
  code: '',
  tag: '',
  difficulty: '',
  sort: 0
})

async function load() {
  loading.value = true
  try {
    const res = await listCourseContentsAdmin({ ...query, module: props.module })
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
    id: null, module: props.module, category: 'basics', title: '',
    summary: '', content: '', code: '', tag: '', difficulty: '', sort: 0
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
      await updateCourseContent(form.id, { ...form })
      ElMessage.success('编辑成功')
    } else {
      await createCourseContent({ ...form })
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
  await deleteCourseContent(row.id)
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
            <el-option v-for="(name, key) in CATEGORIES" :key="key" :label="name" :value="key" />
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
          <el-button v-perm="'course:create'" type="success" :icon="'Plus'" @click="openCreate">
            新增内容
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="分类" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="info">{{ CATEGORIES[row.category] || row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="170">
          <template #default="{ row }"><b>{{ row.title }}</b></template>
        </el-table-column>
        <el-table-column prop="summary" label="简介" min-width="200" show-overflow-tooltip />
        <el-table-column label="难度" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.difficulty" size="small" :type="{ 简单: 'success', 中等: 'warning', 困难: 'danger' }[row.difficulty] || 'info'">
              {{ row.difficulty }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="tag" label="标签" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.tag" type="info" size="small">{{ row.tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="70" align="center" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'course:update'" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-perm="'course:delete'" link type="danger" @click="onDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑内容' : '新增内容'" width="640px" top="4vh">
      <el-form label-width="90px">
        <el-form-item label="分类" required>
          <el-radio-group v-model="form.category">
            <el-radio-button v-for="(name, key) in CATEGORIES" :key="key" :value="key">
              {{ name }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="如：切片 slice / 防抖函数" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.summary" placeholder="一句话简介（卡片上显示）" />
        </el-form-item>
        <el-form-item v-if="form.category === 'code'" label="难度">
          <el-radio-group v-model="form.difficulty">
            <el-radio-button value="简单">简单</el-radio-button>
            <el-radio-button value="中等">中等</el-radio-button>
            <el-radio-button value="困难">困难</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tag" placeholder="如 并发 / Hook / 数组（可留空）" style="width: 240px" />
        </el-form-item>
        <el-form-item label="排序号">
          <el-input-number v-model="form.sort" :min="0" />
          <span class="hint">列表按排序号从小到大排列</span>
        </el-form-item>
        <el-form-item label="讲解/题目">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            placeholder="基础知识/框架：讲解正文；代码题：题目描述。段落之间用一个空行分隔"
          />
        </el-form-item>
        <el-form-item label="代码">
          <el-input
            v-model="form.code"
            type="textarea"
            :rows="10"
            class="code-input"
            placeholder="示例代码 / 参考代码"
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

.code-input :deep(textarea) {
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
}
</style>
