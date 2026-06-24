# YYCL V2 部署说明

目标环境：
- Ubuntu 24.04
- 2G 内存 / 4 核 CPU / 50G 磁盘
- 单机部署

## 架构

V2 使用单后端架构：

- Node API：`3101`
- Nginx 对外入口：`80`
- SQLite：`v2/prisma/dev.db`

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
DATABASE_URL="file:./dev.db"
```

## 常用命令

```bash
pm2 status
pm2 logs yycl-v2-api
pm2 restart yycl-v2-api
sudo systemctl restart nginx
```

## 数据库备份

项目已附带 SQLite 备份脚本：

```bash
bash /home/www/yycl/v2/deploy/backup-db.sh
```

建议通过 `crontab` 每天执行一次。
