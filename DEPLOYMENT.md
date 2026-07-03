# Ege TV - Deployment Rehberi

Mimari: **Supabase** (Postgres) + **Railway** (NestJS backend + Redis/BullMQ) + **Netlify** (Next.js frontend)

---

## 1) Supabase - Veritabanı

1. [supabase.com](https://supabase.com) → New Project → bölge olarak `eu-central-1` (Frankfurt) seç (Türkiye'ye en yakın, düşük gecikme)
2. Proje oluşunca **Project Settings → Database → Connection string** kısmına git
3. İki bağlantı stringi kopyala:
   - **Transaction pooler** (port `6543`) → bu `DATABASE_URL` olacak, sonuna `?pgbouncer=true` ekle
   - **Session / Direct connection** (port `5432`) → bu `DIRECT_URL` olacak (sadece migration için kullanılır)
4. Şifreyi `[PASSWORD]` yerine kendi DB şifrenle değiştir

> Neden iki bağlantı? Supabase'in pooler'ı (pgbouncer) prepared statement'ları
> desteklemediği için Prisma migration'ları başarısız olur. Runtime'da pooler,
> migration'da direct bağlantı kullanıyoruz — bu proje zaten böyle kurgulandı.

---

## 2) Railway - Backend (NestJS + BullMQ)

1. [railway.app](https://railway.app) → New Project → **Deploy from GitHub repo** (backend reposunu önce GitHub'a push et)
2. Railway otomatik `railway.json`'ı okuyup Nixpacks ile build eder
3. Proje içine **+ New → Database → Redis** ekle (BullMQ için) — Railway otomatik `REDIS_URL` environment variable'ı enjekte eder
4. Backend servisinin **Variables** sekmesine şunları ekle:
   ```
   DATABASE_URL=<Supabase pooler connection string>
   DIRECT_URL=<Supabase direct connection string>
   JWT_SECRET=<güçlü rastgele string>
   YOUTUBE_API_KEY=<Google Cloud Console'dan aldığın key>
   YOUTUBE_CHANNEL_ID=<Ege TV kanal ID>
   ANTHROPIC_API_KEY=<console.anthropic.com'dan>
   FRONTEND_URL=https://ege-tv.netlify.app
   NEWS_AUTO_PUBLISH=false
   ```
   `REDIS_URL`, `PORT` gibi değişkenleri Railway zaten kendisi enjekte eder, elle eklemene gerek yok.
5. **Settings → Networking → Generate Domain** ile public bir URL al (örn. `ege-tv-backend.up.railway.app`)
6. Deploy loglarında `npx prisma migrate deploy` adımının başarılı geçtiğini, ardından `🚀 Ege TV backend çalışıyor` logunu gör
7. Test et: `https://<railway-domain>/api/health` → `{"status":"ok","database":"connected"}` dönmeli

---

## 3) Netlify - Frontend (Next.js)

1. [netlify.com](https://netlify.com) → Add new site → **Import an existing project** → GitHub'dan frontend reposunu seç
2. Netlify `netlify.toml`'ı otomatik okur (`@netlify/plugin-nextjs` zaten dahil)
3. **Site settings → Environment variables** kısmına ekle:
   ```
   NEXT_PUBLIC_API_URL=https://ege-tv-backend.up.railway.app/api
   ```
4. Deploy'u tetikle. Bittiğinde Netlify sana `https://<random-isim>.netlify.app` verir
5. İstersen **Site settings → Domain management** kısmından kendi domainini bağla
6. Netlify domainin netleşince Railway'deki `FRONTEND_URL` değişkenini bu gerçek adresle güncelle ve backend'i yeniden deploy et (CORS için gerekli)

---

## 4) İlk Kurulum Sonrası

- Supabase'e seed veri atmak için lokalde: `.env`'i Supabase bilgileriyle doldur → `npm run seed`
- Admin panelden (`https://<netlify-domain>/admin`) haber/video akışını kontrol et
- YouTube senkronu otomatik başlar (`YOUTUBE_SYNC_CRON`), manuel tetiklemek için admin panelde "Şimdi Senkronla" butonu var

## Sorun Giderme

| Belirti | Olası sebep |
|---|---|
| `/api/health` 500 dönüyor | `DATABASE_URL`/`DIRECT_URL` yanlış veya Supabase şifresi hatalı |
| Migration Railway'de patlıyor | `DIRECT_URL` eksik/yanlış — pooler URL'i migration için kullanılamaz |
| Frontend'de CORS hatası | Railway'deki `FRONTEND_URL` gerçek Netlify domainiyle eşleşmiyor |
| BullMQ job'ları çalışmıyor | Railway Redis servisi eklenmemiş veya `REDIS_URL` inject edilmemiş |
