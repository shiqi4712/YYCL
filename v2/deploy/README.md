# YYCL V2 部署说明

目标环境：
- Ubuntu 24.04
- 2G 内存 / 4 核 CPU / 50G 磁盘
- 单机部署
- MySQL 8.x 或兼容版本

## 架构

V2 使用单后端架构：

- Node API：`3101`
- Nginx 对外入口：`80`
- MySQL：业务数据持久化

教师端与管理端是静态页面，由 API 进程直接提供静态文件，再由 Nginx 统一反向代理：

- `/` -> 教师训练台
- `/admin` -> 管理台
- `/api/*` -> API

## 推荐目录

```text
/home/www/yycl/
  v2/
    apps/
      api/
      web-admin/
      web-teacher/
    prisma/
    deploy/
```

## 首次部署

先准备 MySQL 数据库和账号，例如：

```sql
CREATE DATABASE yycl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'yycl_user'@'127.0.0.1' IDENTIFIED BY '请替换为强密码';
GRANT ALL PRIVILEGES ON yycl.* TO 'yycl_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

如果 API 和 MySQL 不在同一台机器，请把 `127.0.0.1` 换成 API 服务器来源 IP 或 `%`，并在服务器安全组/防火墙中只放行可信来源。

先把项目代码上传到服务器，例如：

```bash
mkdir -p /home/www/yycl
cd /home/www/yycl
git clone <your-repo-url> v2-repo
```

然后进入项目根目录执行：

```bash
cd /home/www/yycl/v2-repo/v2
bash deploy/install-v2.sh
```

如果你已经把 `v2` 目录直接放到 `/home/www/yycl/v2`，也可以在该目录下直接执行：

```bash
cd /home/www/yycl/v2
bash deploy/install-v2.sh
```

## 更新部署

```bash
cd /home/www/yycl/v2
bash deploy/update-v2.sh
```

更新脚本默认不会刷新种子数据，避免生产账号被默认 seed 覆盖。只有首次初始化或明确需要补默认数据时才执行：

```bash
cd /home/www/yycl/v2
RUN_SEED=1 bash deploy/update-v2.sh
```

## 默认账号

- 培训主管：`trainer01 / 123456`
- 教师：`teacher01 / 123456`

上线后请第一时间修改默认密码。

## 环境变量

编辑：

```bash
/home/www/yycl/v2/prisma/.env
```

建议至少修改：

```bash
JWT_SECRET="replace-with-a-strong-secret"
PORT="3101"
APP_NAME="YYCL V2 API"
DATABASE_URL="mysql://yycl_user:强密码@127.0.0.1:3306/yycl?connection_limit=5&pool_timeout=20"
```

如需启用 DeepSeek V4 家长模拟，在同一个 `.env` 文件追加：

```bash
AI_PROVIDER="deepseek"
DEEPSEEK_API_KEY="你的 DeepSeek API Key"
DEEPSEEK_MODEL="deepseek-v4-flash"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_THINKING="disabled"
```

如果希望质量优先，可将 `DEEPSEEK_MODEL` 改为 `deepseek-v4-pro`。未配置 Key 或接口异常时，系统会自动回退到本地模拟家长，避免训练中断。

## 常用命令

```bash
pm2 status
pm2 logs yycl-v2-api
pm2 restart yycl-v2-api
sudo systemctl restart nginx
```

## 数据库备份

项目已附带 MySQL 备份脚本，依赖 `mysqldump`：

```bash
bash /home/www/yycl/v2/deploy/backup-db.sh
```

备份文件会写入：

```text
/home/www/yycl/v2/prisma/backups/mysql-YYYYMMDD-HHMMSS.sql.gz
```

建议通过 `crontab` 每天执行一次，并定期下载到服务器之外保存。
