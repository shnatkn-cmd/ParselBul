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
- **Arayüz:** parsel.ink benzeri, **sol sabit sidebar + turuncu/amber tema** (neutral koyu) (Leaflet, CDN'den).
  - **Sol sidebar:** logo + nav (Harita / Ara / Favoriler), üstte "Adres veya konum ara" hızlı arama kutusu,
    altta Giriş/kullanıcı. İçerik tek alanda "view" olarak değişir: boş-durum ("Haritaya tıklayın"),
    Ara (sekmeli), Favoriler (liste), Parsel bilgisi. JS'te `gorunum(ad)` fonksiyonu ile yönetilir.
  - **Harita stili** (sağ üst, katman ikonu popup): Uydu (Esri), Sokaklar (OSM), Açık (CARTO Positron), Arazi (Esri Topo).
  - **Ara sekmesi:** "Adres" (İl/İlçe/Mahalle + Cadde/Sokak + Bina No → geocode) ve "Ada/Parsel" (İl/İlçe/Mahalle + Ada + Parsel).
  - **Otomatik bölgeye gitme:** İl/İlçe/Mahalle seçilince harita o idari sınıra zoom yapar (resmî TKGM geometrisi).
  - Haritaya tıklayınca o noktadaki parsel sorgulanır. Seçili parsel **turuncu** çizilir + üzerinde **ada/parsel/nitelik etiketi**.
  - Parsel bilgisi sidebar'da: ada/parsel/mahalle/alan/nitelik/pafta + ★ favori + İmar (e-İmar link) + Haritalar/WhatsApp + PDF/Bağlantı.
  - **Ölçüm aracı + Konumum** (sol alt, harita butonları): mesafe (km/m), alan (m²/dönüm jeodezik), geolocation.
  - Renk/tema değişkenleri [public/css/style.css](public/css/style.css) `:root` (turuncu `--accent: #ef8b32`). Tüm frontend `public/`.
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
      durum, merkez_lat, merkez_lng, geometri_json (LONGTEXT), ek_bilgi (TEXT, admin notu), sorgu_sayisi, created_at, updated_at.
      UNIQUE(mahalle_kodu, ada, parsel), INDEX(il, ilce, ada, parsel). `ek_bilgi` cache upsert'inde KORUNUR (üzerine yazılmaz).
    - `kullanicilar` = kullanıcılar: id, ad, eposta (UNIQUE), sifre_hash (bcrypt), rol (`uye`|`admin`), son_giris, created_at.
    - `sessions` = express-mysql-session tarafından otomatik oluşturulur (oturum saklama).
  - **Auth uçları** ([routes/auth.js](routes/auth.js)): `POST /api/auth/kayit`, `POST /api/auth/giris`,
    `POST /api/auth/cikis`, `GET /api/auth/ben`. Oturum: express-session + MySQL store ([config/session.js](config/session.js)).
    `requireAuth` parsel uçlarını korur, `requireAdmin` (rol=admin) admin uçlarını korur. Şifreler bcryptjs ile hash'lenir.
    - **Roller:** `uye` (varsayılan, parsel sorgular + ek bilgiyi salt-okur görür) ve `admin` (her parsele **Ek Bilgi** ekler/düzenler).
    - **Admin yapma:** `npm run admin -- <eposta> [sifre]` ([scripts/make-admin.js](scripts/make-admin.js)) — varsa rolü admin yapar, yoksa oluşturur.
    - **Ek bilgi ucu:** `POST /api/parsel/ek-bilgi` (admin) → ilgili parselin `ek_bilgi` alanını günceller ([routes/parsel.js](routes/parsel.js)).
    - Test hesapları (DB'de): admin@parselbul.com / Parsel.Admin2026 (admin) · test@parselbul.com / 123456 (üye).
  - **API uçları:**
    - `GET /api/tkgm/iller` · `GET /api/tkgm/ilceler/:ilKodu` · `GET /api/tkgm/mahalleler/:ilceKodu` → [routes/tkgm.js](routes/tkgm.js)
    - `GET /api/tkgm/parsel/:mahalleKodu/:ada/:parsel` → önce DB önbelleği, yoksa TKGM + önbelleğe yaz. `kaynak` alanı: `onbellek`|`tkgm`.
    - `GET /api/tkgm/parsel-konum/:lat/:lng` → harita tıklamasıyla koordinattaki parsel (geometri ile), önbelleğe yazar.
    - `GET /api/parsel/ara?il=&ilce=&ada=&parsel=` → önbellekte (kayıtlı parsellerde) arama → [routes/parsel.js](routes/parsel.js)
    - `GET /api/geocode?q=...` → adres → koordinat (OSM Nominatim proxy, bellek önbellekli) → [routes/geocode.js](routes/geocode.js)
  - **ÖNEMLİ TKGM bulgusu:** il/ilçe/mahalle listeleri (idariYapi) her birim için **tam poligon geometri** döndürür.
    `services/tkgm.js` bundan `bounds` ([[güney,batı],[kuzey,doğu]]) hesaplayıp listeye ekler → seçimde harita o sınıra zoom yapar (otomatik bölgeye gitme). Harici geocoding gerekmez.
  - **TKGM'de OLMAYAN (araştırıldı):** Adres (cadde/sokak/bina) verisi herkese açık değil (csbmListe → "No HTTP resource"; e-Devlet/kurumsal). Kadastro WMS/WMTS de HTTPS'te açık değil (resmî app tile'ı dinamik kuruyor). Bu yüzden: Adres modu serbest metin + Nominatim ile çalışır; tüm-parsel kadastro overlay'i henüz yok.
  - **Servisler:** [services/tkgm.js](services/tkgm.js) (API istemcisi), [services/parselCache.js](services/parselCache.js) (DB önbellek get/upsert).
  - **Yol haritası (kullanıcı onaylı, sırayla):**
    1. ✅ Kullanıcı girişi + ✅ dark theme
    2. ✅ Ölçüm aracı (mesafe/alan, sol alt) + ✅ favori parseller (`favoriler` tablosu, `/api/favoriler`)
    3. ✅ Otomatik bölgeye gitme + ✅ 4 harita stili + ✅ turuncu parsel & etiket + ✅ Adres sekmesi (geocode)
    4. ✅ İmar durumu: bilgi panelinde e-İmar derin bağlantısı (veri TKGM'de yok, belediye kaynaklı)
    5. ✅ PDF indirme (yazdır penceresi) + paylaşılabilir link (`?mah=&ada=&parsel=` ile otomatik açılır)
  - **İmar araştırma sonucu (genişletildi):** Ücretsiz/token'sız/koordinatla sorgulanabilir belediye imar servisi pratikte YOK.
    İBB ArcGIS (`gismap.ibb.gov.tr/.../Plan1000Sayisal`) "Token Required" döner; İzmir `cbs/kentrehberi.izmir.bel.tr` dışarı kapalı.
    `turkiye.gov.tr/e-imar` e-Devlet girişi ister (403). Sonuç: otomatik imar çekme gerçekçi değil (parsel.ink'in ücretli olma sebebi).
    Bu yüzden panelde **konuma özel arama linki** verildi: Google "{il} {ilce} belediyesi imar durumu sorgulama".
    Gerçekçi in-card imar yolu: **admin ek_bilgi** (adminler önemli parsellere elle girer). İleride: ücretli imar veri sağlayıcısı.
  - **Kadastro overlay araştırma sonucu:** TKGM tam-parsel servisini token/kurumsal veriyor (parselsorgu app
    `getParselSorguTokenInfo` ile). Herkese açık HTTPS tile/WMS yok. Bu yüzden sadece seçili parsel çiziliyor.
  - Diğer hazır TKGM özellikleri (henüz UI yok): bina/blok & bağımsız bölüm uçları (qgistkgmplugin'de mevcut).
  - `favoriler` tablosu: id, kullanici_id (FK→kullanicilar, ON DELETE CASCADE), mahalle_kodu, ada, parsel, il, ilce,
    mahalle, nitelik, alan_m2, merkez_lat/lng, not_metni. UNIQUE(kullanici_id, mahalle_kodu, ada, parsel).

## Önbellek / Statik dosyalar (ÖNEMLİ)

- Hostinger eski JS/CSS'i önbellekte tutabiliyor → deploy sonrası "stale asset" hatası (ör. eski main.js'in
  artık olmayan #year öğesine erişip patlaması). Bu yüzden:
  - `server.js` statik dosyalara `Cache-Control: no-cache` veriyor (ETag ile doğrular, değişmemişse 304).
  - `index.html` CSS/JS bağlantılarında `?v=N` versiyon query'si var. **Frontend asset'lerini değiştirince `?v=N`'i artır.** (Güncel: v=6)
- **JS TUZAĞI (yaşandı):** `public/js/main.js` klasik script (module değil) — top-level `const`/`let` TDZ'ye tabidir.
  Bir yardımcı (`el`, `map` vb.) DOSYANIN ÜSTÜNDE, onu kullanan bloklardan ÖNCE tanımlı olmalı. Aksi halde
  açılışta "Cannot access X before initialization" → tüm JS ölür. Push öncesi CDP testiyle (scratchpad/cdpdiag.js) doğrula.
- Canlı (Hostinger geçici) alan adı: darkgrey-skunk-554359.hostingersite.com. Hedef: app.parsel.ink.

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
