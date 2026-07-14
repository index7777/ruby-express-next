import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' -> build 出來的 dist/ 用相對路徑引用資源，
// 可以直接部署在 GitHub Pages 子路徑，也可以直接部署在 Vercel 根目錄，
// 兩邊都不用另外調整 base path 設定。
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
