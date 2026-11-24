import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Vite 配置：https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],

  resolve: {
    // 配置 @ 指向 src 目录，import 时可以用 @/stores/user 代替层层 ../../
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },

  server: {
    port: 8080,
    // 开发环境跨域处理：浏览器访问的是 vite(8080)，
    // 这里把 /api 开头的请求转发给 Go 后端(8888)，由 vite 代为请求，绕过浏览器跨域限制
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true
      }
    }
  }
})
