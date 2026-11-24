// KaTeX 数学公式渲染工具
//
// KaTeX 是一个把 LaTeX 语法的数学公式渲染成漂亮排版的开源库，
// 比在网页上直接显示 "x = (-b±√(b²-4ac))/2a" 这样的纯文本美观得多。
//
// 用法示例（Formula 字段存的就是 LaTeX 字符串）：
//   x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}   →   一个分式 + 根号 + ±号的精美公式
import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * 把 LaTeX 字符串渲染成 HTML
 * @param {string} latex LaTeX 公式
 * @param {boolean} display 是否块级展示（独占一行、居中、放大），默认 true
 * @returns {string} 渲染好的 HTML（配合 v-html 使用）
 */
export function renderMath(latex, display = true) {
  if (!latex) return ''
  try {
    // throwOnError: false —— 公式写错时显示原始文本而不是整个报错，
    // 保证页面其他内容正常展示
    return katex.renderToString(latex, { throwOnError: false, displayMode: display })
  } catch (e) {
    return latex
  }
}
