#!/bin/bash
# 生成自签名证书，用于本地测试或生产前临时使用
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="$DIR/certs/live/jumpingnow.com"
mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/CN=jumpingnow.com/O=Jumping/C=CN"
echo "Generated: $CERT_DIR/fullchain.pem, privkey.pem"
