# Multi-stage build for Metrónomo by Cucco

# Stage 1: Build the React/Vite application
FROM node:20-alpine AS builder
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

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
