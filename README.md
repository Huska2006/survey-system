# 2026 ECNU 软件工程大作业一（全阶段）- 基于 MongoDB 的问卷系统

本项目是一个基于 Node.js + Express + MongoDB + EJS 的在线问卷系统。经过两个阶段的迭代开发，系统不仅具备了基础的问卷创建、填写、跳转与统计功能，还成功扩展出了题目库、版本控制、团队共享、防篡改保护以及跨问卷聚合统计等高级特性。

本项目严格遵循“不推倒重做”的原则，在第一阶段的架构上进行了平滑升级与数据结构解耦。

## 🛠️ 技术栈
- 后端：Node.js, Express, Mongoose
- 数据库：MongoDB
- 前端：EJS 模板, 原生 HTML/JS (Fetch API)
- 认证：JWT (JSON Web Token) + bcryptjs
- 测试：Jest + Supertest

## ✨ 核心功能说明

### 第一阶段：基础问卷功能
- 用户认证：注册、登录、基于 JWT 的权限隔离。
- 问卷管理：创建问卷、发布、关闭，支持短链接（slug）分享。
- 动态题型：单选、多选（支持数量限制）、文本（支持长度限制）、数字（支持范围与整数限制）。
- 条件跳转：数据驱动的题目跳转（如选A跳至Q3），内置 Kahn 拓扑排序防止跳转死循环。
- 答卷与统计：支持匿名/实名答卷，基于 MongoDB 聚合管道（$unwind, $group）自动统计选项分布与数字平均值。

### 第二阶段：题库与版本控制（需求变更升级）
- 题目库（Library）：题目被抽离为独立实体，可保存为模板，方便在多个问卷中重复使用。
- 团队共享：用户可以将自己创建的题目共享给其他用户。
- 版本历史（Versioning）：支持基于旧题创建新版本（v1 -> v2），并记录父子版本关系，随时可溯源。
- 快照与防篡改：已发布的问卷直接锁定，无法修改题目。向问卷添加题库题目时，采用“内容快照”机制，原题库的修改绝不会影响已发布问卷的数据一致性。
- 跨问卷统计：新增统计聚合逻辑，基于 templateId 可以跨越多份问卷，汇总同一道题的全局回答分布。

## 📁 目录结构

    survey-system/
    ├── models/                   # MongoDB 数据模型
    │   ├── User.js
    │   ├── Survey.js
    │   ├── Question.js           # 问卷内的题目快照
    │   ├── Response.js
    │   ├── QuestionLibrary.js    # [新增] 题库本体
    │   └── QuestionVersion.js    # [新增] 题库版本历史
    ├── routes/                   # 路由控制器
    │   ├── auth.js               # 认证接口
    │   ├── surveys.js            # 问卷增删改查与发布
    │   ├── fill.js               # 问卷填写与跳转引擎接入
    │   ├── stats.js              # 单问卷与跨问卷统计
    │   ├── library.js            # [新增] 题库管理与共享
    │   └── pages.js              # 前端页面渲染
    ├── services/                 # 核心业务引擎
    │   ├── validationEngine.js   # 校验引擎（规则数据化）
    │   └── jumpEngine.js         # 跳转引擎与环检测
    ├── middleware/               # 鉴权中间件
    ├── views/                    # EJS 前端页面
    ├── tests/                    # 自动化测试
    │   └── api.test.js           # 覆盖 9 大核心业务场景
    ├── app.js                    # 应用入口
    └── .env                      # 环境变量配置

## 🚀 快速启动指南

### 1. 环境准备
确保本地已安装 Node.js (v18+) 且 MongoDB 服务已启动（默认运行在 127.0.0.1:27017）。

### 2. 安装依赖
    npm install

### 3. 配置环境变量
在项目根目录创建 .env 文件，填入以下内容：

    PORT=3000
    MONGO_URI=mongodb://127.0.0.1:27017/survey_db
    JWT_SECRET=your_super_secret_key_123456

### 4. 启动服务
    npm run dev

启动后，浏览器访问 http://localhost:3000/login 即可进入系统。

## 🧪 自动化测试
本项目包含完善的接口级自动化测试用例（含第一阶段回归测试 + 第二阶段新功能测试）。
在运行测试前，请确保本地 MongoDB 处于运行状态。测试将自动连接 survey_test_db 并在结束后清空数据。

    npm test

预期结果：9 个测试用例（T1, T3, T4, T5, T6+T7, T8, T9, T10, T11）全部 PASS。

## 🔌 核心 API 说明

### 认证 (Auth)
- POST /auth/register：用户注册
- POST /auth/login：用户登录获取 Token

### 问卷管理 (Surveys)
- POST /surveys：创建新问卷
- GET /surveys：获取本人问卷列表
- POST /surveys/:id/questions：向未发布问卷添加题目（支持直接新建或从题库拉取快照）
- PUT /surveys/:id/publish：发布问卷（触发防篡改锁定与环检测）

### 题库管理 (Library)
- POST /library：创建新题目存入题库（v1）
- POST /library/:id/versions：基于原题派生新版本（v2, v3...）
- GET /library/:id/history：查看题目的历史版本树
- PUT /library/:id/share：将题目共享给其他用户
- GET /library：获取自己可用的题目列表（自己建的 + 别人共享的）

### 填写与统计 (Fill & Stats)
- GET /fill/:slug：获取问卷首题
- POST /fill/:slug/next：提交单题并触发后端校验与跳转计算
- POST /fill/:slug/submit：提交整份答卷
- GET /stats/:id：获取单份问卷的统计结果
- GET /stats/template/:templateId：跨问卷统计某个题库模板的全局数据