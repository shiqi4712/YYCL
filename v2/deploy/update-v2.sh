#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$APP_ROOT/.." && pwd)"
API_ROOT="$APP_ROOT/apps/api"

echo "==> Install dependencies"
cd "$API_ROOT"
npm install

echo "==> Regenerate Prisma client"
npm run db:generate

echo "==> Sync database schema"
npx prisma db push --schema=../../prisma/schema.prisma --skip-generate

echo "==> Refresh seed data"
npm run db:seed

echo "==> Rebuild API"
npm run build

echo "==> Restart services"
pm2 restart yycl-v2-api
sudo systemctl restart nginx

echo "Update completed."
