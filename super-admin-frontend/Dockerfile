# Super Admin Frontend — React/Vite
# Stage 1: build
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .

# VITE_API_URL is baked into the bundle at build time.
# Pass it as a build-arg (defaults to localhost:8002 for local Docker dev).
ARG VITE_API_URL=http://localhost:8002
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: serve with nginx on port 3001
FROM nginx:alpine

# dist/ is built with base='/super-admin/', so serve it at that path
COPY --from=build /app/dist /usr/share/nginx/html/super-admin
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove the default nginx config that listens on port 80
RUN rm -f /etc/nginx/conf.d/default.conf.bak 2>/dev/null; \
    sed -i '/listen.*80/d' /etc/nginx/nginx.conf 2>/dev/null || true

EXPOSE 3001

CMD ["nginx", "-g", "daemon off;"]
