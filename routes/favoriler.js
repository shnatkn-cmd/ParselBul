'use strict';

/** Kullanıcıya bağlı favori parseller. Tüm uçlar giriş gerektirir. */

const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('./auth');

const router = express.Router();

router.use(requireAuth);

/** Kullanıcının favorilerini listeler (en yeni önce). */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT id, mahalle_kodu, ada, parsel, il, ilce, mahalle, nitelik, alan_m2,
              merkez_lat, merkez_lng, not_metni, created_at
       FROM favoriler WHERE kullanici_id = ? ORDER BY created_at DESC`,
      [req.session.kullanici.id]
    );
    res.json({ ok: true, veri: rows });
  } catch (err) {
    console.error('Favori listeleme hatası:', err.message);
    res.status(500).json({ ok: false, hata: 'Favoriler alınamadı.' });
  }
});

/** Favori ekler (parsel bilgileriyle). */
router.post('/', async (req, res) => {
  const b = req.body || {};
  const mahalleKodu = b.mahalleKodu != null ? String(b.mahalleKodu) : '';
  const ada = b.adaNo != null ? String(b.adaNo) : '';
  const parsel = b.parselNo != null ? String(b.parselNo) : '';
  if (!mahalleKodu || !ada || !parsel) {
    return res.status(400).json({ ok: false, hata: 'Eksik parsel bilgisi.' });
  }
  try {
    const [r] = await db.getPool().query(
      `INSERT INTO favoriler
         (kullanici_id, mahalle_kodu, ada, parsel, il, ilce, mahalle, nitelik, alan_m2, merkez_lat, merkez_lng, not_metni)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         il = VALUES(il), ilce = VALUES(ilce), mahalle = VALUES(mahalle),
         nitelik = VALUES(nitelik), alan_m2 = VALUES(alan_m2),
         merkez_lat = VALUES(merkez_lat), merkez_lng = VALUES(merkez_lng)`,
      [
        req.session.kullanici.id, mahalleKodu, ada, parsel,
        b.il || null, b.ilce || null, b.mahalle || null,
        b.nitelik || null, b.alan ?? null,
        b.merkez ? b.merkez.lat : null, b.merkez ? b.merkez.lng : null,
        (b.not_metni || '').slice(0, 500) || null,
      ]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (err) {
    console.error('Favori ekleme hatası:', err.message);
    res.status(500).json({ ok: false, hata: 'Favori eklenemedi.' });
  }
});

/** Favori siler (id ile, yalnızca sahibinin). */
router.delete('/:id', async (req, res) => {
  try {
    const [r] = await db.getPool().query(
      'DELETE FROM favoriler WHERE id = ? AND kullanici_id = ?',
      [req.params.id, req.session.kullanici.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ ok: false, hata: 'Favori bulunamadı.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Favori silme hatası:', err.message);
    res.status(500).json({ ok: false, hata: 'Favori silinemedi.' });
  }
});

module.exports = router;
