# -----------------------------
# 1️⃣ Dependencies Stage
# -----------------------------
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci


# -----------------------------
# 2️⃣ Build Stage
# -----------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# The public site address (https://...): metadata, sitemap and the Content-Security-Policy (upgrade-insecure-requests) use it.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN npm run build


# -----------------------------
# 3️⃣ Runtime Stage
# -----------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./

# The server runs as the unprivileged `node` account of the base image. Next.js writes its optimized-image cache under
# .next/cache at runtime, so that directory must belong to it.
RUN mkdir -p .next/cache && chown -R node:node .next/cache
USER node

EXPOSE 3000

CMD ["npm", "start"]
