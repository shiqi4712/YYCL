#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$APP_ROOT/.." && pwd)"
API_ROOT="$APP_ROOT/apps/api"
PRISMA_ROOT="$APP_ROOT/prisma"
NGINX_CONF="/etc/nginx/sites-available/yycl-v2.conf"
PM2_CONFIG="$PROJECT_ROOT/ecosystem.v2.config.js"

echo "==> Install system dependencies"
sudo apt-get update
sudo apt-get install -y curl nginx default-mysql-client

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v20\|^v22\|^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "==> Verify project paths"
test -d "$API_ROOT"
test -d "$PRISMA_ROOT"

echo "==> Install Node dependencies"
cd "$API_ROOT"
npm install

echo "==> Prepare environment file"
if [ ! -f "$PRISMA_ROOT/.env" ]; then
  cp "$PRISMA_ROOT/.env.example" "$PRISMA_ROOT/.env"
fi

echo "==> Generate Prisma client"
npm run db:generate

echo "==> Sync database schema"
npx prisma db push --schema=../../prisma/schema.prisma --skip-generate

echo "==> Seed initial data"
npm run db:seed

echo "==> Build API"
npm run build

echo "==> Write PM2 config"
cat > "$PM2_CONFIG" <<EOF
module.exports = {
  apps: [
    {
      name: 'yycl-v2-api',
      cwd: '$API_ROOT',
      script: 'dist/app.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '700M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
EOF

echo "==> Write Nginx config"
sudo tee "$NGINX_CONF" >/dev/null <<EOF
server {
  listen 80;
  server_name _;
  client_max_body_size 20M;

  location / {
    proxy_pass http://127.0.0.1:3101;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/yycl-v2.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "==> Start PM2 service"
cd "$PROJECT_ROOT"
pm2 delete yycl-v2-api >/dev/null 2>&1 || true
pm2 start "$PM2_CONFIG"
pm2 save

echo "==> Configure PM2 startup"
pm2 startup systemd -u "$USER" --hp "$HOME" >/tmp/yycl-pm2-startup.txt || true
cat /tmp/yycl-pm2-startup.txt || true

echo ""
echo "Deployment completed."
echo "Teacher: http://<server-ip>/"
echo "Admin:   http://<server-ip>/admin"
echo ""
echo "Please update $PRISMA_ROOT/.env, especially JWT_SECRET."
