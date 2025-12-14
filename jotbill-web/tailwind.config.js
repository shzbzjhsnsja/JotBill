/** @type {import('tailwindcss').Config} */
export default {
  // 👇 重点修改这里！
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",          // 扫描根目录下的 App.tsx, index.tsx 等
    "./components/**/*.{js,ts,jsx,tsx}", // 扫描 components 文件夹
    "./services/**/*.{js,ts,jsx,tsx}",   // 扫描 services 文件夹(如果有用到样式)
  ],
  theme: {
    extend: {
      // 如果你之前在 CDN 脚本里配过自定义颜色（比如 apple gray），
      // 请务必把那些配置搬到这里！
    },
  },
  plugins: [],
}