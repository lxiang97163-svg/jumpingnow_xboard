# Xboard - Jumping 主题

基于 Xboard 的机场面板，Jumping 落地页，域名 jumpingnow.com。MySQL + Redis + Nginx + SSL，可直接迁移上线。

## 部署（上线）

前置：域名 jumpingnow.com 解析到服务器、SSL 证书在 `/etc/letsencrypt/live/jumpingnow.com/`、防火墙放行 80/443。

```bash
cd xboard
cp .env.example .env
# .env 中 APP_URL=https://jumpingnow.com，DB_PASSWORD 已与 compose 一致

./scripts/validate.sh          # 可选：校验 landing、jumping-theme、路径、配置一致性
docker compose up -d db redis  # MySQL 有健康检查，web 会在 db 就绪后自动启动

docker compose run -it --rm -e ENABLE_REDIS=true -e ADMIN_ACCOUNT=你的邮箱 web php artisan xboard:install
# 记录输出的管理员账号密码

docker compose up -d
```

验收：https://jumpingnow.com/（落地页）、/plan、/user、/admin

## 本地测试

```bash
cp .env.example .env
# 修改 .env：APP_URL=http://localhost
./scripts/validate.sh          # 可选：校验 landing、jumping-theme、路径、配置一致性
docker compose up -d db redis   # MySQL 健康检查后 web 自动启动，无需 sleep
docker compose run -it --rm -e ENABLE_REDIS=true -e ADMIN_ACCOUNT=admin@test.com web php artisan xboard:install
docker compose up -d
./scripts/verify-local.sh      # 可选：执行本地部署验证（访问 /、/landing/、/plan、/user、/admin）
```

访问 http://localhost

## 上线后

后台配置支付、节点、套餐；修改管理员密码；可选配置 MAIL_* 用于找回密码。

SSL 续期后：`docker compose restart nginx`
