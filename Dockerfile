# ── Build aşaması ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Runtime aşaması ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY package*.json ./
# prisma schema.prisma postinstall için npm ci'dan önce kopyalanmalı
COPY prisma ./prisma
RUN npm ci --omit=dev

# Derlenmiş kodu builder'dan kopyala
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main"]
