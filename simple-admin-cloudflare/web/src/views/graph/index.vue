<script setup>
// 知识图谱页面 —— 把「学习的主题与文章」生成一张总结图谱
//
// 图谱结构（由内到外）：
//   中心「学习地图」
//     ├─ 学习主题（9 个自定义科目 + 阅读文章）
//     │   ├─ 知识分类标签 → 知识点（绿=已掌握 橙=学习中）
//     │   └─ 语言分类 → 阅读文章
//
// 交互：滚轮缩放、拖拽节点、悬停看讲解摘要、点击节点看全文。
// 图例可点击过滤某一类节点（如只看「已掌握」）。
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { getKnowledgeGraph } from '@/api/graph'

// 按需注册 ECharts 组件（只打包用到的，产物更小）
echarts.use([GraphChart, TooltipComponent, LegendComponent, CanvasRenderer])

const chartRef = ref(null) // 图表容器
const loading = ref(true)
const detail = ref(null) // 点击节点后的详情
const dialogVisible = ref(false)

let chart = null

// 节点分类（与后端 category 编号对应）：图例颜色也按这个分配
const CATEGORIES = [
  '🗺️ 学习地图',
  '📚 学习主题',
  '🏷️ 知识分类',
  '✅ 知识点·已掌握',
  '📌 知识点·学习中',
  '🇬🇧 英语文章',
  '🇯🇵 日语文章'
]

async function init() {
  const res = await getKnowledgeGraph()
  loading.value = false

  chart = echarts.init(chartRef.value)
  chart.setOption({
    tooltip: {
      // 悬停显示讲解摘要（最多 150 字）
      formatter: (p) => {
        if (p.data?.value) {
          const text = p.data.value.length > 150 ? p.data.value.slice(0, 150) + '…' : p.data.value
          return `<b>${p.name}</b><br/><span style="color:#999">${text}</span>`
        }
        return `<b>${p.name}</b>`
      }
    },
    legend: {
      data: CATEGORIES,
      bottom: 0,
      textStyle: { fontSize: 12 }
    },
    series: [
      {
        type: 'graph',
        layout: 'force', // 力导向布局：节点自动铺开
        roam: true, // 滚轮缩放 + 平移
        draggable: true, // 节点可拖拽
        focusNodeAdjacency: true,
        force: {
          repulsion: 450, // 节点间斥力（越大越稀疏）
          edgeLength: [70, 170], // 边的长度范围
          gravity: 0.06, // 向中心的引力
          friction: 0.3,
          layoutAnimation: true
        },
        categories: CATEGORIES.map((name) => ({ name })),
        // 标签自动避让：重叠的标签自动隐藏，放大或拖拽后逐渐显示
        labelLayout: { hideOverlap: true },
        label: {
          show: true,
          fontSize: 11,
          overflow: 'truncate',
          width: 110
        },
        scaleLimit: { min: 0.3, max: 5 },
        zoom: 0.85,
        emphasis: {
          focus: 'adjacency', // 悬停高亮相邻节点和边
          lineStyle: { width: 3 }
        },
        lineStyle: {
          color: 'source',
          opacity: 0.45,
          curveness: 0.05,
          width: 1.5
        },
        data: res.data.nodes,
        links: res.data.links
      }
    ]
  })

  // 点击节点：有内容的知识点/文章弹出全文
  chart.on('click', (params) => {
    if (params.data?.value) {
      detail.value = { name: params.name, content: params.data.value }
      dialogVisible.value = true
    }
  })
}

function onResize() {
  chart?.resize()
}

onMounted(init)
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
})
window.addEventListener('resize', onResize)
</script>

<template>
  <div v-loading="loading">
    <el-card shadow="never">
      <div class="graph-header">
        <h3 style="margin: 0">🗺️ 知识图谱</h3>
        <span class="tip">
          全部学习主题与文章的总览图 · 滚轮缩放 · 拖拽节点 · 悬停看摘要 · 点击查看全文
        </span>
      </div>
      <!-- 图谱画布 -->
      <div ref="chartRef" class="graph-canvas"></div>
    </el-card>

    <!-- 节点详情 -->
    <el-dialog v-model="dialogVisible" :title="detail?.name" width="540px">
      <p class="detail-content">{{ detail?.content }}</p>
    </el-dialog>
  </div>
</template>

<style scoped>
.graph-header {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 8px;
}

.tip {
  color: #909399;
  font-size: 13px;
}

.graph-canvas {
  height: calc(100vh - 240px);
  min-height: 480px;
  width: 100%;
}

.detail-content {
  white-space: pre-wrap;
  line-height: 1.9;
  color: #606266;
  margin: 0;
}
</style>
