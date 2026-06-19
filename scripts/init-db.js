'use strict';

/**
 * Veritabanı şemasını kurar (idempotent) ve tablo boşsa örnek veri ekler.
 * Çalıştırma:  npm run db:init
 */

require('dotenv').config();
const db = require('../config/db');

const CREATE_PARSELLER = `
CREATE TABLE IF NOT EXISTS parseller (
  id INT AUTO_INCREMENT PRIMARY KEY,
  il VARCHAR(50) NOT NULL,
  ilce VARCHAR(50) NOT NULL,
  mahalle VARCHAR(100) DEFAULT NULL,
  ada VARCHAR(20) NOT NULL,
  parsel VARCHAR(20) NOT NULL,
  alan_m2 DECIMAL(12,2) DEFAULT NULL,
  nitelik VARCHAR(255) DEFAULT NULL,
  enlem DECIMAL(10,7) DEFAULT NULL,
  boylam DECIMAL(10,7) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_arama (il, ilce, ada, parsel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;
`;

const ORNEK_VERILER = [
  ['Ankara', 'Çankaya', 'Kızılay', '1234', '5', 850.50, 'Arsa', 39.9208, 32.8541],
  ['Ankara', 'Çankaya', 'Bahçelievler', '1234', '12', 1200.00, 'Bahçeli kargir ev', 39.9180, 32.8210],
  ['İstanbul', 'Kadıköy', 'Caferağa', '300', '7', 420.75, 'Arsa', 40.9901, 29.0270],
  ['İzmir', 'Konak', 'Alsancak', '88', '21', 640.00, 'Tarla', 38.4360, 27.1450],
];

async function main() {
  if (!db.isConfigured()) {
    console.error('HATA: .env içinde DB_* bilgileri eksik.');
    process.exit(1);
  }
  const pool = db.getPool();

  console.log('Şema kuruluyor...');
  await pool.query(CREATE_PARSELLER);
  console.log('  ✓ parseller tablosu hazır');

  const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM parseller');
  if (c === 0) {
    console.log('Tablo boş, örnek veriler ekleniyor...');
    await pool.query(
      `INSERT INTO parseller
        (il, ilce, mahalle, ada, parsel, alan_m2, nitelik, enlem, boylam)
       VALUES ?`,
      [ORNEK_VERILER]
    );
    console.log(`  ✓ ${ORNEK_VERILER.length} örnek kayıt eklendi`);
  } else {
    console.log(`Tabloda zaten ${c} kayıt var, örnek veri eklenmedi.`);
  }

  console.log('Bitti.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Init hatası:', err.message);
  process.exit(1);
});
