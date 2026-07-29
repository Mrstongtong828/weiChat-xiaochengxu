import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/dist/index.css'
import './styles/shadcn.css'
// Element Plus 组件本身由 unplugin 按需自动引入（见 vite.config.js），此处不再全量 import。
// 图标改为「只引入实际用到的」并全局注册：模板里既有 <el-icon><Search/></el-icon>，
// 也有 prefix-icon="Search" 这类字符串用法，两者都依赖全局注册，故显式注册这批。
import {
  ArrowDown, ArrowRight, Avatar, Bell, Box, Camera, ChatDotSquare, CircleCheck, DataAnalysis, Delete, Document,
  Download, Files, Fold, HomeFilled, InfoFilled, Lock, Money, Monitor, Plus,
  Printer, QuestionFilled, Refresh, Search, Setting, SwitchButton, Tickets,
  Upload, UploadFilled, User, Van, VideoPlay, View, Warning
} from '@element-plus/icons-vue'
import router from './router'
import App from './App.vue'

const usedIcons = {
  ArrowDown, ArrowRight, Avatar, Bell, Box, Camera, ChatDotSquare, CircleCheck, DataAnalysis, Delete, Document,
  Download, Files, Fold, HomeFilled, InfoFilled, Lock, Money, Monitor, Plus,
  Printer, QuestionFilled, Refresh, Search, Setting, SwitchButton, Tickets,
  Upload, UploadFilled, User, Van, VideoPlay, View, Warning
}

const app = createApp(App)

for (const [name, comp] of Object.entries(usedIcons)) {
  app.component(name, comp)
}

app.use(createPinia()).use(router).mount('#app')
