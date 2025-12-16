/** @type {import('tailwindcss').Config} */
export default {
  // 🔥 核心修改：必须加这一行！
  // 'class' 模式表示：只有当 html 标签上有 class="dark" 时，才应用深色样式
  // 这样我们就可以通过鸿蒙原生代码发指令来控制它了
  darkMode: 'class', 

  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",          
    "./components/**/*.{js,ts,jsx,tsx}", 
    "./services/**/*.{js,ts,jsx,tsx}",   
  ],
  theme: {
    extend: {
      // 保持你原有的扩展配置（如果有）
    },
  },
  plugins: [],
}