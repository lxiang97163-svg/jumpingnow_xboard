#!/usr/bin/env bash
# 本地部署验证：检查各端点是否可访问
# 在 xboard 目录下、docker compose up -d 之后执行：./scripts/verify-local.sh
# 可选参数：BASE_URL，默认 http://localhost
set -e

BASE_URL="${1:-http://localhost}"
FAIL=0

echo "=== 本地部署验证：$BASE_URL ==="

check_url() {
  local url="$1"
  local name="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^(200|301|302)$ ]]; then
    echo "✓ $name ($url) -> $code"
  else
    echo "❌ $name ($url) -> $code"
    FAIL=1
  fi
}

check_url "$BASE_URL/" "落地页 /"
check_url "$BASE_URL/landing/" "落地页 /landing/"
check_url "$BASE_URL/plan" "套餐页 /plan"
check_url "$BASE_URL/user" "用户页 /user（未登录会 302 到登录）"
check_url "$BASE_URL/admin" "管理页 /admin（未登录会 302）"

echo ""
if [[ $FAIL -eq 1 ]]; then
  echo "部分端点不可用，请确认："
  echo "  1. docker compose up -d 已执行且各容器运行正常"
  echo "  2. 已执行 xboard:install 完成安装"
  exit 1
else
  echo "✓ 本地部署验证通过"
  exit 0
fi
