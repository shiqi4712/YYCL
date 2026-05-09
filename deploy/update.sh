#!/bin/bash
set -e

PROJECT_DIR="/home/www/yycl"

echo "========================================"
echo "  YYCL 训练系统 - 更新脚本"
echo "========================================"

cd $PROJECT_DIR

echo "[1/5] 拉取最新代码..."
git pull origin main

echo "[2/5] 安装依赖..."
npm install

echo "[3/5] 重新应用管理端配置..."
if ! grep -q "base:" packages/frontend-admin/vite.config.ts; then
    sed -i "s/export default defineConfig({/export default defineConfig({\n  base: '\/admin\/',/" packages/frontend-admin/vite.config.ts
fi
if ! grep -q "import.meta.env.BASE_URL" packages/frontend-admin/src/router/index.ts; then
    sed -i "s/history: createWebHistory()/history: createWebHistory(import.meta.env.BASE_URL)/" packages/frontend-admin/src/router/index.ts
fi

echo "[4/5] 构建项目..."
npm run build

echo "[5/5] 数据库同步并重启服务..."
cd packages/backend-core
npx prisma db push --accept-data-loss

cd $PROJECT_DIR
pm2 restart all

echo ""
echo "更新完成！"
echo "访问地址：http://服务器IP:3006"
