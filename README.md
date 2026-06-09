# docte

牙科诊疗服务平台，包含后台管理端、小程序端及 uniCloud 后端。

## 项目结构

```
docte/
├── pc-admin/          # 后台管理端 (Vue.js + Vite)
├── docte-master/      # 小程序端 (uni-app) + uniCloud 后端 (阿里云)
├── README.md
└── .gitignore
```

## 技术栈

| 模块 | 技术 |
|------|------|
| pc-admin | Vue 3 + Vite + Element Plus |
| docte-master | uni-app (微信小程序) |
| 后端 | uniCloud (阿里云) |

## 快速开始

### pc-admin

```bash
cd pc-admin
npm install
npm run dev
```

### docte-master（小程序）

使用 HBuilderX 打开 `docte-master` 目录，配置微信小程序 AppID 后运行。

## Goal 本地检查

在部署或真实环境验收前，可以先运行本地结构检查，确认 `goal.md` 要求的关键代码、schema、脚本和文档都已落地：

```bash
node scripts/check-goal-local.mjs
```

这个检查不替代真实环境验收；微信订阅消息、uniCloud 部署、分页真实数据、发票状态刷新仍需要按 `docte-master/README.md` 和 `pc-admin/README.md` 的验收步骤执行。

部署和最终验收步骤集中记录在 `DEPLOY_GOAL.md`。
