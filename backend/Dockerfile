# ─────────────────────────────────────────────
#  BT Studio Backend — Multi-stage Dockerfile
# ─────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder

# Prisma requires OpenSSL on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Install deps first (cache layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source & build
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

RUN npm run db:generate
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Production image
FROM node:20-alpine AS runner

# Prisma requires OpenSSL on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Install only prod deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy built output + Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3001}/health || exit 1

CMD ["node", "dist/server.js"]
