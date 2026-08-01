import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Element Plus 按需自动引入：组件（el-xxx）及其样式随用随引，
    // 替代 main.js 里的全量 import，显著减小首屏与总包体积。
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
  build: {
    rollupOptions: {
      output: {
        // 把重型三方库拆成独立异步 chunk，避免和业务代码挤在一个包里。
        // Vite 8 底层是 rolldown，manualChunks 需为函数形式。
        manualChunks(id) {
          if (id.includes('@wangeditor')) return 'vendor-editor'
          if (id.includes('exceljs')) return 'vendor-excel'
          if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts'
          if (id.includes('element-plus')) return 'vendor-element'
        },
      },
    },
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'https://env-00jy6g4qwi94.dev-hz.cloudbasefunction.cn',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      }
    }
  },
  preview: {
    allowedHosts: ['.trycloudflare.com'],
  },
})
