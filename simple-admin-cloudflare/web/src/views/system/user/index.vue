<script setup>
// 用户管理页面：分页列表 + 新增 / 编辑 / 删除 + 分配角色
//
// 按钮权限说明：
//   「新增用户」按钮带 v-perm="'user:create'"，没有该权限的用户看不到它；
//   后端接口同样校验权限，双重保障。编辑/删除按钮同理。
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listUsers, createUser, updateUser, deleteUser } from '@/api/user'
import { listRoles } from '@/api/role'
import { useUserStore } from '@/stores/user'

const store = useUserStore()

// ---------- 列表相关状态 ----------
const loading = ref(false)
const rows = ref([]) // 当前页的用户数据
const total = ref(0) // 总条数（分页用）
const query = reactive({ page: 1, pageSize: 10, keyword: '' })

// ---------- 弹窗表单相关状态 ----------
const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const roleOptions = ref([]) // 角色下拉选项（新增/编辑用户时选择角色）
const form = reactive({
  id: null,
  username: '',
  nickname: '',
  password: '',
  status: 1,
  role_ids: []
})

// 加载用户列表
async function load() {
  loading.value = true
  try {
    const res = await listUsers(query)
    rows.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

// 搜索：回到第一页再查
function onSearch() {
  query.page = 1
  load()
}

// 打开「新增用户」弹窗
function openCreate() {
  isEdit.value = false
  Object.assign(form, { id: null, username: '', nickname: '', password: '', status: 1, role_ids: [] })
  dialogVisible.value = true
}

// 打开「编辑用户」弹窗：把该行数据填进表单（密码留空表示不修改）
function openEdit(row) {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    password: '',
    status: row.status,
    role_ids: row.roles ? row.roles.map((r) => r.id) : []
  })
  dialogVisible.value = true
}

// 提交表单：新增走 POST，编辑走 PUT
async function onSubmit() {
  saving.value = true
  try {
    if (isEdit.value) {
      await updateUser(form.id, {
        nickname: form.nickname,
        password: form.password, // 留空则后端不修改密码
        status: form.status,
        role_ids: form.role_ids
      })
      ElMessage.success('编辑成功')
    } else {
      await createUser({ ...form })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load() // 刷新列表
  } finally {
    saving.value = false
  }
}

// 删除用户：先弹确认框，确认后调删除接口
async function onDelete(row) {
  await ElMessageBox.confirm(`确定要删除用户「${row.nickname || row.username}」吗？`, '删除确认', {
    type: 'warning'
  })
  await deleteUser(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(() => {
  load()
  // 同时加载角色列表，供表单里的角色下拉框使用
  listRoles().then((res) => (roleOptions.value = res.data))
})
</script>

<template>
  <div>
    <!-- 搜索栏 -->
    <el-card shadow="never">
      <el-form inline @submit.prevent>
        <el-form-item label="关键词">
          <el-input
            v-model="query.keyword"
            placeholder="用户名 / 昵称"
            clearable
            style="width: 220px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="'Search'" @click="onSearch">搜索</el-button>
          <!-- v-perm：没有 user:create 权限的用户根本看不到这个按钮 -->
          <el-button v-perm="'user:create'" type="success" :icon="'Plus'" @click="openCreate">
            新增用户
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 用户表格 -->
    <el-card shadow="never" style="margin-top: 16px">
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="nickname" label="昵称" min-width="120" />
        <el-table-column label="角色" min-width="160">
          <template #default="{ row }">
            <el-tag
              v-for="role in row.roles"
              :key="role.id"
              style="margin-right: 4px"
              type="info"
            >
              {{ role.name }}
            </el-tag>
            <span v-if="!row.roles || row.roles.length === 0" style="color: #999">未分配</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'user:update'" link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <!-- 不能删除自己和内置管理员 -->
            <el-button
              v-perm="'user:delete'"
              link
              type="danger"
              :disabled="row.id === store.info?.id || row.username === 'admin'"
              @click="onDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
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
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="用户名" required>
          <!-- 用户名创建后不允许修改（登录账号固定） -->
          <el-input v-model="form.username" :disabled="isEdit" placeholder="登录账号" />
        </el-form-item>
        <el-form-item :label="isEdit ? '新密码' : '密码'" :required="!isEdit">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :placeholder="isEdit ? '留空表示不修改密码' : '初始密码，至少 6 位'"
          />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="页面显示的名称" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="角色">
          <!-- multiple：一个用户可以有多个角色，权限取并集 -->
          <el-select v-model="form.role_ids" multiple placeholder="选择角色" style="width: 100%">
            <el-option v-for="role in roleOptions" :key="role.id" :label="role.name" :value="role.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
