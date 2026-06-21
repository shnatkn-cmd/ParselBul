'use strict';

/**
 * Bir kullanıcıyı admin yapar veya yeni admin hesabı oluşturur.
 *
 * Kullanım:
 *   node scripts/make-admin.js <eposta> [sifre]
 *
 * - Kullanıcı varsa: rolü 'admin' yapılır (şifre verilirse güncellenir).
 * - Kullanıcı yoksa: <sifre> ile yeni admin hesabı oluşturulur (şifre zorunlu).
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function main() {
  const eposta = (process.argv[2] || '').trim().toLowerCase();
  const sifre = process.argv[3];
  if (!eposta) {
    console.error('Kullanım: node scripts/make-admin.js <eposta> [sifre]');
    process.exit(1);
  }
  if (!db.isConfigured()) {
    console.error('HATA: .env içinde DB_* bilgileri eksik.');
    process.exit(1);
  }
  const pool = db.getPool();
  const [rows] = await pool.query('SELECT id FROM kullanicilar WHERE eposta = ? LIMIT 1', [eposta]);

  if (rows.length) {
    if (sifre) {
      const hash = await bcrypt.hash(sifre, 10);
      await pool.query('UPDATE kullanicilar SET rol = ?, sifre_hash = ? WHERE id = ?', ['admin', hash, rows[0].id]);
      console.log(`✓ ${eposta} admin yapıldı ve şifresi güncellendi.`);
    } else {
      await pool.query('UPDATE kullanicilar SET rol = ? WHERE id = ?', ['admin', rows[0].id]);
      console.log(`✓ ${eposta} admin yapıldı.`);
    }
  } else {
    if (!sifre) {
      console.error('Bu e-posta kayıtlı değil; yeni admin için şifre verin: node scripts/make-admin.js <eposta> <sifre>');
      process.exit(1);
    }
    const hash = await bcrypt.hash(sifre, 10);
    await pool.query('INSERT INTO kullanicilar (ad, eposta, sifre_hash, rol) VALUES (?, ?, ?, ?)',
      ['Yönetici', eposta, hash, 'admin']);
    console.log(`✓ Yeni admin hesabı oluşturuldu: ${eposta}`);
  }
  process.exit(0);
}

main().catch((err) => { console.error('Hata:', err.message); process.exit(1); });
