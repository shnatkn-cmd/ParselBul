'use strict';

/**
 * Adres geocode proxy (OpenStreetMap Nominatim).
 * Serbest metin adresi koordinata çevirir. Sonuçlar bellekte önbelleğe alınır
 * (Nominatim kullanım politikasına saygı için). Adres TKGM değil OSM kaynaklıdır.
 */

const express = require('express');

const router = express.Router();
const cache = new Map(); // q -> { sonuc }

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 3) return res.status(400).json({ ok: false, hata: 'Arama metni çok kısa.' });
  if (cache.has(q)) return res.json({ ok: true, ...cache.get(q) });

  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tr&q=' +
      encodeURIComponent(q);
    const r = await fetch(url, {
      headers: { 'User-Agent': 'ParselBul/1.0 (parsel sorgu uygulamasi)', Accept: 'application/json' },
    });
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr.length) {
      const bos = { sonuc: null };
      cache.set(q, bos);
      return res.json({ ok: true, ...bos });
    }
    const it = arr[0];
    const payload = {
      sonuc: { lat: Number(it.lat), lng: Number(it.lon), ad: it.display_name, bbox: it.boundingbox || null },
    };
    cache.set(q, payload);
    res.json({ ok: true, ...payload });
  } catch (err) {
    console.error('Geocode hatası:', err.message);
    res.status(502).json({ ok: false, hata: 'Adres servisi yanıt vermedi.' });
  }
});

module.exports = router;
