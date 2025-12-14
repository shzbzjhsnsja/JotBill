import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// 这是针对 WebView 混合应用优化的最终配置
export default defineConfig({
  plugins: [
    react(), 
    legacy({
      // 强制生成 ES5 兼容代码
      targets: ['defaults', 'not IE 11', 'chrome 58'], 
      polyfills: true, // 确保包含所有必要的 polyfill
    }),

    {
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/crossorigin/g, '');
      }
    }
    
  ],

  // 关键修复：解决许多 npm 库在 WebView 中检查 process.env 导致的 ReferenceError
  define: {
    'process.env': {} 
  },

  
    

  // 关键修复：确保所有资源引用都是相对路径
  base: './', 

  
  esbuild: {
    // 强制 ESBuild 也使用最保守的目标
    target: 'es2015' 
  },

  build: {
    // 确保 assetsInlineLimit 不会太大，避免资源被内联导致加载问题
    assetsInlineLimit: 4096,
    outDir: 'dist'
  },

  experimental: {
    renderBuiltUrl(filename, { hostId, type }) {
      // 这有助于确保相对路径正确
      return './' + filename
    }
  },

  server: {
  host: '0.0.0.0',
  port: 5173,
  strictPort: true,
}

})