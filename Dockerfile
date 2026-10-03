# Multi-stage build for Metrónomo by Cucco

# Stage 1: Build the React/Vite application
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package descriptors first to cache dependency layers
COPY package*.json ./
RUN npm ci

# Copy all source files and configuration
COPY . .

# Build the production static bundle
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx configuration and shared security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
