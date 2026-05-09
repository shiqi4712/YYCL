# YYCL 训练系统 - 部署文档

## 系统要求

- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- 内存：2GB+
- 磁盘：10GB+
- 开放端口：3006（Nginx 入口），3001/3002/3003（内部后端服务，建议仅允许本机访问）

## 一键部署

在服务器上执行以下命令即可完成部署：

```bash
curl -fsSL https://raw.githubusercontent.com/shiqi4712/YYCL/main/deploy/install.sh | bash
```

部署完成后，请根据终端提示修改 `.env` 文件中的敏感配置（API Key、JWT Secret 等），然后执行 `pm2 restart all` 重启服务。

## 更新代码

```bash
curl -fsSL https://raw.githubusercontent.com/shiqi4712/YYCL/main/deploy/update.sh | bash
```

## 目录结构

```
/home/www/yycl/
├── packages/
│   ├── backend-core/     # 核心服务 (端口 3001)
│   ├── backend-ai/       # AI 引擎 (端口 3002)
│   ├── backend-data/     # 数据服务 (端口 3003)
│   ├── frontend-teacher/ # 教师端前端
│   └── frontend-admin/   # 管理后台前端
├── ecosystem.config.js   # PM2 配置
├── deploy/               # 部署脚本
└── .git/
```

## 服务说明

| 服务 | 内部端口 | Nginx 代理路径 | 进程管理 |
|------|---------|---------------|---------|
| Core API | 3001 | `/api/*` (兜底) | PM2 |
| AI API | 3002 | `/api/chat`, `/api/review` | PM2 |
| Data API | 3003 | `/api/stats/teacher`, `/api/stats/team` | PM2 |
| 教师端 | - | `/` (静态文件) | Nginx |
| 管理后台 | - | `/admin/` (静态文件) | Nginx |

## 配置说明

部署后会自动生成 `.env` 文件，但 **必须手动修改以下敏感配置**：

### 1. DeepSeek API Key
编辑 `packages/backend-ai/.env` 和 `packages/backend-data/.env`：
```
DEEPSEEK_API_KEY="sk-your-real-key"
```

### 2. JWT Secret
编辑 `packages/backend-core/.env`：
```
JWT_SECRET="your-strong-secret-key"
```

修改后重启：
```bash
pm2 restart all
```

## 常用命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs

# 重启所有服务
pm2 restart all

# 重启 Nginx
sudo systemctl restart nginx
```

## 与 SK 项目隔离

YYCL 项目部署在 `/home/www/yycl`，对外端口为 **3006**，与 SK 项目（端口 3000）完全独立，互不影响。

## 注意事项

- 数据库使用 SQLite，文件位于 `packages/backend-core/prisma/dev.db`，建议定期备份。
- 首次部署时会自动创建默认管理员账号 `admin / admin123`，请在正式使用后修改密码。
- 如需配置域名和 HTTPS，请在 Nginx 配置中自行添加 SSL 证书相关配置。
