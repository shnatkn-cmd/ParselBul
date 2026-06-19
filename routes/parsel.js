'use strict';

/**
 * Önbellek (daha önce TKGM'den sorgulanıp DB'ye kaydedilmiş parseller) araması.
 * Canlı TKGM sorgusu için routes/tkgm.js kullanılır.
 */

const express = require('express');
const db = require('../config/db');

const router = express.Router();

/**
 * GET /api/parsel/ara
 * Parametreler: il, ilce, ada, parsel (hepsi opsiyonel, en az biri gerekli).
 * Önbellekteki eşleşen parselleri döndürür.
 */
router.get('/ara', async (req, res) => {
  if (!db.isConfigured()) {
    return res.status(503).json({ ok: false, hata: 'Veritabanı yapılandırılmadı.' });
  }

  const { il, ilce, ada, parsel } = req.query;
  const kosullar = [];
  const degerler = [];
  if (il) { kosullar.push('il LIKE ?'); degerler.push(`%${il}%`); }
  if (ilce) { kosullar.push('ilce LIKE ?'); degerler.push(`%${ilce}%`); }
  if (ada) { kosullar.push('ada = ?'); degerler.push(String(ada).trim()); }
  if (parsel) { kosullar.push('parsel = ?'); degerler.push(String(parsel).trim()); }

  if (kosullar.length === 0) {
    return res.status(400).json({ ok: false, hata: 'En az bir arama kriteri girin.' });
  }

  try {
    const sql = `
      SELECT mahalle_kodu, il, ilce, mahalle, ada, parsel, alan_m2, nitelik, pafta,
             merkez_lat, merkez_lng, sorgu_sayisi, updated_at
      FROM parseller
      WHERE ${kosullar.join(' AND ')}
      ORDER BY updated_at DESC
      LIMIT 50`;
    const [rows] = await db.getPool().query(sql, degerler);
    res.json({ ok: true, adet: rows.length, sonuclar: rows });
  } catch (err) {
    console.error('Parsel arama hatası:', err.message);
    res.status(500).json({ ok: false, hata: 'Sorgu sırasında bir hata oluştu.' });
  }
});

module.exports = router;
