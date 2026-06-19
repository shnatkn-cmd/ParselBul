'use strict';

/**
 * MySQL bağlantı katmanı (Hostinger).
 *
 * Bağlantı bilgileri .env dosyasından okunur. Bilgiler henüz girilmemişse
 * uygulama ÇÖKMEZ; isConfigured() false döner ve anasayfa "veritabanı
 * yapılandırılmadı" durumunu gösterir. Bilgiler girilince havuz tembel
 * (lazy) olarak oluşturulur.
 */

const mysql = require('mysql2/promise');

let pool = null;

/** DB ortam değişkenleri girilmiş mi? */
function isConfigured() {
  return Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
}

/** Havuzu (gerekirse oluşturarak) döndürür. Yapılandırılmamışsa hata fırlatır. */
function getPool() {
  if (!isConfigured()) {
    throw new Error('Veritabanı yapılandırılmadı: .env içindeki DB_* değişkenlerini doldurun.');
  }
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

/**
 * Bağlantıyı test eder.
 * @returns {Promise<{configured: boolean, connected: boolean, error?: string}>}
 */
async function testConnection() {
  if (!isConfigured()) {
    return { configured: false, connected: false };
  }
  try {
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();
    return { configured: true, connected: true };
  } catch (err) {
    return { configured: true, connected: false, error: err.message };
  }
}

module.exports = { isConfigured, getPool, testConnection };
