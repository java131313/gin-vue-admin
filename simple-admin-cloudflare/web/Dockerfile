# ==========================================================
# 第一阶段：构建前端静态文件
# ==========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. 先单独拷贝 package 文件并安装依赖（同上，利用 Docker 缓存加速）
COPY package.json package-lock.json ./
# 国内网络环境下用 npmmirror 镜像源更快；如果失败则回退官方源
RUN npm ci --registry=https://registry.npmmirror.com || npm ci

# 2. 拷贝源码并构建（产物在 dist/ 目录）
COPY . .
RUN npm run build

# ==========================================================
# 第二阶段：用 Nginx 托管静态文件并反向代理后端接口
# ==========================================================
FROM nginx:alpine

# 拷贝构建产物到 Nginx 的网页目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 覆盖 Nginx 站点配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
