#!/bin/bash
set -e

PROJECT_DIR="/home/www/yycl"
REPO_URL="https://github.com/shiqi4712/YYCL.git"
PORT=3006

echo "========================================"
echo "  YYCL 训练系统 - 一键部署脚本"
echo "========================================"

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "无法检测操作系统"
    exit 1
fi

echo "[1/10] 安装系统依赖..."

install_deps() {
    if command -v node &> /dev/null && node -v | grep -q "v20"; then
        echo "Node.js 20 已安装"
    else
        echo "安装 Node.js 20..."
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs git nginx
        elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "rocky" ] || [ "$OS" = "almalinux" ]; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
            yum install -y nodejs git nginx
        else
            echo "不支持的操作系统: $OS"
            exit 1
        fi
    fi

    if ! command -v pm2 &> /dev/null; then
        echo "安装 PM2..."
        npm install -g pm2
    fi
}

install_deps

echo "[2/10] 克隆代码到 $PROJECT_DIR..."
mkdir -p $PROJECT_DIR
if [ -d "$PROJECT_DIR/.git" ]; then
    cd $PROJECT_DIR
    git pull origin main
else
    git clone $REPO_URL $PROJECT_DIR
    cd $PROJECT_DIR
fi

echo "[3/10] 安装项目依赖..."
npm install

echo "[4/10] 生成环境配置文件..."
generate_env() {
    local pkg=$1
    local file="$PROJECT_DIR/packages/$pkg/.env"
    if [ ! -f "$file" ]; then
        cp "$PROJECT_DIR/packages/$pkg/.env.example" "$file"
        echo "  - 已生成 packages/$pkg/.env（请检查并填写真实值）"
    else
        echo "  - packages/$pkg/.env 已存在，跳过"
    fi
}
generate_env backend-core
generate_env backend-ai
generate_env backend-data

echo "[5/10] 初始化数据库..."
cd $PROJECT_DIR/packages/backend-core

# 创建数据库文件目录
mkdir -p prisma

# Prisma generate
npx prisma generate

# 数据库同步（无 migrations 时使用 db push）
npx prisma db push --accept-data-loss

# 种子数据
if [ -f prisma/seed.ts ]; then
    npx tsx prisma/seed.ts
fi

# 为 backend-ai 和 backend-data 创建数据库符号链接
ln -sf $PROJECT_DIR/packages/backend-core/prisma/dev.db $PROJECT_DIR/packages/backend-ai/dev.db
ln -sf $PROJECT_DIR/packages/backend-core/prisma/dev.db $PROJECT_DIR/packages/backend-data/dev.db

echo "[6/10] 生成 Prisma Client（其他服务）..."
cd $PROJECT_DIR/packages/backend-ai
npx prisma generate --schema=../backend-core/prisma/schema.prisma

cd $PROJECT_DIR/packages/backend-data
npx prisma generate --schema=../backend-core/prisma/schema.prisma

echo "[7/10] 修改管理端部署配置..."
cd $PROJECT_DIR
if ! grep -q "base:" packages/frontend-admin/vite.config.ts; then
    sed -i "s/export default defineConfig({/export default defineConfig({\n  base: '\/admin\/',/" packages/frontend-admin/vite.config.ts
    echo "  - 已添加 base: '/admin/' 到 vite.config.ts"
fi
if ! grep -q "import.meta.env.BASE_URL" packages/frontend-admin/src/router/index.ts; then
    sed -i "s/history: createWebHistory()/history: createWebHistory(import.meta.env.BASE_URL)/" packages/frontend-admin/src/router/index.ts
    echo "  - 已更新 router base URL"
fi

echo "[8/10] 构建项目..."
cd $PROJECT_DIR
npm run build

echo "[9/10] 配置 Nginx..."
NGINX_CONF="/etc/nginx/conf.d/yycl.conf"
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    NGINX_USER="www-data"
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    NGINX_USER="nginx"
else
    NGINX_USER="www-data"
fi

cat > $NGINX_CONF << 'EOF'
server {
    listen 3006;
    server_name _;
    client_max_body_size 50M;

    # 教师端前端
    location / {
        root /home/www/yycl/packages/frontend-teacher/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 管理后台前端
    location /admin/ {
        alias /home/www/yycl/packages/frontend-admin/dist/;
        index index.html;
        try_files $uri $uri/ =404;
    }

    # AI 服务代理
    location /api/chat {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/review {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Data 服务代理
    location /api/stats/teacher {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/stats/team {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Core 服务代理（兜底）
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

nginx -t && systemctl restart nginx || service nginx restart

echo "[10/10] 配置并启动后端服务..."
cd $PROJECT_DIR
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'yycl-core',
      cwd: '/home/www/yycl/packages/backend-core',
      script: 'dist/app.js',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'yycl-ai',
      cwd: '/home/www/yycl/packages/backend-ai',
      script: 'dist/app.js',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'yycl-data',
      cwd: '/home/www/yycl/packages/backend-data',
      script: 'dist/app.js',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' }
    }
  ]
}
EOF

pm2 start ecosystem.config.js
pm2 save

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "访问地址："
echo "  教师端:   http://服务器IP:3006"
echo "  管理后台: http://服务器IP:3006/admin"
echo ""
echo "默认管理员账号："
echo "  用户名: admin"
echo "  密码:   admin123"
echo ""
echo "【重要】请修改以下文件中的敏感配置："
echo "  - $PROJECT_DIR/packages/backend-ai/.env    (DEEPSEEK_API_KEY)"
echo "  - $PROJECT_DIR/packages/backend-data/.env  (DEEPSEEK_API_KEY)"
echo "  - $PROJECT_DIR/packages/backend-core/.env  (JWT_SECRET)"
echo ""
echo "修改后执行：pm2 restart all"
echo ""
