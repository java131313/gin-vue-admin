<script setup>
// 链接管家 —— 收藏喜欢的网址（存 Sealos links/links.json，双端共享）
//
// 卡片网格：favicon（加载失败回退首字母块）+ 标题 + 描述 + 分组标签；
// 顶部搜索 + 分组筛选 + 添加；编辑/新增走 el-drawer 表单；点击卡片新标签页打开。
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { loadLinks, saveLinks, newId, domainOf, faviconUrl } from '@/api/links'

const links = ref([])
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const activeGroup = ref('') // '' = 全部
const faviconFailed = ref({}) // url → true（favicon 加载失败回退字母）

// 编辑抽屉
const drawer = ref(false)
const editing = ref(null) // {id?, title, url, desc, group}
const isEdit = computed(() => !!editing.value?.id)

// 分组列表（从现有链接收集）
const groups = computed(() => [...new Set(links.value.map((l) => l.group).filter(Boolean))])

// 过滤：分组 + 关键字（标题/URL/描述模糊）
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return links.value.filter((l) => {
    if (activeGroup.value && l.group !== activeGroup.value) return false
    if (!kw) return true
    return (l.title + l.url + (l.desc || '')).toLowerCase().includes(kw)
  })
})

async function persist() {
  saving.value = true
  try {
    await saveLinks(links.value)
  } catch (e) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  try {
    links.value = await loadLinks()
  } finally {
    loading.value = false
  }
}

// ---------- 增删改 ----------
function openAdd() {
  editing.value = { title: '', url: '', desc: '', group: activeGroup.value || '' }
  drawer.value = true
}

function openEdit(link) {
  editing.value = { ...link }
  drawer.value = true
}

async function saveEditing() {
  const e = editing.value
  e.title = e.title.trim()
  e.url = e.url.trim()
  if (!e.title || !e.url) {
    ElMessage.warning('标题和网址不能为空')
    return
  }
  if (!/^https?:\/\//i.test(e.url)) {
    ElMessage.warning('网址需以 http:// 或 https:// 开头')
    return
  }
  if (isEdit.value) {
    const i = links.value.findIndex((l) => l.id === e.id)
    if (i >= 0) links.value[i] = { ...links.value[i], ...e }
  } else {
    links.value.unshift({ ...e, id: newId(), createdAt: new Date().toISOString() })
  }
  drawer.value = false
  await persist()
  ElMessage.success(isEdit.value ? '已更新' : '已收藏')
}

async function remove(link) {
  try {
    await ElMessageBox.confirm(`确定删除「${link.title}」吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  links.value = links.value.filter((l) => l.id !== link.id)
  await persist()
  ElMessage.success('已删除')
}

function open(link) {
  window.open(link.url, '_blank', 'noopener')
}

function onFaviconError(url) {
  faviconFailed.value = { ...faviconFailed.value, [url]: true }
}

onMounted(load)
</script>

<template>
  <div class="links-page">
    <!-- 顶部工具条 -->
    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索标题 / 网址 / 描述…"
        clearable
        class="search"
        :prefix-icon="'Search'"
      />
      <el-radio-group v-model="activeGroup" size="small" class="groups">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button v-for="g in groups" :key="g" :value="g">{{ g }}</el-radio-button>
      </el-radio-group>
      <span class="spacer" />
      <el-button type="primary" :icon="'Plus'" :loading="saving" @click="openAdd">收藏网址</el-button>
    </div>

    <!-- 卡片网格 -->
    <el-scrollbar v-loading="loading" class="grid-scroll">
      <div v-if="filtered.length" class="grid">
        <div v-for="link in filtered" :key="link.id" class="card" @click="open(link)">
          <div class="favicon">
            <img
              v-if="!faviconFailed[link.url]"
              :src="faviconUrl(link.url)"
              alt=""
              @error="onFaviconError(link.url)"
            />
            <span v-else class="letter">{{ (link.title[0] || '?').toUpperCase() }}</span>
          </div>
          <div class="info">
            <div class="title" :title="link.title">{{ link.title }}</div>
            <div class="desc" :title="link.desc">{{ link.desc || domainOf(link.url) }}</div>
            <div class="meta">
              <el-tag v-if="link.group" size="small" class="group-tag">{{ link.group }}</el-tag>
              <span class="domain">{{ domainOf(link.url) }}</span>
            </div>
          </div>
          <div class="actions" @click.stop>
            <el-button link size="small" :icon="'Edit'" title="编辑" @click="openEdit(link)" />
            <el-button link size="small" type="danger" :icon="'Delete'" title="删除" @click="remove(link)" />
          </div>
        </div>
      </div>
      <el-empty
        v-else-if="!loading"
        :description="keyword || activeGroup ? '没有匹配的链接' : '还没有收藏，点右上角「收藏网址」开始'"
        :image-size="90"
      />
    </el-scrollbar>

    <!-- 新增/编辑抽屉 -->
    <el-drawer
      v-model="drawer"
      :title="isEdit ? '编辑链接' : '收藏网址'"
      direction="rtl"
      size="380px"
      destroy-on-close
    >
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="标题" required>
          <el-input v-model="editing.title" placeholder="例如：GitHub" maxlength="60" />
        </el-form-item>
        <el-form-item label="网址" required>
          <el-input v-model="editing.url" placeholder="https://…" maxlength="500" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editing.desc" type="textarea" :rows="3" placeholder="一句话说明（可选）" maxlength="200" />
        </el-form-item>
        <el-form-item label="分组">
          <el-input v-model="editing.group" placeholder="例如：开发 / 学习 / 工具（可选）" maxlength="20" />
          <div class="group-hint">
            已有分组：
            <el-tag
              v-for="g in groups"
              :key="g"
              size="small"
              class="group-pick"
              @click="editing.group = g"
            >
              {{ g }}
            </el-tag>
            <span v-if="!groups.length" class="none">暂无</span>
          </div>
        </el-form-item>
        <div class="form-actions">
          <el-button @click="drawer = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveEditing">
            {{ isEdit ? '保存' : '收藏' }}
          </el-button>
        </div>
      </el-form>
    </el-drawer>
  </div>
</template>

<style scoped>
.links-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.search {
  width: 280px;
}

.groups {
  flex-wrap: wrap;
}

.spacer {
  flex: 1;
}

.grid-scroll {
  flex: 1;
  min-height: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  padding-bottom: 12px;
}

.card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s;
}

.card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.favicon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.favicon img {
  width: 26px;
  height: 26px;
}

.letter {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #409eff, #66b1ff);
}

.info {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 14.5px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc {
  font-size: 12.5px;
  color: #909399;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.domain {
  font-size: 11.5px;
  color: #c0c4cc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.card:hover .actions {
  opacity: 1;
}

.group-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.group-pick {
  cursor: pointer;
}

.none {
  color: #c0c4cc;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

/* 移动端 */
@media (max-width: 768px) {
  .links-page {
    height: auto;
  }

  .search {
    width: 100%;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .actions {
    opacity: 1; /* 移动端无 hover，操作按钮常显 */
  }
}
</style>
