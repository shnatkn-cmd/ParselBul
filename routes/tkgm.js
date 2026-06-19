'use strict';

const express = require('express');
const tkgm = require('../services/tkgm');
const cache = require('../services/parselCache');

const router = express.Router();

/** İl listesi (81 il). */
router.get('/iller', async (req, res) => {
  try {
    res.json({ ok: true, veri: await tkgm.getIller() });
  } catch (err) {
    res.status(502).json({ ok: false, hata: err.message });
  }
});

/** İl koduna göre ilçeler. */
router.get('/ilceler/:ilKodu', async (req, res) => {
  try {
    res.json({ ok: true, veri: await tkgm.getIlceler(req.params.ilKodu) });
  } catch (err) {
    res.status(502).json({ ok: false, hata: err.message });
  }
});

/** İlçe koduna göre mahalleler. */
router.get('/mahalleler/:ilceKodu', async (req, res) => {
  try {
    res.json({ ok: true, veri: await tkgm.getMahalleler(req.params.ilceKodu) });
  } catch (err) {
    res.status(502).json({ ok: false, hata: err.message });
  }
});

/**
 * Parsel sorgu: mahalle kodu + ada + parsel.
 * Önce DB önbelleğine bakar; yoksa TKGM'den çeker ve önbelleğe yazar.
 */
router.get('/parsel/:mahalleKodu/:ada/:parsel', async (req, res) => {
  const { mahalleKodu, ada, parsel } = req.params;
  try {
    const cached = await cache.getCached(mahalleKodu, ada, parsel);
    if (cached) {
      return res.json({ ok: true, kaynak: 'onbellek', veri: cache.rowToParsel(cached) });
    }
    const parselVeri = await tkgm.getParsel(mahalleKodu, ada, parsel);
    cache.upsert(parselVeri).catch((e) => console.error('Önbellek yazma hatası:', e.message));
    res.json({ ok: true, kaynak: 'tkgm', veri: parselVeri });
  } catch (err) {
    const kod = err.status === 404 ? 404 : 502;
    res.status(kod).json({ ok: false, hata: err.message });
  }
});

module.exports = router;
