#!/usr/bin/env bash
# 校验 landing、jumping-theme、路径、配置一致性
# 在 xboard 目录下执行：./scripts/validate.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XBOARD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$XBOARD_DIR"

ERRORS=0

echo "=== 1. 目录存在性 ==="
if [[ ! -d "landing" ]]; then
  echo "❌ landing 目录不存在"
  ((ERRORS++))
else
  echo "✓ landing/"
fi
if [[ ! -f "landing/index.html" ]]; then
  echo "❌ landing/index.html 不存在"
  ((ERRORS++))
else
  echo "✓ landing/index.html"
fi
if [[ ! -f "landing/assets/css/style.css" ]]; then
  echo "❌ landing/assets/css/style.css 不存在"
  ((ERRORS++))
else
  echo "✓ landing/assets/css/style.css"
fi

if [[ ! -d "jumping-theme" ]]; then
  echo "❌ jumping-theme 目录不存在"
  ((ERRORS++))
else
  echo "✓ jumping-theme/"
fi
if [[ ! -f "jumping-theme/jumping.css" ]]; then
  echo "❌ jumping-theme/jumping.css 不存在"
  ((ERRORS++))
else
  echo "✓ jumping-theme/jumping.css"
fi

echo ""
echo "=== 2. compose.yaml 路径与 nginx.conf 一致性 ==="
COMPOSE_LANDING=$(grep -E "landing.*nginx" compose.yaml | head -1 || true)
NGINX_LANDING=$(grep -E "/usr/share/nginx/html/landing" nginx.conf | head -1 || true)
if [[ -z "$NGINX_LANDING" ]]; then
  echo "❌ nginx.conf 中未找到 /usr/share/nginx/html/landing 挂载路径"
  ((ERRORS++))
else
  echo "✓ nginx landing 路径与 compose 一致"
fi

COMPOSE_JUMPING=$(grep "jumping-theme" compose.yaml | head -1 || true)
if [[ -z "$COMPOSE_JUMPING" ]]; then
  echo "❌ compose.yaml 中未挂载 jumping-theme"
  ((ERRORS++))
else
  echo "✓ compose web 挂载 jumping-theme -> /www/public/theme/jumping"
fi

echo ""
echo "=== 3. .env 与 compose DB 配置一致性 ==="
if [[ ! -f ".env" ]]; then
  echo "⚠  .env 不存在，请先 cp .env.example .env"
  ((ERRORS++))
else
  ENV_DB_HOST=$(grep "^DB_HOST=" .env 2>/dev/null | cut -d= -f2)
  ENV_DB_DATABASE=$(grep "^DB_DATABASE=" .env 2>/dev/null | cut -d= -f2)
  ENV_DB_USERNAME=$(grep "^DB_USERNAME=" .env 2>/dev/null | cut -d= -f2)
  ENV_DB_PASSWORD=$(grep "^DB_PASSWORD=" .env 2>/dev/null | cut -d= -f2)

  if [[ "$ENV_DB_HOST" != "db" ]]; then
    echo "❌ .env DB_HOST=$ENV_DB_HOST，应为 db（compose 服务名）"
    ((ERRORS++))
  else
    echo "✓ DB_HOST=db"
  fi
  if [[ "$ENV_DB_DATABASE" != "xboard" ]]; then
    echo "❌ .env DB_DATABASE=$ENV_DB_DATABASE，应为 xboard"
    ((ERRORS++))
  else
    echo "✓ DB_DATABASE=xboard"
  fi
  if [[ "$ENV_DB_USERNAME" != "xboard" ]]; then
    echo "❌ .env DB_USERNAME=$ENV_DB_USERNAME，应为 xboard"
    ((ERRORS++))
  else
    echo "✓ DB_USERNAME=xboard"
  fi
  if [[ "$ENV_DB_PASSWORD" != "xboard_pass_2024" ]]; then
    echo "❌ .env DB_PASSWORD 与 compose 中 MYSQL_PASSWORD 不一致"
    ((ERRORS++))
  else
    echo "✓ DB_PASSWORD 与 compose 一致"
  fi
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
  echo "校验失败，共 $ERRORS 项问题"
  exit 1
else
  echo "✓ 校验通过"
  exit 0
fi
