import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // 👇👇👇 必须加这一行！变成相对路径 👇👇👇
  base: './', 
  
  // 👇 这一块是为了防止 "process is not defined" 报错 👇
  define: {
    'process.env': {}
  },

  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: {
        host: '10.0.0.103', 
        port: 3000,
    },
  },
  
  esbuild: {
    target: 'chrome68'
  },

  build: {
    outDir: 'dist', // 默认就是 dist，写上也无妨
  }
})