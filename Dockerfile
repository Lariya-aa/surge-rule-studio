# ── Stage 1: Install dependencies ───────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# ── Stage 2: Build ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: Production (Cloudflare Workers via wrangler) ───
FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g wrangler@4

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# For local preview without Cloudflare:
#   docker run -p 8787:8787 surge-rule-studio
# For deployment, pass CLOUDFLARE_API_TOKEN at runtime:
#   docker run -e CLOUDFLARE_API_TOKEN=xxx surge-rule-studio wrangler deploy --config dist/server/wrangler.json

EXPOSE 8787
CMD ["wrangler", "dev", "--config", "dist/server/wrangler.json", "--port", "8787", "--local"]
