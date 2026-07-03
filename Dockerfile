# ── Build aşaması ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# postinstall (prisma generate) dosyalar kopyalanmadan çalışmasın
RUN npm ci --ignore-scripts

COPY . .
# Dosyalar kopyalandıktan sonra prisma generate çalıştır
RUN npx prisma generate
RUN npm run build

# ── Runtime aşaması ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
# postinstall (prisma generate) dosyalar kopyalanmadan çalışmasın
RUN npm ci --omit=dev --ignore-scripts
# Dosyalar kopyalandıktan sonra prisma generate çalıştır
RUN npx prisma generate

# Derlenmiş kodu builder'dan kopyala
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main"]
