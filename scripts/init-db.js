'use strict';

/**
 * Veritabanı şemasını kurar (idempotent).
 * `parseller` tablosu, TKGM'den sorgulanan parsellerin ÖNBELLEĞİdir:
 * her başarılı sorgu burada saklanır, tekrar sorgulamada DB'den hızlıca döner.
 *
 * Çalıştırma:  npm run db:init
 */

require('dotenv').config();
const db = require('../config/db');

const CREATE_PARSELLER = `
CREATE TABLE IF NOT EXISTS parseller (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mahalle_kodu VARCHAR(20) NOT NULL,
  il VARCHAR(80) DEFAULT NULL,
  ilce VARCHAR(80) DEFAULT NULL,
  mahalle VARCHAR(120) DEFAULT NULL,
  ada VARCHAR(20) NOT NULL,
  parsel VARCHAR(20) NOT NULL,
  alan_m2 DECIMAL(14,2) DEFAULT NULL,
  nitelik VARCHAR(255) DEFAULT NULL,
  pafta VARCHAR(80) DEFAULT NULL,
  durum VARCHAR(40) DEFAULT NULL,
  merkez_lat DECIMAL(10,7) DEFAULT NULL,
  merkez_lng DECIMAL(10,7) DEFAULT NULL,
  geometri_json LONGTEXT DEFAULT NULL,
  sorgu_sayisi INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parsel (mahalle_kodu, ada, parsel),
  INDEX idx_konum (il, ilce, ada, parsel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;
`;

async function tabloVar(pool, ad) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [ad]
  );
  return rows[0].c > 0;
}

async function kolonVar(pool, tablo, kolon) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tablo, kolon]
  );
  return rows[0].c > 0;
}

async function main() {
  if (!db.isConfigured()) {
    console.error('HATA: .env içinde DB_* bilgileri eksik.');
    process.exit(1);
  }
  const pool = db.getPool();

  // Eski demo şemasını (mahalle_kodu kolonu yok) algıla ve yenisiyle değiştir.
  if (await tabloVar(pool, 'parseller')) {
    const yeni = await kolonVar(pool, 'parseller', 'mahalle_kodu');
    if (!yeni) {
      console.log('Eski demo "parseller" tablosu bulundu, TKGM önbellek şemasına geçiliyor...');
      await pool.query('DROP TABLE parseller');
    }
  }

  console.log('Şema kuruluyor...');
  await pool.query(CREATE_PARSELLER);
  console.log('  ✓ parseller (TKGM önbelleği) hazır');

  const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM parseller');
  console.log(`Önbellekte ${c} parsel kayıtlı.`);
  console.log('Bitti.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Init hatası:', err.message);
  process.exit(1);
});
