# GitHub'sız Direkt Deploy (CLI ile)

Bu dosyadaki komutları **kendi bilgisayarında**, proje klasörünün içinde çalıştır.
Railway ve Netlify CLI'ları login için tarayıcı açacak, o yüzden GitHub'a hiç ihtiyaç yok.

---

## 1) Railway - Backend

```bash
# CLI kurulumu (bir kere)
npm install -g @railway/cli

# Proje klasöründe
cd ege-tv-backend
railway login          # tarayıcı açılır, Railway hesabınla giriş yap

railway init            # yeni proje oluştur, isim sor -> "ege-tv-backend" yaz

# Redis servisini ekle
railway add             # "Redis" seç

# Environment değişkenlerini tek tek ekle (ya da Railway dashboard'dan toplu yapıştır)
railway variables --set "DATABASE_URL=<supabase-pooler-url>"
railway variables --set "DIRECT_URL=<supabase-direct-url>"
railway variables --set "JWT_SECRET=$(openssl rand -hex 32)"
railway variables --set "YOUTUBE_API_KEY=<youtube-key>"
railway variables --set "YOUTUBE_CHANNEL_ID=<channel-id>"
railway variables --set "ANTHROPIC_API_KEY=<anthropic-key>"
railway variables --set "FRONTEND_URL=https://ege-tv.netlify.app"
railway variables --set "NEWS_AUTO_PUBLISH=false"

# Deploy - klasördeki dosyaları direkt Railway'e yükler, GitHub gerekmez
railway up

# Deploy bitince public domain oluştur
railway domain           # sana bir *.up.railway.app adresi verir

# Kontrol et
curl https://<verdigi-domain>/api/health
```

Her kod değişikliğinden sonra tekrar deploy etmek için sadece `railway up` yeterli.

---

## 2) Netlify - Frontend

```bash
# CLI kurulumu (bir kere)
npm install -g netlify-cli

cd ege-tv-frontend
netlify login            # tarayıcı açılır, Netlify hesabınla giriş yap

netlify init              # "Create & configure a new site" seç, takım/isim sor

# Environment değişkenini ekle (Railway'den aldığın domain + /api)
netlify env:set NEXT_PUBLIC_API_URL "https://<railway-domain>/api"

# Production'a direkt deploy - build'i de kendisi yapar
netlify deploy --prod
```

Bitince sana `https://<site-adı>.netlify.app` linkini verir.

**Son adım:** Bu gerçek Netlify adresini Railway'deki `FRONTEND_URL` değişkenine yaz ve backend'i tekrar deploy et (CORS için):
```bash
cd ege-tv-backend
railway variables --set "FRONTEND_URL=https://<gercek-netlify-adresin>.netlify.app"
railway up
```

---

## Sonraki güncellemeler

Kod değiştirdiğinde GitHub'a hiç dokunmadan:
- Backend: `cd ege-tv-backend && railway up`
- Frontend: `cd ege-tv-frontend && netlify deploy --prod`
