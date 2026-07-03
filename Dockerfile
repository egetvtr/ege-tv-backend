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
RUN npm ci --omit=dev

# Prisma client'ı runtime için üret
COPY prisma ./prisma
RUN npx prisma generate

# Derlenmiş kodu builder'dan kopyala
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main"]
