<script setup>
// 函数作图页面 —— 画出三类曲线的图象
//
//   直线（一次函数）   y = kx + b            —— 图象是一条直线
//   抛物线（二次函数） y = ax² + bx + c      —— 一元二次方程对应的曲线
//   椭圆             (x-h)²/a² + (y-k)²/b² = 1 —— 圆心是 (h,k) 的椭圆（a=b 时就是圆）
//
// 直线模式支持画两条直线组成方程组：交点 = 方程组的解。
// 抛物线模式会标出顶点和对称轴；椭圆模式会标出中心。
//
// 实现：HTML5 <canvas> 手绘（不引入图表库）。
// 三种曲线的画法不同：
//   直线/抛物线 是 y = f(x)，按 x 采样连线；
//   椭圆没法写成 y = f(x)，要用参数方程：x = h + a·cos(t)，y = k + b·sin(t)。
import { ref, reactive, watch, onMounted } from 'vue'

const canvasRef = ref(null) // canvas 元素引用

// 曲线类型与参数
const form = reactive({
  type: 'line', // line=直线 parabola=抛物线 ellipse=椭圆
  // ---- 直线 y = kx + b ----
  k1: 1,
  b1: 0,
  showLine2: true, // 是否画第二条直线（方程组）
  k2: -1,
  b2: 2,
  // ---- 抛物线 y = ax² + bx + c ----
  pa: 1,
  pb: 0,
  pc: 0,
  // ---- 椭圆 (x-h)²/a² + (y-k)²/b² = 1 ----
  eh: 0,
  ek: 0,
  ea: 4,
  eb: 2
})

// 图象结论（显示在图下方）
const conclusion = ref('')

// 画布逻辑尺寸（实际像素按屏幕清晰度放大，保证文字不模糊）
const W = 800
const H = 560

// ---------- 工具函数 ----------

// 数字格式化成简洁文本（消除 0.30000000000000004 这类浮点误差）
function fmt(n) {
  return String(Number(n.toFixed(4)))
}

// 选"好看"的网格步长（1/2/5/10），让网格间距接近目标像素
function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const m of [1, 2, 5, 10]) {
    if (pow * m >= raw) return pow * m
  }
  return pow * 10
}

// 直线 y = kx + b 的表达式文本
function lineText(k, b) {
  const kText = k === 1 ? '' : k === -1 ? '-' : fmt(k)
  const bText = b === 0 ? '' : (b > 0 ? ' + ' : ' - ') + fmt(Math.abs(b))
  return 'y = ' + kText + 'x' + bText
}

// ---------- 核心绘图函数 ----------
function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  // 按屏幕像素比放大画布，高清屏上曲线不模糊
  const dpr = window.devicePixelRatio || 1
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, W, H)

  // ===== 1. 计算视野范围和曲线的"兴趣点"（每种曲线不同） =====
  let xs = [] // 需要覆盖的 x 坐标集合
  let ys = [] // 需要覆盖的 y 坐标集合
  let point = null // 交点（仅直线模式）
  let vertex = null // 抛物线顶点
  let axisX = null // 抛物线对称轴的 x 坐标
  let valid = true // 参数是否合法（椭圆的 a、b 必须为正）

  if (form.type === 'line') {
    // 直线：覆盖 x∈[-10,10] 的端点，以及（两条时）交点
    const k1 = Number(form.k1)
    const b1 = Number(form.b1)
    xs = [-10, 10]
    ys = [k1 * -10 + b1, k1 * 10 + b1]
    if (form.showLine2) {
      const k2 = Number(form.k2)
      const b2 = Number(form.b2)
      ys.push(k2 * -10 + b2, k2 * 10 + b2)
      // 交点：k₁x + b₁ = k₂x + b₂ → x = (b₂-b₁)/(k₁-k₂)
      if (k1 !== k2) {
        const x = (b2 - b1) / (k1 - k2)
        point = { x, y: k1 * x + b1 }
        xs.push(x)
        ys.push(point.y)
      }
    }
  } else if (form.type === 'parabola') {
    // 抛物线：在 x∈[-5,5] 上采样，外加顶点和原点
    const a = Number(form.pa)
    const b = Number(form.pb)
    const c = Number(form.pc)
    xs = [-5, 5, 0]
    for (let x = -5; x <= 5; x += 0.5) {
      ys.push(a * x * x + b * x + c)
    }
    if (a !== 0) {
      // 顶点横坐标 x = -b/(2a)，纵坐标代入函数
      const vx = -b / (2 * a)
      vertex = { x: vx, y: a * vx * vx + b * vx + c }
      axisX = vx
      xs.push(vx)
      ys.push(vertex.y)
    }
  } else {
    // 椭圆：横向覆盖 [h-a, h+a]，纵向覆盖 [k-b, k+b]
    const h = Number(form.eh)
    const k = Number(form.ek)
    const a = Number(form.ea)
    const b = Number(form.eb)
    if (a <= 0 || b <= 0) {
      valid = false // a、b 必须大于 0
    } else {
      xs = [h - a, h + a, h, -3, 3]
      ys = [k - b, k + b, k, -3, 3]
    }
  }

  // 四边各留 15% 空白，且至少能看到 [-3, 3] 的范围
  let xMin = Math.min(...xs, -3)
  let xMax = Math.max(...xs, 3)
  let yMin = Math.min(...ys, -3)
  let yMax = Math.max(...ys, 3)
  const padX = (xMax - xMin) * 0.15
  const padY = (yMax - yMin) * 0.15
  xMin -= padX
  xMax += padX
  yMin -= padY
  yMax += padY

  // ===== 2. 坐标变换：数学坐标 (x, y) → 画布像素 (px, py) =====
  // 数学 y 轴向上、画布 y 轴向下，所以 py 要减去 y（本页最核心的知识点）
  const unit = Math.min(W / (xMax - xMin), H / (yMax - yMin))
  const centerX = (xMin + xMax) / 2
  const centerY = (yMin + yMax) / 2
  const toPx = (x, y) => [W / 2 + (x - centerX) * unit, H / 2 - (y - centerY) * unit]

  // ===== 3. 画网格、刻度和坐标轴（三种曲线通用） =====
  const step = niceStep(50 / unit) // 目标：网格间距约 50px
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'

  for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
    const [px] = toPx(x, 0)
    ctx.beginPath()
    ctx.strokeStyle = x === 0 ? '#909399' : '#ebeef5'
    ctx.lineWidth = x === 0 ? 1.5 : 1
    ctx.moveTo(px, 0)
    ctx.lineTo(px, H)
    ctx.stroke()
    if (x !== 0) {
      ctx.fillStyle = '#909399'
      ctx.fillText(fmt(x), px, toPx(0, 0)[1] + 16)
    }
  }
  for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
    const [, py] = toPx(0, y)
    ctx.beginPath()
    ctx.strokeStyle = y === 0 ? '#909399' : '#ebeef5'
    ctx.lineWidth = y === 0 ? 1.5 : 1
    ctx.moveTo(0, py)
    ctx.lineTo(W, py)
    ctx.stroke()
    if (y !== 0) {
      ctx.fillStyle = '#909399'
      ctx.textAlign = 'right'
      ctx.fillText(fmt(y), toPx(0, 0)[0] - 6, py + 4)
      ctx.textAlign = 'center'
    }
  }
  // 轴名 x、y
  ctx.fillStyle = '#606266'
  ctx.font = 'italic 14px serif'
  ctx.fillText('x', W - 14, toPx(0, 0)[1] - 8)
  ctx.fillText('y', toPx(0, 0)[0] + 14, 16)
  ctx.font = '12px sans-serif'

  // ===== 4. 画曲线 =====
  if (form.type === 'line') {
    const k1 = Number(form.k1)
    const b1 = Number(form.b1)
    const k2 = Number(form.k2)
    const b2 = Number(form.b2)
    // 直线是无限长的：取视野左右各超出一截的两个点连线，
    // 超出画布的部分会被 canvas 自动裁剪
    function drawLine(k, b, color, label) {
      const [ax, ay] = toPx(xMin - 5, k * (xMin - 5) + b)
      const [bx, by] = toPx(xMax + 5, k * (xMax + 5) + b)
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
      ctx.font = '14px sans-serif'
      ctx.fillStyle = color
      ctx.textAlign = 'right'
      ctx.fillText(label, bx - 8, by - 8)
      ctx.textAlign = 'center'
    }
    drawLine(k1, b1, '#409eff', 'l₁: ' + lineText(k1, b1))
    if (form.showLine2) {
      drawLine(k2, b2, '#f56c6c', 'l₂: ' + lineText(k2, b2))
    }
    // 交点
    if (point) {
      markPoint(ctx, toPx, point.x, point.y, '#e6a23c')
      conclusion.value = `两直线相交于点 (${fmt(point.x)}, ${fmt(point.y)})，这就是方程组的唯一解`
    } else if (form.showLine2) {
      conclusion.value =
        b1 === b2 ? '两条直线完全重合，方程组有无数个解' : '两条直线平行（没有交点），方程组无解'
    } else {
      conclusion.value = ''
    }
  } else if (form.type === 'parabola') {
    const a = Number(form.pa)
    const b = Number(form.pb)
    const c = Number(form.pc)
    // 对称轴：画一条竖直虚线
    if (axisX !== null) {
      const [px] = toPx(axisX, 0)
      ctx.beginPath()
      ctx.setLineDash([6, 4]) // 虚线
      ctx.strokeStyle = '#909399'
      ctx.lineWidth = 1
      ctx.moveTo(px, 0)
      ctx.lineTo(px, H)
      ctx.stroke()
      ctx.setLineDash([]) // 恢复实线
    }
    // 按 x 采样 300 个点连成平滑曲线
    ctx.beginPath()
    ctx.strokeStyle = '#409eff'
    ctx.lineWidth = 2.5
    for (let i = 0; i <= 300; i++) {
      const x = xMin + ((xMax - xMin) * i) / 300
      const y = a * x * x + b * x + c
      const [px, py] = toPx(x, y)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
    // 顶点
    if (vertex) {
      markPoint(ctx, toPx, vertex.x, vertex.y, '#e6a23c')
      conclusion.value = `抛物线开口向${a > 0 ? '上' : '下'}，顶点 (${fmt(vertex.x)}, ${fmt(vertex.y)})，对称轴 x = ${fmt(vertex.x)}；${a > 0 ? '最小' : '最大'}值为 ${fmt(vertex.y)}`
    } else {
      conclusion.value = 'a = 0，抛物线退化成了一条直线'
    }
  } else {
    // 椭圆：参数方程 x = h + a·cos(t)，y = k + b·sin(t)，t ∈ [0, 2π]
    const h = Number(form.eh)
    const k = Number(form.ek)
    const a = Number(form.ea)
    const b = Number(form.eb)
    if (!valid) {
      conclusion.value = '椭圆的半轴 a、b 都必须大于 0'
    } else {
      ctx.beginPath()
      ctx.strokeStyle = '#409eff'
      ctx.lineWidth = 2.5
      for (let i = 0; i <= 200; i++) {
        const t = (Math.PI * 2 * i) / 200
        const [px, py] = toPx(h + a * Math.cos(t), k + b * Math.sin(t))
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
      // 标出中心
      markPoint(ctx, toPx, h, k, '#e6a23c')
      conclusion.value =
        a === b
          ? `a = b = ${fmt(a)}，这是一个圆！圆心 (${fmt(h)}, ${fmt(k)})，半径 ${fmt(a)}`
          : `椭圆中心 (${fmt(h)}, ${fmt(k)})，横向半轴 a = ${fmt(a)}，纵向半轴 b = ${fmt(b)}`
    }
  }
}

// 画一个带坐标标注的高亮圆点（交点 / 顶点 / 圆心通用）
function markPoint(ctx, toPx, x, y, color) {
  const [px, py] = toPx(x, y)
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.arc(px, py, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = 'bold 14px sans-serif'
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.fillText(`(${fmt(x)}, ${fmt(y)})`, px + 10, py - 10)
  ctx.textAlign = 'center'
}

// 参数变化时自动重画（deep: true 监听整个表单对象）
watch(form, draw, { deep: true })
onMounted(draw)
</script>

<template>
  <div>
    <!-- 曲线类型 + 参数设置 -->
    <el-card shadow="never">
      <div class="controls">
        <!-- 曲线类型切换 -->
        <el-radio-group v-model="form.type">
          <el-radio-button value="line">📈 直线（一次函数）</el-radio-button>
          <el-radio-button value="parabola">🌀 抛物线（二次函数）</el-radio-button>
          <el-radio-button value="ellipse">⭕ 椭圆</el-radio-button>
        </el-radio-group>

        <!-- 直线参数 -->
        <div v-if="form.type === 'line'" class="line-config">
          <span class="line-tag" style="color: #409eff">l₁（蓝）</span>
          <span class="formula">y =</span>
          <el-input-number v-model="form.k1" :precision="2" :step="0.5" />
          <span class="formula">x +</span>
          <el-input-number v-model="form.b1" :precision="2" :step="0.5" />
        </div>
        <div v-if="form.type === 'line'" class="line-config">
          <el-checkbox v-model="form.showLine2">画第二条直线（方程组）</el-checkbox>
          <template v-if="form.showLine2">
            <span class="line-tag" style="color: #f56c6c">l₂（红）</span>
            <span class="formula">y =</span>
            <el-input-number v-model="form.k2" :precision="2" :step="0.5" />
            <span class="formula">x +</span>
            <el-input-number v-model="form.b2" :precision="2" :step="0.5" />
          </template>
        </div>

        <!-- 抛物线参数 -->
        <div v-if="form.type === 'parabola'" class="line-config">
          <span class="line-tag" style="color: #409eff">y =</span>
          <el-input-number v-model="form.pa" :precision="2" :step="0.25" />
          <span class="formula">x² +</span>
          <el-input-number v-model="form.pb" :precision="2" :step="0.5" />
          <span class="formula">x +</span>
          <el-input-number v-model="form.pc" :precision="2" :step="0.5" />
        </div>

        <!-- 椭圆参数 -->
        <div v-if="form.type === 'ellipse'" class="line-config">
          <span class="formula">( x −</span>
          <el-input-number v-model="form.eh" :precision="1" :step="0.5" />
          <span class="formula">)² / a² + ( y −</span>
          <el-input-number v-model="form.ek" :precision="1" :step="0.5" />
          <span class="formula">)² / b² = 1，其中</span>
        </div>
        <div v-if="form.type === 'ellipse'" class="line-config">
          <span class="formula">a =</span>
          <el-input-number v-model="form.ea" :precision="1" :step="0.5" :min="0.1" />
          <span class="formula">b =</span>
          <el-input-number v-model="form.eb" :precision="1" :step="0.5" :min="0.1" />
        </div>
      </div>
    </el-card>

    <!-- 图象 -->
    <el-card shadow="never" style="margin-top: 16px">
      <div class="canvas-wrap">
        <canvas ref="canvasRef"></canvas>
      </div>
      <el-alert v-if="conclusion" :title="conclusion" type="success" :closable="false" class="conclusion" />
    </el-card>

    <!-- 数学原理 -->
    <el-card shadow="never" style="margin-top: 16px">
      <h3 style="margin-top: 0">📖 数学原理</h3>
      <ul class="theory">
        <li><b>一次函数 y = kx + b</b> 的图象是直线：k 是斜率，b 是截距；两个一次方程组成方程组时，<b>交点坐标就是方程组的解</b>（平行 → 无解，重合 → 无数解）。</li>
        <li><b>一元二次函数 y = ax² + bx + c</b> 的图象是抛物线：顶点坐标为 <b>(-b/2a, (4ac-b²)/4a)</b>，直线 x = -b/2a 是它的对称轴；a &gt; 0 开口向上有最小值，a &lt; 0 开口向下有最大值。</li>
        <li><b>椭圆 (x-h)²/a² + (y-k)²/b² = 1</b>：中心是 (h, k)，a、b 分别是横向、纵向的半轴长；当 <b>a = b 时椭圆退化为圆</b>。</li>
      </ul>
    </el-card>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.line-config {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.line-tag {
  font-weight: bold;
  margin-left: 8px;
}

.formula {
  font-family: 'Times New Roman', serif;
  font-style: italic;
  font-size: 16px;
}

/* 画布居中，浅色背景更像稿纸 */
.canvas-wrap {
  display: flex;
  justify-content: center;
  background: #fcfdff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.conclusion {
  margin-top: 12px;
}

.theory {
  line-height: 2;
  color: #606266;
  padding-left: 20px;
  margin: 0;
}
</style>
