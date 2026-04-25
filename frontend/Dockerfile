# Prawn ERP - Frontend (React)
# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (use yarn if present, else npm)
COPY package.json yarn.lock* package-lock* ./
RUN if [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile --network-timeout 600000; else npm ci; fi

COPY . .

# Build-time URL for API (browser calls this from host)
ARG REACT_APP_BACKEND_URL=http://localhost:8000
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

RUN if [ -f yarn.lock ]; then yarn build; else npm run build; fi

# Stage 2: serve with nginx
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
