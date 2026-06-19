# ParselBul — Proje Notları (CLAUDE.md)

Bu dosya her oturumda otomatik olarak bağlama yüklenir. Aşağıdaki kuralları HER OTURUMDA uygula.

## Git İş Akışı (ZORUNLU)

- **Repo:** https://github.com/shnatkn-cmd/ParselBul.git (origin, dal: `main`)
- **OTOMATİK DEPLOY:** `main`'e push edilince Hostinger siteyi otomatik deploy ediyor. Yani push = canlıya alma.
  Push öncesi lokalde test et; bozuk kod push'lama.
- **Her oturum başında:** GitHub güncelliğini test et.
  ```bash
  git fetch origin
  git status            # "behind" isek pull et
  git pull --ff-only origin main
  ```
  Uzakta yeni commit varsa önce çek, sonra çalışmaya başla. Çakışma varsa kullanıcıya bildir.
- **Her anlamlı güncellemeden sonra:** commit + push et.
  ```bash
  git add -A
  git commit -m "<açıklayıcı mesaj>"
  git push origin main
  ```
- `.env` ve `node_modules/` ASLA commit edilmez (`.gitignore` içinde).
- Commit mesajları açıklayıcı ve Türkçe olabilir.

## Proje Durumu

- **Ne:** ParselBul — resmî TKGM verisiyle parsel sorgulama uygulaması.
- **Teknoloji:** Node.js + Express. Anasayfa `public/` altında statik servis ediliyor.
- **Hosting:** Hostinger. Giriş noktası `server.js`, port `process.env.PORT || 3000`.
- **Arayüz:** parsel.ink benzeri **tam ekran harita uygulaması**, **dark theme** (Leaflet, CDN'den). Uydu (Esri World Imagery) +
  Sokak (OpenStreetMap) katman değiştirici. Haritaya tıklayınca o noktadaki parsel sorgulanır, sınır poligonu çizilir
  ve sağdaki bilgi panelinde ada/parsel/mahalle/alan/nitelik/pafta + Google Maps & WhatsApp paylaş gösterilir.
  Ayrıca soldaki panelden İl → İlçe → Mahalle + Ada/Parsel ile arama. Tüm frontend `public/` (index.html, css/, js/).
- **Kimlik doğrulama:** Sağ üstte Giriş/Kayıt (modal). Oturum açmadan parsel sorgusu YAPILAMAZ (uçlar 401 döner, frontend modal açar).
  İl/ilçe/mahalle listeleri açık. Renk/CSS değişkenleri [public/css/style.css](public/css/style.css) `:root` içinde (dark palet).
- **TKGM entegrasyonu:** İl → İlçe → Mahalle cascading dropdown (resmî TKGM CBS API'sinden),
  Ada/Parsel ile canlı sorgu, ve koordinatla (harita tıklama) sorgu. Her sonuç DB'ye önbelleğe alınır.
  - Not: İmar durumu / plan notları belediye kaynaklı olup TKGM API'sinde YOK. parsel.ink bunları ayrı sağlar;
    ParselBul'da ileride belediye/e-imar entegrasyonu ile eklenebilir.
  - Kaynak ilham: `qgistkgmplugin-main/` (QGIS eklentisi) — Node.js'e [services/tkgm.js](services/tkgm.js) olarak uyarlandı.
  - TKGM uçları: il `parselsorgu.tkgm.gov.tr/.../ilListe.json`, ilçe/mahalle/parsel `cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api`.
  - Doğrulanmış test parseli: mahalleKodu=166821, ada=4390, parsel=4 (Bursa/Osmangazi/Reyhan).
- **Veritabanı:** Hostinger MySQL — **BAĞLI**. Sunucu: `srv1764.hstgr.io`, DB/kullanıcı: `u851420727_ParselBul`.
  - Bağlantı bilgileri `.env` dosyasında (commit edilmez). Şablon: `.env.example`.
  - Bağlantı katmanı: [config/db.js](config/db.js) — `mysql2` havuzu, lazy, env yoksa "yapılandırılmadı" döner.
  - Not: Hostinger "Remote MySQL" çalışan IP'nin izinli olmasını ister. Bağlantı kesilirse panelden IP eklenmeli.
  - **Şema kurulumu:** `npm run db:init` ([scripts/init-db.js](scripts/init-db.js)) — idempotent; eski demo şemasını algılayıp TKGM önbellek şemasına geçer.
  - **Tablolar:**
    - `parseller` = **TKGM parsel önbelleği**: mahalle_kodu, il, ilce, mahalle, ada, parsel, alan_m2, nitelik, pafta,
      durum, merkez_lat, merkez_lng, geometri_json (LONGTEXT), sorgu_sayisi, created_at, updated_at.
      UNIQUE(mahalle_kodu, ada, parsel), INDEX(il, ilce, ada, parsel).
    - `kullanicilar` = kullanıcılar: id, ad, eposta (UNIQUE), sifre_hash (bcrypt), rol, son_giris, created_at.
    - `sessions` = express-mysql-session tarafından otomatik oluşturulur (oturum saklama).
  - **Auth uçları** ([routes/auth.js](routes/auth.js)): `POST /api/auth/kayit`, `POST /api/auth/giris`,
    `POST /api/auth/cikis`, `GET /api/auth/ben`. Oturum: express-session + MySQL store ([config/session.js](config/session.js)).
    `requireAuth` ara katmanı parsel uçlarını korur. Şifreler bcryptjs ile hash'lenir.
    Test hesabı (lokal DB'de oluşturuldu): test@parselbul.com / 123456 — gerekirse sil.
  - **API uçları:**
    - `GET /api/tkgm/iller` · `GET /api/tkgm/ilceler/:ilKodu` · `GET /api/tkgm/mahalleler/:ilceKodu` → [routes/tkgm.js](routes/tkgm.js)
    - `GET /api/tkgm/parsel/:mahalleKodu/:ada/:parsel` → önce DB önbelleği, yoksa TKGM + önbelleğe yaz. `kaynak` alanı: `onbellek`|`tkgm`.
    - `GET /api/tkgm/parsel-konum/:lat/:lng` → harita tıklamasıyla koordinattaki parsel (geometri ile), önbelleğe yazar.
    - `GET /api/parsel/ara?il=&ilce=&ada=&parsel=` → önbellekte (kayıtlı parsellerde) arama → [routes/parsel.js](routes/parsel.js)
  - **Servisler:** [services/tkgm.js](services/tkgm.js) (API istemcisi), [services/parselCache.js](services/parselCache.js) (DB önbellek get/upsert).
  - **Yol haritası (kullanıcı onaylı, sırayla):**
    1. ✅ Kullanıcı girişi (tamam) + ✅ dark theme (tamam)
    2. Ölçüm aracı (mesafe/alan) + favori parseller (DB'de, kullanıcıya bağlı)
    3. İmar durumu araştırması (belediye/e-imar kaynakları — TKGM'de yok)
    4. PDF indirme + paylaşılabilir link
  - Diğer hazır TKGM özellikleri (henüz UI yok): bina/blok & bağımsız bölüm uçları (qgistkgmplugin'de mevcut).

## Çalıştırma

```bash
npm install
npm start          # veya: npm run dev  (node --watch)
```

## Yapı

```
ParselBul/
├── server.js            # Express giriş noktası
├── config/db.js         # MySQL bağlantı havuzu (env-driven, lazy)
├── routes/              # API rotaları
├── public/              # Anasayfa ve statik dosyalar
├── .env.example         # DB bilgileri şablonu (gerçek .env commit edilmez)
└── CLAUDE.md            # bu dosya
```
