'use strict';

/**
 * TKGM (Tapu ve Kadastro Genel Müdürlüğü) CBS API istemcisi.
 * Resmî, kamuya açık servisleri kullanır. Tüm HTTP istekleri buradan geçer.
 *
 * Kaynak referans: qgistkgmplugin (Okan Şafak) — Node.js'e uyarlandı.
 */

const TKGM_API_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api';
const TKGM_PARSEL_BASE = 'https://parselsorgu.tkgm.gov.tr/app/modules/administrativeQuery/data';

const HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ParselBul',
};

const ALLOWED_HOSTS = new Set(['cbsapi.tkgm.gov.tr', 'parselsorgu.tkgm.gov.tr']);
const TIMEOUT_MS = 30000;

/** İzin verilen hostların dışına istek atılmasını engeller. */
function validateUrl(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`Geçersiz URL şeması: ${u.protocol}`);
  }
  if (!ALLOWED_HOSTS.has(u.hostname)) {
    throw new Error(`İzin verilmeyen host: ${u.hostname}`);
  }
}

/** Bir GET isteği atar; JSON döner. TKGM hata mesajlarını ValueError gibi fırlatır. */
async function httpGet(url) {
  validateUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  let text;
  try {
    res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    text = await res.text();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('TKGM isteği zaman aşımına uğradı.');
    throw new Error(`TKGM bağlantı hatası: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // <string>Mesaj</string> biçimli XML hata gövdeleri
    const m = text.match(/<string[^>]*>([\s\S]*?)<\/string>/i);
    if (m) throw new Error(m[1].trim());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    throw new Error('Beklenmeyen TKGM yanıtı.');
  }

  if (data && typeof data === 'object' && data.Message) {
    const e = new Error(data.Message);
    e.status = res.status;
    throw e;
  }
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

/** GeoJSON FeatureCollection -> sade {id, ad} listesi. */
function featuresToList(data) {
  if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return data.features.map((f) => {
      const p = f.properties || {};
      return { id: p.id, ad: p.text || p.ad || p.name || '' };
    });
  }
  return Array.isArray(data) ? data : [];
}

const IL_FALLBACK = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin','Aydın',
  'Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum',
  'Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun',
  'Gümüşhane','Hakkari','Hatay','Isparta','Mersin','İstanbul','İzmir','Kars','Kastamonu','Kayseri',
  'Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin',
  'Muğla','Muş','Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas',
  'Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak','Aksaray',
  'Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan','Iğdır','Yalova','Karabük',
  'Kilis','Osmaniye','Düzce',
];

/** 81 ilin listesi ({id, ad}). API erişilemezse statik liste döner (id yok). */
async function getIller() {
  try {
    const data = await httpGet(`${TKGM_PARSEL_BASE}/ilListe.json`);
    const list = featuresToList(data);
    if (list.length) return list;
  } catch {
    /* fallback */
  }
  return IL_FALLBACK.map((ad, i) => ({ id: null, ad }));
}

/** İl koduna göre ilçe listesi. */
async function getIlceler(ilKodu) {
  const data = await httpGet(`${TKGM_API_BASE}/idariYapi/ilceListe/${encodeURIComponent(ilKodu)}`);
  return featuresToList(data);
}

/** İlçe koduna göre mahalle listesi. */
async function getMahalleler(ilceKodu) {
  const data = await httpGet(`${TKGM_API_BASE}/idariYapi/mahalleListe/${encodeURIComponent(ilceKodu)}`);
  return featuresToList(data);
}

/** TKGM "6.154,31" -> 6154.31 sayı dönüşümü. */
function parseAlan(raw) {
  const s = String(raw == null ? '0' : raw).trim();
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** GeoJSON Feature -> sade parsel nesnesi (alan, nitelik, geometri, merkez...). */
function parseParselFeature(data, fallback = {}) {
  if (!data || data.type !== 'Feature') {
    throw new Error('Beklenmeyen API yanıtı.');
  }
  const props = data.properties || {};
  const geom = data.geometry || {};

  let lat = 0;
  let lng = 0;
  let ring = [];
  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates) && geom.coordinates[0]) {
    ring = geom.coordinates[0];
    if (ring.length) {
      lng = ring.reduce((a, c) => a + c[0], 0) / ring.length;
      lat = ring.reduce((a, c) => a + c[1], 0) / ring.length;
    }
  }

  return {
    mahalleKodu: props.mahalleId || fallback.mahalleKodu || null,
    il: props.ilAd || '',
    ilce: props.ilceAd || '',
    mahalle: props.mahalleAd || '',
    adaNo: String(props.adaNo || fallback.ada || ''),
    parselNo: String(props.parselNo || fallback.parsel || ''),
    alan: parseAlan(props.alan),
    nitelik: props.nitelik || '',
    pafta: props.pafta || '',
    durum: props.durum != null ? String(props.durum) : '',
    merkez: { lat, lng },
    geometri: { type: geom.type || null, coordinates: geom.coordinates || null },
  };
}

/** Mahalle kodu + ada + parsel ile parsel sorgular. */
async function getParsel(mahalleKodu, ada, parsel) {
  const url = `${TKGM_API_BASE}/parsel/${encodeURIComponent(mahalleKodu)}/${encodeURIComponent(ada)}/${encodeURIComponent(parsel)}`;
  const data = await httpGet(url);
  return parseParselFeature(data, { mahalleKodu, ada, parsel });
}

/** Koordinat (enlem/boylam) ile o noktadaki parseli sorgular. */
async function getParselByKoordinat(lat, lng) {
  const url = `${TKGM_API_BASE}/parsel/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}/`;
  const data = await httpGet(url);
  return parseParselFeature(data);
}

module.exports = {
  getIller,
  getIlceler,
  getMahalleler,
  getParsel,
  getParselByKoordinat,
};
