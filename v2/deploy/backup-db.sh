#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_FILE="$APP_ROOT/prisma/dev.db"
BACKUP_DIR="$APP_ROOT/prisma/backups"

mkdir -p "$BACKUP_DIR"

timestamp=$(date +"%Y%m%d-%H%M%S")
cp "$DB_FILE" "$BACKUP_DIR/dev-$timestamp.db"

find "$BACKUP_DIR" -type f -name "*.db" -mtime +14 -delete

echo "Database backup created: $BACKUP_DIR/dev-$timestamp.db"
