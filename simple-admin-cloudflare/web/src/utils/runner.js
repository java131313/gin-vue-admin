// 浏览器内运行 JavaScript 代码（用于 Node 代码题的「在线运行」）
//
// 原理：用 new Function 把代码包成一个函数，注入一个「假 console」，
// 代码里的 console.log 会被收集起来，运行结束后统一返回输出文本。
//
// 限制：纯 JS 可以运行；require('fs') 这类 Node 内置模块不可用。

// 把参数格式化成字符串（对象转 JSON，undefined 显示 undefined）
function fmt(arg) {
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg)
    } catch {
      return String(arg)
    }
  }
  return String(arg)
}

/**
 * 在浏览器沙箱中运行 JS 代码，返回输出文本
 * @param {string} code 要运行的代码
 * @param {number} waitMs 同步执行后再等待多久（收集 setTimeout/Promise 的异步输出）
 * @returns {Promise<string>} 捕获到的 console 输出（或错误信息）
 */
export async function runJS(code, waitMs = 1000) {
  const logs = []
  // 假 console：把 log/info/warn/error 都收集到 logs
  const sandboxConsole = {
    log: (...args) => logs.push(args.map(fmt).join(' ') + '\n'),
    info: (...args) => logs.push(args.map(fmt).join(' ') + '\n'),
    warn: (...args) => logs.push(args.map(fmt).join(' ') + '\n'),
    error: (...args) => logs.push(args.map(fmt).join(' ') + '\n')
  }

  try {
    // new Function 参数名是 console，函数体是用户代码
    // "use strict" 避免意外创建全局变量
    const fn = new Function('console', '"use strict";\n' + code)
    fn(sandboxConsole)
  } catch (e) {
    logs.push('运行错误: ' + e.message)
  }

  // 等待一小段时间，收集 setTimeout / Promise 产生的异步输出
  await new Promise((resolve) => setTimeout(resolve, waitMs))

  return logs.length ? logs.join('') : '（程序运行成功，但没有输出）'
}
