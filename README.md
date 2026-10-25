# 2026 ECNU 软件工程大作业一 - MongoDB 问卷系统 (第二阶段)

本项目是一个基于 Node.js + Express + MongoDB + EJS 的在线问卷系统。在第一阶段（基础问卷发布、填写、跳转、校验）的基础上，第二阶段根据用户需求变更，成功引入了题目题库、版本控制、团队共享以及跨问卷统计功能，并严格保证了旧数据与旧功能的兼容性。

## 第二阶段新增核心功能

1. 题目复用与题库管理：支持创建独立于问卷的题目，存入“我的题库”，做新问卷时可直接选用。
2. 团队共享：题目可共享给其他注册用户，对方可在自己的题库和问卷中使用。
3. 发布后数据保护：问卷一旦发布，拒绝任何题目修改操作，保证收集数据的一致性。
4. 版本控制机制：基于题库题目创建新版本（v1 -> v2），新旧版本可同时存在，旧问卷依然引用旧版本快照。
5. 跨问卷全局统计：基于题目模板 ID，聚合统计该题在所有问卷中的总体回答分布。

## 技术栈
- 后端：Node.js (v18+), Express, Mongoose, JWT 鉴权
- 数据库：MongoDB (独立集合划分，拒绝单一集合冗余)
- 前端：EJS 模板, 原生 HTML/Fetch API
- 测试：Jest + Supertest (9个自动化测试用例，全量回归通过)

## 核心目录结构说明

survey-system/
├── models/                 
│   ├── User.js             # 用户模型
│   ├── Survey.js           # 问卷模型
│   ├── Question.js         # 问卷内的题目实例（含版本快照）
│   ├── QuestionLibrary.js  # [新增] 题库本体模型
│   ├── QuestionVersion.js  # [新增] 题库版本历史模型
│   └── Response.js         # 答卷模型（新增 templateId 用于跨问卷统计）
├── routes/
│   ├── auth.js             # 登录注册
│   ├── pages.js            # 页面渲染路由（/view 前缀）
│   ├── surveys.js          # 问卷管理（含发布保护）
│   ├── library.js          # [新增] 题库管理路由（创建/版本/共享）
│   ├── fill.js             # 填写问卷与跳转逻辑
│   └── stats.js            # 统计聚合（单问卷统计 + 跨问卷统计）
├── services/
│   ├── validationEngine.js # 校验引擎（数据驱动）
│   └── jumpEngine.js       # 跳转引擎（拓扑排序防环）
├── views/                  # EJS 前端页面
├── tests/api.test.js       # 接口自动化测试用例
├── app.js                  # 程序入口
└── .env                    # 环境变量配置

## 数据库设计理念 (MongoDB 优势)

本系统未使用关系型数据库，原因如下：
- 动态题型的天然契合：不同题型（单选、多选、文本、数字）的规则字段完全不同，MongoDB 的文档模型允许字段按需出现。
- 数据解耦与快照设计：为了满足需求三（修改不影响旧问卷）和需求五（不同版本并存），第二阶段将题目拆分为 QuestionLibrary（本体）和 QuestionVersion（版本）。在向问卷添加题目时，系统将该版本的内容快照存入 Question 集合，实现了彻底解耦。
- 高性能跨问卷统计：在答卷（Response）的答案数组中增加 templateId 字段。利用 MongoDB 的 $unwind 和 $match 聚合管道，可以瞬间完成基于索引的跨问卷统计，无需复杂的联表查询。

## 启动指南

1. 确保本地 MongoDB 服务已启动（默认端口 27017）。
2. 安装依赖：
   npm install
3. 配置环境变量（根目录新建 .env 文件）：
   PORT=3000
   MONGO_URI=mongodb://127.0.0.1:27017/survey_db
   JWT_SECRET=your_secret_key
4. 启动服务：
   npm run dev
5. 浏览器访问 http://localhost:3000/login

## 测试说明

运行测试前请确保本地 MongoDB 正在运行。
npm test
测试包含第一阶段的 5 个基础回归用例，以及第二阶段的 4 个新功能用例（题库共享、版本控制、发布拦截、跨问卷统计），共 9 个测试全部通过。

## 第二阶段新增 API 概览
- POST /library：将新题目存入题库
- POST /library/:id/versions：基于旧版本创建新版本
- GET /library：获取自己创建及被共享的题库列表
- PUT /library/:id/share：共享题目给他人
- GET /stats/template/:templateId：跨问卷统计单个题目的数据