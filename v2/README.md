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

当前 AI 对话先使用 mock 规则引擎，便于本地联调与演示。后续可以把 `mock-ai.ts` 平滑替换为真实外部大模型调用。
