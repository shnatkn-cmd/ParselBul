'use strict';

const express = require('express');
const db = require('../config/db');

const router = express.Router();

/**
 * GET /api/parsel/ara
 * Sorgu parametreleri: il, ilce, ada, parsel (hepsi opsiyonel, en az biri gerekli)
 * Eşleşen parselleri döndürür.
 */
router.get('/ara', async (req, res) => {
  if (!db.isConfigured()) {
    return res.status(503).json({ ok: false, hata: 'Veritabanı yapılandırılmadı.' });
  }

  const { il, ilce, ada, parsel } = req.query;

  // Dinamik WHERE — yalnızca dolu alanlar, parametreli (SQL injection güvenli)
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
      SELECT id, il, ilce, mahalle, ada, parsel, alan_m2, nitelik, enlem, boylam
      FROM parseller
      WHERE ${kosullar.join(' AND ')}
      ORDER BY il, ilce, CAST(ada AS UNSIGNED), CAST(parsel AS UNSIGNED)
      LIMIT 50`;
    const [rows] = await db.getPool().query(sql, degerler);
    res.json({ ok: true, adet: rows.length, sonuclar: rows });
  } catch (err) {
    console.error('Parsel arama hatası:', err.message);
    res.status(500).json({ ok: false, hata: 'Sorgu sırasında bir hata oluştu.' });
  }
});

module.exports = router;
