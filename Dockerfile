# Multi-stage build for Metrónomo by Cucco

# Stage 1: Build the React/Vite application
FROM node:26.10.0-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS builder
WORKDIR /app

# Node 26 no trae corepack: pnpm va en su propia capa (no se invalida con cada cambio de dependencias)
RUN npm i -g pnpm@11

# Copy package descriptors first to cache dependency layers
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy all source files and configuration
COPY . .

# Build the production static bundle
RUN pnpm build

# Stage 2: Serve the application using Nginx
FROM nginx:1.31.0-alpine@sha256:2f07d83bf561b506400dc183b1b2003803e39efbd22451f848adaba14d28c7c7
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx configuration and shared security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
