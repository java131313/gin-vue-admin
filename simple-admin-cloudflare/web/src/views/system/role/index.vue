<script setup>
// 角色管理页面：列表 + 新增 / 编辑 / 删除 + 用树形勾选的方式分配菜单权限
import { reactive, ref, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listRoles, createRole, updateRole, deleteRole } from '@/api/role'
import { listMenus } from '@/api/menu'

// ---------- 列表 ----------
const loading = ref(false)
const rows = ref([])

// ---------- 弹窗表单 ----------
const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const treeRef = ref() // el-tree 组件引用（用来读取勾选状态）
const menuTree = ref([]) // 菜单权限树（勾选用）
const form = reactive({ id: null, name: '', code: '', description: '' })

async function load() {
  loading.value = true
  try {
    const res = await listRoles()
    rows.value = res.data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  isEdit.value = false
  Object.assign(form, { id: null, name: '', code: '', description: '' })
  dialogVisible.value = true
  // 等弹窗渲染完成后再操作树组件：清空所有勾选（新增角色默认无权限）
  nextTick(() => treeRef.value?.setCheckedKeys([]))
}

async function openEdit(row) {
  isEdit.value = true
  Object.assign(form, { id: row.id, name: row.name, code: row.code, description: row.description })
  dialogVisible.value = true
  // 等弹窗渲染完成后回显该角色已拥有的菜单
  // setCheckedKeys 只传叶子节点 ID，父节点会按子节点勾选情况自动变成半选状态
  await nextTick()
  const menuIds = row.menus ? row.menus.map((m) => m.id) : []
  treeRef.value?.setCheckedKeys(menuIds)
}

async function onSubmit() {
  // 勾选的节点 + 半选的父节点 都要保存：
  // 如果只存叶子节点，父级目录不在角色的菜单里，树形组装时子节点会因为找不到父级被丢弃
  const checked = treeRef.value.getCheckedKeys()
  const halfChecked = treeRef.value.getHalfCheckedKeys()
  const menuIds = [...checked, ...halfChecked]

  saving.value = true
  try {
    if (isEdit.value) {
      await updateRole(form.id, { ...form, menu_ids: menuIds })
      ElMessage.success('编辑成功')
    } else {
      await createRole({ ...form, menu_ids: menuIds })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确定要删除角色「${row.name}」吗？`, '删除确认', { type: 'warning' })
  await deleteRole(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(() => {
  load()
  // 加载菜单权限树，供弹窗里的勾选用
  listMenus().then((res) => (menuTree.value = res.data))
})
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-button v-perm="'role:create'" type="success" :icon="'Plus'" @click="openCreate">
        新增角色
      </el-button>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="角色名称" min-width="140" />
        <el-table-column prop="code" label="角色编码" min-width="120" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'role:update'" link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button
              v-perm="'role:delete'"
              link
              type="danger"
              :disabled="row.code === 'admin'"
              @click="onDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑角色' : '新增角色'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="角色名称" required>
          <el-input v-model="form.name" placeholder="如：运营专员" />
        </el-form-item>
        <el-form-item label="角色编码" required>
          <!-- 内置管理员角色的编码不允许改 -->
          <el-input v-model="form.code" :disabled="form.code === 'admin'" placeholder="如：operator（唯一）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="菜单权限">
          <!-- 树形勾选：勾选页面菜单和按钮权限；目录只是分组 -->
          <el-tree
            ref="treeRef"
            :data="menuTree"
            show-checkbox
            node-key="id"
            default-expand-all
            :props="{ label: 'title', children: 'children' }"
            style="width: 100%; max-height: 300px; overflow: auto"
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
