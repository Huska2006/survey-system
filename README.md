# 2026 ECNU 软件工程大作业一（第一阶段）- MongoDB 问卷系统

本项目是一个基于 Node.js + Express + MongoDB + EJS 的简化版在线问卷系统。支持用户注册登录、问卷创建、四种题型配置（单选、多选、文本、数字）、数据驱动的条件跳转、后端严格校验以及自动聚合统计。

## 🛠️ 技术栈
- 后端：Node.js (v18+), Express, Mongoose
- 数据库：MongoDB (使用本地实例)
- 前端：EJS 模板, 原生 HTML/CSS/JS (Fetch API)
- 测试：Jest + Supertest
- 认证：JWT + bcryptjs

## 📁 目录结构
```text
survey-system/
├── models/       # MongoDB Schema (User, Survey, Question, Response)
├── routes/       # API 路由与页面路由 (auth, surveys, fill, stats)
├── services/     # 核心引擎 (校验引擎、跳转引擎、环检测)
├── middleware/   # JWT 鉴权中间件
├── views/        # EJS 前端页面
├── tests/        # Jest 接口自动化测试用例
├── app.js        # 程序入口
└── .env          # 环境变量配置