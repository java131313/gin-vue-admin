<script setup>
// 菜单（权限）管理页面：树形表格 + 新增 / 编辑 / 删除
//
// 三种节点类型：
//   目录(type=0)：导航分组，如「系统管理」，没有页面组件
//   菜单(type=1)：可点击的页面，需要配置路由路径 path 和组件 component
//   按钮(type=2)：页面里的操作权限，只需要权限标识 perm（如 user:create）
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listMenus, createMenu, updateMenu, deleteMenu } from '@/api/menu'

const loading = ref(false)
const rows = ref([]) // 菜单树（后端已组装好层级）

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const form = reactive({
  id: null,
  parentId: null, // null = 根节点（el-tree-select 清空时会是 null）
  title: '',
  name: '',
  path: '',
  component: '',
  icon: '',
  type: 0,
  perm: '',
  sort: 0
})

async function load() {
  loading.value = true
  try {
    const res = await listMenus()
    rows.value = res.data
  } finally {
    loading.value = false
  }
}

function resetForm() {
  Object.assign(form, {
    id: null,
    parentId: null,
    title: '',
    name: '',
    path: '',
    component: '',
    icon: '',
    type: 0,
    perm: '',
    sort: 0
  })
}

function openCreate(parent) {
  isEdit.value = false
  resetForm()
  // 从某行的「新增子项」进来时，自动带上父节点
  if (parent) form.parentId = parent.id
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  // 把该行数据原样填进表单
  Object.assign(form, {
    id: row.id,
    parentId: row.parentId || null,
    title: row.title,
    name: row.name,
    path: row.path,
    component: row.component,
    icon: row.icon,
    type: row.type,
    perm: row.perm,
    sort: row.sort
  })
  dialogVisible.value = true
}

async function onSubmit() {
  saving.value = true
  try {
    // parentId 为 null（根节点）时传 0
    const payload = { ...form, parentId: form.parentId || 0 }
    if (isEdit.value) {
      await updateMenu(form.id, payload)
      ElMessage.success('编辑成功')
    } else {
      await createMenu(payload)
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
  await deleteMenu(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-button v-perm="'menu:create'" type="success" :icon="'Plus'" @click="openCreate()">
        新增菜单
      </el-button>
    </el-card>

    <!-- 树形表格：row-key 必须是唯一主键，data 是树形结构 -->
    <el-card shadow="never" style="margin-top: 16px">
      <el-table
        v-loading="loading"
        :data="rows"
        row-key="id"
        border
        default-expand-all
        :tree-props="{ children: 'children' }"
      >
        <el-table-column prop="title" label="菜单名称" min-width="180" />
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.type === 0" type="warning">目录</el-tag>
            <el-tag v-else-if="row.type === 1" type="success">菜单</el-tag>
            <el-tag v-else type="info">按钮</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="路由路径" min-width="140" show-overflow-tooltip />
        <el-table-column prop="component" label="组件路径" min-width="160" show-overflow-tooltip />
        <el-table-column prop="perm" label="权限标识" min-width="130" show-overflow-tooltip />
        <el-table-column prop="sort" label="排序" width="70" align="center" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.type !== 2"
              v-perm="'menu:create'"
              link
              type="success"
              @click="openCreate(row)"
            >
              新增子项
            </el-button>
            <el-button v-perm="'menu:update'" link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button v-perm="'menu:delete'" link type="danger" @click="onDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑菜单' : '新增菜单'" width="560px">
      <el-form label-width="90px">
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio :value="0">目录</el-radio>
            <el-radio :value="1">菜单</el-radio>
            <el-radio :value="2">按钮</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="上级菜单">
          <!-- 树形下拉选择父节点；check-strictly 表示父子勾选不联动（这里只是单选父级） -->
          <el-tree-select
            v-model="form.parentId"
            :data="rows"
            check-strictly
            :render-after-expand="false"
            node-key="id"
            :props="{ label: 'title', children: 'children' }"
            clearable
            placeholder="留空 = 作为根节点"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.title" placeholder="显示的文字（导航文字 / 按钮文字）" />
        </el-form-item>
        <template v-if="form.type !== 2">
          <el-form-item label="路由 name">
            <el-input v-model="form.name" placeholder="路由名称，如 SysUser（保持唯一）" />
          </el-form-item>
          <el-form-item label="路由 path">
            <el-input v-model="form.path" placeholder="如 /system/user" />
          </el-form-item>
          <el-form-item v-if="form.type === 1" label="组件路径">
            <el-input v-model="form.component" placeholder="相对 src/views，如 system/user/index" />
          </el-form-item>
          <el-form-item label="图标">
            <el-input v-model="form.icon" placeholder="Element Plus 图标名，如 Setting" />
          </el-form-item>
        </template>
        <el-form-item v-if="form.type !== 0" label="权限标识">
          <el-input v-model="form.perm" placeholder="如 user:list（后端接口校验用）" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
