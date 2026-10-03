# Multi-stage build for Metrónomo by Cucco

# Stage 1: Build the React/Vite application
FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder
WORKDIR /app

# Copy package descriptors first to cache dependency layers
COPY package*.json ./
RUN npm ci

# Copy all source files and configuration
COPY . .

# Build the production static bundle
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:1.30.5-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx configuration and shared security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
