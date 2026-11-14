# Multi-stage build for Metrónomo by Cucco

# Stage 1: Build the React/Vite application
FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS builder
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
FROM nginx:1.31.7-alpine@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx configuration and shared security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
