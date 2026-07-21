#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$APP_ROOT/prisma/.env"
BACKUP_DIR="$APP_ROOT/prisma/backups"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "mysqldump is required. Install it with: sudo apt-get install -y default-mysql-client" >&2
  exit 1
fi

DATABASE_URL="$(
  ENV_FILE="$ENV_FILE" python3 <<'PY'
import os
from pathlib import Path

env_file = Path(os.environ["ENV_FILE"])
for line in env_file.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.strip() == "DATABASE_URL":
        print(value.strip().strip('"').strip("'"))
        break
PY
)"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is missing in $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +"%Y%m%d-%H%M%S")"
backup_file="$BACKUP_DIR/mysql-$timestamp.sql.gz"

DATABASE_URL="$DATABASE_URL" BACKUP_FILE="$backup_file" python3 <<'PY' | bash
import os
import shlex
from urllib.parse import urlparse, unquote

url = urlparse(os.environ["DATABASE_URL"])
if url.scheme not in {"mysql", "mysql2"}:
    raise SystemExit(f"Unsupported DATABASE_URL scheme for MySQL backup: {url.scheme}")

host = url.hostname or "127.0.0.1"
port = str(url.port or 3306)
user = unquote(url.username or "")
password = unquote(url.password or "")
database = (url.path or "").lstrip("/")
if not database:
    raise SystemExit("DATABASE_URL must include a database name")

backup_file = os.environ["BACKUP_FILE"]
cmd = [
    "MYSQL_PWD=" + shlex.quote(password),
    "mysqldump",
    "--single-transaction",
    "--quick",
    "-h", shlex.quote(host),
    "-P", shlex.quote(port),
    "-u", shlex.quote(user),
    shlex.quote(database),
    "|",
    "gzip",
    ">",
    shlex.quote(backup_file),
]
print(" ".join(cmd))
PY

find "$BACKUP_DIR" -type f -name "mysql-*.sql.gz" -mtime +14 -delete

echo "Database backup created: $backup_file"
