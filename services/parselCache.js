'use strict';

/**
 * TKGM parsel sonuçlarının veritabanı önbelleği (`parseller` tablosu).
 * Sorgulanan her parsel saklanır; tekrar sorgulamada TKGM'ye gitmeden döner.
 */

const db = require('../config/db');

/** Önbellekten parsel getirir; bulursa sorgu sayacını artırır. null dönebilir. */
async function getCached(mahalleKodu, ada, parsel) {
  if (!db.isConfigured()) return null;
  const [rows] = await db.getPool().query(
    `SELECT * FROM parseller WHERE mahalle_kodu = ? AND ada = ? AND parsel = ? LIMIT 1`,
    [String(mahalleKodu), String(ada), String(parsel)]
  );
  if (!rows.length) return null;
  await db.getPool().query(
    `UPDATE parseller SET sorgu_sayisi = sorgu_sayisi + 1 WHERE id = ?`,
    [rows[0].id]
  );
  return rows[0];
}

/** Parseli önbelleğe ekler veya günceller (mahalle_kodu+ada+parsel tekil). */
async function upsert(p) {
  if (!db.isConfigured()) return;
  await db.getPool().query(
    `INSERT INTO parseller
       (mahalle_kodu, il, ilce, mahalle, ada, parsel, alan_m2, nitelik, pafta, durum,
        merkez_lat, merkez_lng, geometri_json, sorgu_sayisi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       il = VALUES(il), ilce = VALUES(ilce), mahalle = VALUES(mahalle),
       alan_m2 = VALUES(alan_m2), nitelik = VALUES(nitelik), pafta = VALUES(pafta),
       durum = VALUES(durum), merkez_lat = VALUES(merkez_lat), merkez_lng = VALUES(merkez_lng),
       geometri_json = VALUES(geometri_json), sorgu_sayisi = sorgu_sayisi + 1`,
    [
      String(p.mahalleKodu),
      p.il || null,
      p.ilce || null,
      p.mahalle || null,
      String(p.adaNo),
      String(p.parselNo),
      p.alan ?? null,
      p.nitelik || null,
      p.pafta || null,
      p.durum || null,
      p.merkez ? p.merkez.lat : null,
      p.merkez ? p.merkez.lng : null,
      p.geometri ? JSON.stringify(p.geometri) : null,
    ]
  );
}

/** DB satırını API yanıt biçimine çevirir (geometri JSON'u ayrıştırarak). */
function rowToParsel(row) {
  let geometri = null;
  if (row.geometri_json) {
    try { geometri = JSON.parse(row.geometri_json); } catch { geometri = null; }
  }
  return {
    mahalleKodu: row.mahalle_kodu,
    il: row.il || '',
    ilce: row.ilce || '',
    mahalle: row.mahalle || '',
    adaNo: row.ada,
    parselNo: row.parsel,
    alan: row.alan_m2 != null ? Number(row.alan_m2) : 0,
    nitelik: row.nitelik || '',
    pafta: row.pafta || '',
    durum: row.durum || '',
    merkez: { lat: row.merkez_lat != null ? Number(row.merkez_lat) : 0, lng: row.merkez_lng != null ? Number(row.merkez_lng) : 0 },
    geometri,
    ekBilgi: row.ek_bilgi || '',
  };
}

module.exports = { getCached, upsert, rowToParsel };
