<script setup>
// 自定义学习 · 模板管理页 —— 通用模板的「定义学什么」
//
// 上半部分：科目管理（增删改）；选中一个科目后，
// 下半部分：该科目的知识点条目管理（增删改）。
// 条目建好后：卡片学习页可复习，考试中心可出题。
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listModulesAdmin, createModule, updateModule, deleteModule,
  listItemsAdmin, createItem, updateItem, deleteItem
} from '@/api/custom'

// ---------- 科目管理 ----------
const modules = ref([])
const currentModule = ref(null) // 当前选中的科目对象

const moduleDialog = ref(false)
const isEditModule = ref(false)
const savingModule = ref(false)
const moduleForm = reactive({ id: null, name: '', icon: '📚', description: '', sort: 0 })

// ---------- 条目管理 ----------
const items = ref([])
const loadingItems = ref(false)

const itemDialog = ref(false)
const isEditItem = ref(false)
const savingItem = ref(false)
const itemForm = reactive({ id: null, title: '', content: '', tag: '', sort: 0 })

async function loadModules(keepSelection = true) {
  const res = await listModulesAdmin()
  modules.value = res.data
  if (keepSelection && currentModule.value) {
    // 刷新后保持选中
    const found = modules.value.find((m) => m.id === currentModule.value.id)
    if (found) {
      currentModule.value = found
      loadItems()
      return
    }
  }
  if (modules.value.length > 0) {
    selectModule(modules.value[0])
  } else {
    currentModule.value = null
    items.value = []
  }
}

function selectModule(m) {
  currentModule.value = m
  loadItems()
}

async function loadItems() {
  if (!currentModule.value) return
  loadingItems.value = true
  try {
    const res = await listItemsAdmin({ moduleId: currentModule.value.id })
    items.value = res.data
  } finally {
    loadingItems.value = false
  }
}

// 卡片上显示的条目数：当前选中的科目显示实时条数，其他显示接口给的 itemCount
function itemsCount(m) {
  if (currentModule.value && currentModule.value.id === m.id) return items.value.length
  return m.itemCount || 0
}

// ---------- 科目 CRUD ----------
function openCreateModule() {
  isEditModule.value = false
  Object.assign(moduleForm, { id: null, name: '', icon: '📚', description: '', sort: 0 })
  moduleDialog.value = true
}

function openEditModule() {
  isEditModule.value = true
  Object.assign(moduleForm, { ...currentModule.value })
  moduleDialog.value = true
}

async function onSubmitModule() {
  savingModule.value = true
  try {
    if (isEditModule.value) {
      await updateModule(moduleForm.id, { ...moduleForm })
      ElMessage.success('编辑成功')
    } else {
      await createModule({ ...moduleForm })
      ElMessage.success('创建成功')
    }
    moduleDialog.value = false
    loadModules()
  } finally {
    savingModule.value = false
  }
}

async function onDeleteModule() {
  await ElMessageBox.confirm(
    `确定要删除科目「${currentModule.value.name}」吗？其下所有条目和复习进度都会被删除！`,
    '删除确认',
    { type: 'warning' }
  )
  await deleteModule(currentModule.value.id)
  ElMessage.success('删除成功')
  currentModule.value = null
  loadModules(false)
}

// ---------- 条目 CRUD ----------
function openCreateItem() {
  isEditItem.value = false
  Object.assign(itemForm, { id: null, title: '', content: '', tag: '', sort: items.value.length + 1 })
  itemDialog.value = true
}

function openEditItem(row) {
  isEditItem.value = true
  Object.assign(itemForm, { ...row })
  itemDialog.value = true
}

async function onSubmitItem() {
  savingItem.value = true
  try {
    if (isEditItem.value) {
      await updateItem(itemForm.id, { ...itemForm })
      ElMessage.success('编辑成功')
    } else {
      await createItem({ ...itemForm, moduleId: currentModule.value.id })
      ElMessage.success('创建成功')
    }
    itemDialog.value = false
    loadItems()
    loadModules() // 更新条目数
  } finally {
    savingItem.value = false
  }
}

async function onDeleteItem(row) {
  await ElMessageBox.confirm(`确定要删除条目「${row.title}」吗？`, '删除确认', { type: 'warning' })
  await deleteItem(row.id)
  ElMessage.success('删除成功')
  loadItems()
  loadModules()
}

onMounted(() => loadModules(false))
</script>

<template>
  <div>
    <!-- ============ 科目列表 ============ -->
    <el-card shadow="never">
      <div class="module-header">
        <h3 style="margin: 0">📚 自定义科目</h3>
        <el-button v-perm="'template:create'" type="success" :icon="'Plus'" @click="openCreateModule">
          新增科目
        </el-button>
      </div>
      <p class="tip">
        建一个科目、填上知识点条目，就自动拥有三大能力：「卡片学习」翻卡复习、
        「考试中心」选这个科目出题（选择/填空/问答）、错题自动进错题本。
      </p>
      <div v-if="modules.length" class="module-grid">
        <div
          v-for="m in modules"
          :key="m.id"
          class="module-card"
          :class="{ active: currentModule?.id === m.id }"
          @click="selectModule(m)"
        >
          <div class="module-icon">{{ m.icon || '📚' }}</div>
          <div class="module-name">{{ m.name }}</div>
          <div class="module-desc">{{ m.description || '暂无描述' }}</div>
          <el-tag size="small" type="info">{{ itemsCount(m) }} 条目</el-tag>
        </div>
      </div>
      <el-empty v-else description="还没有科目，点击右上角创建（比如：考研政治、医学词汇）" />
    </el-card>

    <!-- ============ 选中科目的条目管理 ============ -->
    <el-card v-if="currentModule" shadow="never" style="margin-top: 16px">
      <div class="module-header">
        <h3 style="margin: 0">{{ currentModule.icon || '📚' }} {{ currentModule.name }} · 知识点条目</h3>
        <div>
          <el-button v-perm="'template:update'" :icon="'Edit'" @click="openEditModule">编辑科目</el-button>
          <el-button v-perm="'template:delete'" type="danger" plain :icon="'Delete'" @click="onDeleteModule">
            删除科目
          </el-button>
          <el-button v-perm="'template:create'" type="success" :icon="'Plus'" @click="openCreateItem">
            新增条目
          </el-button>
        </div>
      </div>

      <el-table v-loading="loadingItems" :data="items" border style="margin-top: 12px">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="条目（卡片正面）" min-width="180">
          <template #default="{ row }"><b>{{ row.title }}</b></template>
        </el-table-column>
        <el-table-column prop="content" label="内容（卡片背面）" min-width="280" show-overflow-tooltip />
        <el-table-column prop="tag" label="标签" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.tag" type="info" size="small">{{ row.tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="70" align="center" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'template:update'" link type="primary" @click="openEditItem(row)">编辑</el-button>
            <el-button v-perm="'template:delete'" link type="danger" @click="onDeleteItem(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>该科目下还没有条目，点击「新增条目」创建第一张卡片</template>
      </el-table>
    </el-card>

    <!-- 科目弹窗 -->
    <el-dialog v-model="moduleDialog" :title="isEditModule ? '编辑科目' : '新增科目'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="图标" required>
          <el-input v-model="moduleForm.icon" style="width: 120px" placeholder="emoji" />
          <span class="hint">用 emoji 表示科目，如 🦀 📖 🧠</span>
        </el-form-item>
        <el-form-item label="科目名称" required>
          <el-input v-model="moduleForm.name" placeholder="如：学Rust、考研政治、医学词汇" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="moduleForm.description" placeholder="一句话说明（可选）" />
        </el-form-item>
        <el-form-item label="排序号">
          <el-input-number v-model="moduleForm.sort" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="moduleDialog = false">取 消</el-button>
        <el-button type="primary" :loading="savingModule" @click="onSubmitModule">确 定</el-button>
      </template>
    </el-dialog>

    <!-- 条目弹窗 -->
    <el-dialog v-model="itemDialog" :title="isEditItem ? '编辑条目' : '新增条目'" width="560px">
      <el-form label-width="110px">
        <el-form-item label="条目名（正面）" required>
          <el-input v-model="itemForm.title" placeholder="如：所有权（Ownership）" />
        </el-form-item>
        <el-form-item label="内容讲解（背面）" required>
          <el-input
            v-model="itemForm.content"
            type="textarea"
            :rows="6"
            placeholder="条目讲解，段落之间用空行分隔"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="itemForm.tag" placeholder="如：核心 / 语法（可选）" style="width: 220px" />
        </el-form-item>
        <el-form-item label="排序号">
          <el-input-number v-model="itemForm.sort" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialog = false">取 消</el-button>
        <el-button type="primary" :loading="savingItem" @click="onSubmitItem">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.tip {
  color: #909399;
  line-height: 1.8;
  margin: 10px 0 16px;
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.module-card {
  border: 2px solid #ebeef5;
  border-radius: 12px;
  padding: 18px;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s;
}

.module-card:hover {
  border-color: #c6e2ff;
}

.module-card.active {
  border-color: #409eff;
  background: #f5faff;
}

.module-icon {
  font-size: 36px;
}

.module-name {
  font-size: 17px;
  font-weight: bold;
  margin: 8px 0 4px;
  color: #303133;
}

.module-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  margin-left: 10px;
  color: #c0c4cc;
  font-size: 12px;
}
</style>
