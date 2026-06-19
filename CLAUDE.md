# ParselBul — Proje Notları (CLAUDE.md)

Bu dosya her oturumda otomatik olarak bağlama yüklenir. Aşağıdaki kuralları HER OTURUMDA uygula.

## Git İş Akışı (ZORUNLU)

- **Repo:** https://github.com/shnatkn-cmd/ParselBul.git (origin, dal: `main`)
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

- **Ne:** ParselBul — parsel sorgulama / yönetim uygulaması.
- **Teknoloji:** Node.js + Express. Anasayfa `public/` altında statik servis ediliyor.
- **Hosting:** Hostinger. Giriş noktası `server.js`, port `process.env.PORT || 3000`.
- **Veritabanı:** Hostinger MySQL. Bağlantı bilgileri kullanıcı tarafından SONRADAN verilecek.
  - Bilgiler gelince `.env` dosyasına yazılacak (`.env.example` şablonu mevcut).
  - Bağlantı katmanı: [config/db.js](config/db.js) — `mysql2` havuzu, env yoksa "yapılandırılmadı" döner, çökmez.
  - DB bilgileri geldikten sonra: anasayfada ve ilerleyen özelliklerde veritabanına taşınması gereken
    verileri tespit edip implement et.

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
