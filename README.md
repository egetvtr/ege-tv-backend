# Ege TV Backend

NestJS tabanlı, YouTube video senkronu + AI destekli haber platformu backend'i.

## Kurulum

```bash
npm install
cp .env.example .env
# .env dosyasını doldur: DATABASE_URL, REDIS_HOST, YOUTUBE_API_KEY,
# YOUTUBE_CHANNEL_ID, ANTHROPIC_API_KEY, JWT_SECRET

npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

Swagger docs: `http://localhost:3001/api/docs`

## Mimari

```
src/
├── auth/                  # JWT kimlik doğrulama modülü
│   ├── auth.service.ts          # login, register, changePassword, kullanıcı yönetimi
│   ├── auth.controller.ts       # POST /api/auth/login, /register, /me, /change-password
│   ├── auth.module.ts
│   ├── jwt.strategy.ts          # Passport Bearer token stratejisi
│   ├── guards/
│   │   ├── jwt-auth.guard.ts    # Korumalı route'lar için
│   │   └── roles.guard.ts       # SUPER_ADMIN / EDITOR / VIEWER kontrol
│   └── decorators/
│       └── roles.decorator.ts   # @Roles(...) dekoratörü
│
├── youtube/               # YouTube Data API senkron modülü
│   ├── youtube.service.ts          # API çağrıları, upsert mantığı
│   ├── youtube-sync.processor.ts   # BullMQ worker (quota kontrolü dahil)
│   ├── youtube-quota.service.ts    # Günlük quota takibi & uyarı
│   ├── youtube.controller.ts       # GET /api/videos, POST /api/videos/sync
│   │                               # GET /api/videos/admin/quota, /admin/sync-logs
│   └── youtube.module.ts           # Cron zamanlayıcı (YOUTUBE_SYNC_CRON)
│
├── news/                  # Haber modülü (manuel + otomatik)
│   ├── news.service.ts             # CRUD + RSS senkron + AI yeniden yazım akışı
│   ├── news-ai.service.ts          # Claude API ile haber yeniden yazımı
│   ├── news-sync.processor.ts      # BullMQ worker
│   ├── news.controller.ts          # Public + admin endpoint'leri
│   ├── feed-source.service.ts      # RSS kaynak CRUD + tek kaynak senkronu
│   ├── feed-source.controller.ts   # /api/feed-sources CRUD
│   └── news.module.ts              # Cron zamanlayıcı (NEWS_SYNC_CRON)
│
├── categories/            # Kategori CRUD (public GET, admin POST/DELETE)
└── prisma/                # PrismaService (global)
```

## Akış

**YouTube senkron:**
1. `YOUTUBE_SYNC_CRON` aralığında (varsayılan 15dk) BullMQ job tetiklenir
2. Quota kontrolü yapılır; günlük limit doluysa sync atlanır
3. `channels.list` ile uploads playlist ID bulunur
4. `playlistItems.list` ile son videolar çekilir, `videos.list` ile detay (süre, izlenme) eklenir
5. `youtubeId` üzerinden upsert edilir (yeni ise INSERT, varsa UPDATE)

**Haber - Manuel:**
Admin panelden `POST /api/news` → status `PENDING` → admin `POST /api/news/:id/publish`

**Haber - Otomatik:**
1. `NEWS_SYNC_CRON` aralığında (varsayılan 30dk) aktif RSS kaynakları taranır
2. Yeni linkler (daha önce çekilmemiş) tespit edilir
3. Her biri Claude API'ye gönderilir, özgün dille yeniden yazılır
4. `NEWS_AUTO_PUBLISH=true` ise direkt yayınlanır, `false` ise `PENDING` statüsünde admin onayı bekler

**RSS Kaynak Yönetimi:**
- `GET    /api/feed-sources`         → tüm kaynaklar
- `POST   /api/feed-sources`         → kaynak ekle
- `PATCH  /api/feed-sources/:id`     → kaynak güncelle
- `PATCH  /api/feed-sources/:id/toggle` → aktif/pasif
- `DELETE /api/feed-sources/:id`     → kaynak sil (SUPER_ADMIN)
- `POST   /api/feed-sources/:id/sync` → tek kaynağı hemen senkronize et
- `GET    /api/feed-sources/sync-logs` → senkron geçmişi

## Auth

**Endpoint'ler:**
- `POST /api/auth/login`          → JWT token al (rate limit: 5/dk brute-force koruması)
- `POST /api/auth/register`       → İlk kullanıcı herkese açık (SUPER_ADMIN olur), sonraki kayıtlar token gerektirir
- `GET  /api/auth/me`             → Profil (token gerekli)
- `POST /api/auth/change-password` → Şifre değiştir (token gerekli)
- `GET  /api/auth/users`          → Kullanıcı listesi (SUPER_ADMIN)
- `DELETE /api/auth/users/:id`    → Kullanıcı sil (SUPER_ADMIN)

**Roller:**
- `SUPER_ADMIN` — her şeyi yapabilir
- `EDITOR` — haber/video yönetimi, RSS kaynak yönetimi
- `VIEWER` — sadece okuma

## Rate Limiting

Global throttler aktif: `THROTTLE_LIMIT` istek / `THROTTLE_TTL` saniye (IP başına).
Login: 5/dk, Register: 3/dk (brute-force koruması).

## Deployment

Production kurulumu (Supabase + Railway + Redis) için [DEPLOYMENT.md](./DEPLOYMENT.md) dosyasına bak.

## Sıradaki Adımlar

- [x] JWT auth + admin login endpoint
- [x] News Feed Sources CRUD (RSS kaynak yönetimi)
- [x] Rate limiting (Throttler)
- [x] YouTube API quota takibi
- [ ] Next.js admin panel (video/haber yönetimi arayüzü)
- [ ] Next.js public site (anasayfa, video galerisi, haber detay)
- [ ] Görsel upload (S3/Cloudinary)
