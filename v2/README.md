# YYCL V2

YYCL V2 是基于现有业务重新收口的一版轻量化训练系统，目标是先跑通：

- 单后端 API
- SQLite + Prisma 持久化
- 多异议步骤训练链路
- 结构化点评
- 后续可挂接教师端和管理端 Web

## 当前范围

当前目录先提供最小可演示后端基座：

- `apps/api`: 单一 Node API
- `packages/shared`: V2 共享类型
- `prisma`: 数据模型与种子数据

## 目录结构

```text
v2/
  apps/
    api/
  packages/
    shared/
  prisma/
```

## 启动方式

在 `v2/apps/api` 目录执行：

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## 默认账号

- 培训师：`trainer01 / 123456`
- 教师：`teacher01 / 123456`

## 已落地的接口

- `POST /api/auth/login`
- `GET /api/topics`
- `POST /api/training/sessions`
- `GET /api/training/sessions`
- `GET /api/training/sessions/:sessionId`
- `POST /api/training/sessions/:sessionId/messages`
- `POST /api/training/sessions/:sessionId/end`
- `POST /api/training/sessions/:sessionId/review`

## 说明

AI 对话默认使用 mock 规则引擎，便于本地联调与演示。生产环境可通过环境变量启用 DeepSeek V4：

```bash
AI_PROVIDER="deepseek"
DEEPSEEK_API_KEY="你的 DeepSeek API Key"
DEEPSEEK_MODEL="deepseek-v4-flash"
```

未配置 Key 或接口异常时，系统会自动回退到 mock 规则引擎。
