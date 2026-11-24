<script setup>
// 词库管理页面：单词卡片的增删改查
// 按钮权限：v-perm="'word:create'" 等（与后端 RequirePerm 对应，双重校验）
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listWords, createWord, updateWord, deleteWord } from '@/api/word'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
// language 为空 = 查看全部语言
const query = reactive({ page: 1, pageSize: 10, keyword: '', language: '' })

// 语言显示名映射
const LANG_NAMES = { en: '英语', ja: '日语' }

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const form = reactive({
  id: null,
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
    const res = await listWords(query)
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
    word: '',
    phonetic: '',
    meaning: '',
    example: '',
    exampleCN: '',
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
      await updateWord(form.id, { ...form })
      ElMessage.success('编辑成功')
    } else {
      await createWord({ ...form })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确定要删除单词「${row.word}」吗？`, '删除确认', {
    type: 'warning'
  })
  await deleteWord(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <!-- 搜索栏 -->
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
            placeholder="单词 / 释义 / 例句"
            clearable
            style="width: 220px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="'Search'" @click="onSearch">搜索</el-button>
          <el-button v-perm="'word:create'" type="success" :icon="'Plus'" @click="openCreate">
            新增单词
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 单词表格 -->
    <el-card shadow="never" style="margin-top: 16px">
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="语言" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.language === 'ja' ? 'danger' : 'primary'">{{ LANG_NAMES[row.language] || row.language }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="word" label="单词" min-width="110">
          <template #default="{ row }">
            <b>{{ row.word }}</b>
          </template>
        </el-table-column>
        <el-table-column prop="phonetic" label="音标" min-width="130" show-overflow-tooltip />
        <el-table-column prop="meaning" label="释义" min-width="160" show-overflow-tooltip />
        <el-table-column label="例句" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.example }}</div>
            <div style="color: #999; font-size: 12px">{{ row.exampleCN }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="tag" label="标签" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.tag" type="info">{{ row.tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'word:update'" link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button v-perm="'word:delete'" link type="danger" @click="onDelete(row)">
              删除
            </el-button>
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

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑单词' : '新增单词'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="语言">
          <el-radio-group v-model="form.language">
            <el-radio value="en">🇬🇧 英语</el-radio>
            <el-radio value="ja">🇯🇵 日语</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="单词" required>
          <el-input v-model="form.word" placeholder="英文单词或日文原文" />
        </el-form-item>
        <el-form-item label="音标/读音">
          <el-input v-model="form.phonetic" placeholder="英语填音标，日语填假名或罗马音（可留空）" />
        </el-form-item>
        <el-form-item label="释义" required>
          <el-input v-model="form.meaning" placeholder="中文释义" />
        </el-form-item>
        <el-form-item label="例句">
          <el-input v-model="form.example" type="textarea" :rows="2" placeholder="英文例句（可留空）" />
        </el-form-item>
        <el-form-item label="例句翻译">
          <el-input v-model="form.exampleCN" type="textarea" :rows="2" placeholder="例句的中文翻译（可留空）" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tag" placeholder="如：日常、四级（可留空）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
