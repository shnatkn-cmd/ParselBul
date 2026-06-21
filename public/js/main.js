/* global L */
'use strict';

// Kısayol (en üstte tanımlı olmalı; aşağıdaki tüm bloklar kullanır)
const el = (id) => document.getElementById(id);

// ---- Harita kurulumu ----
const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([39.2, 35.0], 6);

// Harita stilleri (her biri bir veya daha çok tile katmanı)
const STILLER = {
  uydu: {
    ad: 'Uydu',
    katmanlar: [
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 20, attribution: 'Tiles &copy; Esri' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 20 }),
    ],
  },
  sokaklar: {
    ad: 'Sokaklar',
    katmanlar: [L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '&copy; OpenStreetMap' })],
  },
  acik: {
    ad: 'Açık',
    katmanlar: [L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, subdomains: 'abcd', attribution: '&copy; OpenStreetMap, &copy; CARTO' })],
  },
  arazi: {
    ad: 'Arazi',
    katmanlar: [L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri' })],
  },
};
let aktifStil = null;

function stilSec(anahtar) {
  if (!STILLER[anahtar]) return;
  if (aktifStil) STILLER[aktifStil].katmanlar.forEach((k) => map.removeLayer(k));
  STILLER[anahtar].katmanlar.forEach((k) => k.addTo(map));
  aktifStil = anahtar;
  document.querySelectorAll('.style-grid button').forEach((b) =>
    b.classList.toggle('active', b.dataset.style === anahtar));
}
stilSec('uydu');

el('styleBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  el('styleMenu').hidden = !el('styleMenu').hidden;
});
el('styleMenu').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-style]');
  if (!b) return;
  stilSec(b.dataset.style);
  el('styleMenu').hidden = true;
});
document.addEventListener('click', (e) => {
  if (!el('styleSwitch').contains(e.target)) el('styleMenu').hidden = true;
});

// ---- Yardımcılar ----
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function fmtAlan(v) {
  if (v == null || v === 0) return '—';
  return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' m²';
}
let kullanici = null;
let aktifParsel = null;          // bilgi panelinde gösterilen parsel
let favoriler = [];              // kullanıcının favorileri (DB satırları)
const favoriIndex = new Map();   // "mahalleKodu/ada/parsel" -> favori
let olcumModu = null;            // null | 'mesafe' | 'alan'
let toastTimer = null;
function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}
function loading(on) { el('mapLoading').hidden = !on; }

// ---- Parsel katmanı + bilgi paneli ----
let parselLayer = null;
// TKGM tarzı turuncu vurgu
const PARSEL_STIL = { color: '#ff7a00', weight: 3, fillColor: '#ff9d2e', fillOpacity: 0.35 };

function parseliCiz(p) {
  if (parselLayer) { map.removeLayer(parselLayer); parselLayer = null; }
  if (p.geometri && p.geometri.coordinates) {
    parselLayer = L.geoJSON({ type: 'Feature', geometry: p.geometri, properties: {} }, { style: PARSEL_STIL }).addTo(map);
    // Harita üzerinde kalıcı etiket (ada/parsel + nitelik)
    const etiketMetni = 'Ada ' + esc(p.adaNo) + ' / Parsel ' + esc(p.parselNo) +
      (p.nitelik ? '<br><span style="font-weight:400">' + esc(p.nitelik) + '</span>' : '');
    parselLayer.bindTooltip(etiketMetni, { permanent: true, direction: 'center', className: 'parsel-label', opacity: 1 }).openTooltip();
    try { map.fitBounds(parselLayer.getBounds(), { padding: [60, 60], maxZoom: 19 }); } catch { /* yoksa */ }
  } else if (p.merkez && p.merkez.lat) {
    map.setView([p.merkez.lat, p.merkez.lng], 18);
  }
  bilgiGoster(p);
}

function bilgiGoster(p, kaynak) {
  aktifParsel = p;
  const harita = p.merkez && p.merkez.lat ? p.merkez.lat + ',' + p.merkez.lng : '';
  const paylasMetni = encodeURIComponent(
    `${p.il}/${p.ilce}/${p.mahalle} — Ada ${p.adaNo} Parsel ${p.parselNo}` +
    (harita ? ` https://www.google.com/maps?q=${harita}` : '')
  );
  const favAktif = favoriIndex.has(favoriKey(p));
  const isAdmin = kullanici && kullanici.rol === 'admin';
  const ekBilgiHtml = isAdmin
    ? '<div class="info-ek"><div class="ek-title">Ek Bilgi <span class="ek-rol">admin</span></div>' +
        '<textarea id="ekBilgiInput" rows="3" placeholder="Bu parsel hakkında not ekleyin…">' + esc(p.ekBilgi || '') + '</textarea>' +
        '<button class="btn ek-kaydet" id="ekBilgiKaydet">Ek Bilgiyi Kaydet</button></div>'
    : '<div class="info-ek"><div class="ek-title">Ek Bilgi</div>' +
        '<div class="ek-text">' + (p.ekBilgi ? esc(p.ekBilgi) : '<span class="ek-bos">Henüz ek bilgi eklenmemiş.</span>') + '</div></div>';
  el('infoContent').innerHTML =
    '<div class="info-head">' +
      '<button class="info-fav' + (favAktif ? ' aktif' : '') + '" id="favToggle" title="Favorilere ekle/çıkar">★</button>' +
      '<div class="info-loc">' + esc(p.il) + ' / ' + esc(p.ilce) + ' / ' + esc(p.mahalle) + '</div>' +
      '<div class="info-ap">Ada ' + esc(p.adaNo) + ' · Parsel ' + esc(p.parselNo) + '</div>' +
    '</div>' +
    '<div class="info-rows">' +
      '<div class="info-row"><span class="k">Alan</span><span class="v">' + fmtAlan(p.alan) + '</span></div>' +
      '<div class="info-row"><span class="k">Nitelik</span><span class="v">' + esc(p.nitelik || '—') + '</span></div>' +
      (p.pafta ? '<div class="info-row"><span class="k">Pafta</span><span class="v">' + esc(p.pafta) + '</span></div>' : '') +
      '<div class="info-row"><span class="k">Mahalle Kodu</span><span class="v">' + esc(p.mahalleKodu || '—') + '</span></div>' +
      '<div class="info-row"><span class="k">İmar Durumu</span><span class="v">' +
        '<a class="imar-link" target="_blank" rel="noopener" href="https://www.turkiye.gov.tr/e-imar">e-İmar\'da sorgula →</a>' +
      '</span></div>' +
    '</div>' +
    ekBilgiHtml +
    '<div class="info-actions">' +
      (harita ? '<a class="primary" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + harita + '">Haritalar</a>' : '') +
      '<a target="_blank" rel="noopener" href="https://wa.me/?text=' + paylasMetni + '">WhatsApp</a>' +
    '</div>' +
    '<div class="info-actions">' +
      '<button class="info-btn" id="pdfBtn">📄 PDF</button>' +
      '<button class="info-btn" id="linkBtn">🔗 Bağlantı</button>' +
    '</div>' +
    '<div class="info-src">Kaynak: ' + (kaynak === 'onbellek' ? 'Önbellek (kayıtlı)' : 'TKGM') +
      ' · İmar bilgisi belediyeden, TKGM\'de yer almaz</div>';
  gorunum('parsel');
  const favBtn = el('favToggle');
  if (favBtn) favBtn.addEventListener('click', () => favoriToggle(p));
  const pdfBtn = el('pdfBtn');
  if (pdfBtn) pdfBtn.addEventListener('click', () => parselPdf(p));
  const linkBtn = el('linkBtn');
  if (linkBtn) linkBtn.addEventListener('click', () => paylasLinkKopyala(p));
  const ekKaydet = el('ekBilgiKaydet');
  if (ekKaydet) ekKaydet.addEventListener('click', () => ekBilgiKaydet(p));
}

// Admin: parsele ek bilgi kaydeder
async function ekBilgiKaydet(p) {
  const inp = el('ekBilgiInput');
  if (!inp) return;
  const btn = el('ekBilgiKaydet');
  btn.disabled = true;
  try {
    const res = await fetch('/api/parsel/ek-bilgi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mahalleKodu: p.mahalleKodu, adaNo: p.adaNo, parselNo: p.parselNo, ekBilgi: inp.value }),
    });
    if (res.status === 401) { authModalAc('giris'); return; }
    if (res.status === 403) { toast('Bu işlem için admin olmalısınız.'); return; }
    const data = await res.json();
    if (data.ok) { p.ekBilgi = data.ekBilgi; if (aktifParsel) aktifParsel.ekBilgi = data.ekBilgi; toast('Ek bilgi kaydedildi.'); }
    else toast(data.hata || 'Kaydedilemedi.');
  } catch {
    toast('Sunucuya ulaşılamadı.');
  } finally {
    btn.disabled = false;
  }
}

// Parsel bilgisini yazdırılabilir/PDF olarak açar (tarayıcının "PDF olarak kaydet"i ile indirilir)
function parselPdf(p) {
  const harita = p.merkez && p.merkez.lat ? p.merkez.lat + ', ' + p.merkez.lng : '—';
  const satir = (k, v) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>';
  const html =
    '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>ParselBul — Ada ' +
    esc(p.adaNo) + ' Parsel ' + esc(p.parselNo) + '</title><style>' +
    'body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#14241b;padding:32px;max-width:640px;margin:auto}' +
    'h1{color:#1f7a4d;font-size:22px;margin:0 0 4px}.sub{color:#5d6b62;margin:0 0 20px}' +
    'table{width:100%;border-collapse:collapse}td{padding:9px 6px;border-bottom:1px solid #e3e8e4;font-size:14px}' +
    'td:first-child{color:#5d6b62;width:40%}td:last-child{font-weight:600}' +
    '.foot{margin-top:24px;font-size:12px;color:#8a978f}@media print{body{padding:0}}</style></head><body>' +
    '<h1>◆ ParselBul</h1><p class="sub">Parsel Bilgileri</p><table>' +
    satir('İl / İlçe / Mahalle', (p.il || '') + ' / ' + (p.ilce || '') + ' / ' + (p.mahalle || '')) +
    satir('Ada / Parsel', p.adaNo + ' / ' + p.parselNo) +
    satir('Alan', fmtAlan(p.alan)) +
    satir('Nitelik', p.nitelik || '—') +
    (p.pafta ? satir('Pafta', p.pafta) : '') +
    satir('Mahalle Kodu', p.mahalleKodu || '—') +
    satir('Merkez Koordinat', harita) +
    '</table><p class="foot">Kaynak: TKGM · İmar durumu belediyeden sorgulanmalıdır.<br>ParselBul ile oluşturuldu.</p>' +
    '<script>window.onload=function(){window.print();}<\/script></body></html>';
  const w = window.open('', '_blank');
  if (!w) { toast('PDF için açılır pencereye izin verin.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// Parsele doğrudan giden paylaşılabilir bağlantıyı panoya kopyalar
function paylasLinkKopyala(p) {
  const url = location.origin + '/?mah=' + encodeURIComponent(p.mahalleKodu) +
    '&ada=' + encodeURIComponent(p.adaNo) + '&parsel=' + encodeURIComponent(p.parselNo);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => toast('Bağlantı kopyalandı.'),
      () => toast('Kopyalanamadı: ' + url));
  } else {
    toast(url);
  }
}

el('infoClose').addEventListener('click', () => {
  if (parselLayer) { map.removeLayer(parselLayer); parselLayer = null; }
  gorunum('harita');
});

// ---- Haritaya tıkla → koordinatla sorgu (ölçüm modunda nokta ekler) ----
map.on('click', async (e) => {
  if (olcumModu) { olcumNoktaEkle(e.latlng); return; }
  if (!kullanici) { authModalAc('giris'); toast('Sorgulama için giriş yapın.'); return; }
  const { lat, lng } = e.latlng;
  loading(true);
  try {
    const res = await fetch('/api/tkgm/parsel-konum/' + lat.toFixed(6) + '/' + lng.toFixed(6));
    if (res.status === 401) { authModalAc('giris'); return; }
    const data = await res.json();
    if (data.ok) parseliCiz(data.veri);
    else toast(res.status === 404 ? 'Bu noktada parsel bulunamadı.' : (data.hata || 'Sorgu hatası.'));
  } catch {
    toast('Sunucuya ulaşılamadı.');
  } finally {
    loading(false);
  }
});

// ---- Dropdown arama (İl → İlçe → Mahalle) ----
const ilSel = el('il'), ilceSel = el('ilce'), mahalleSel = el('mahalle');

function doldur(sel, list, placeholder) {
  sel.innerHTML = '<option value="">' + placeholder + '</option>';
  list.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.id; opt.textContent = o.ad;
    if (o.bounds) opt.dataset.bounds = JSON.stringify(o.bounds);
    sel.appendChild(opt);
  });
}

// Seçili idari birimin sınırına haritayı götürür (#1 otomatik bölgeye gitme)
function seciliSinirGit(sel, maxZoom) {
  const opt = sel.selectedOptions[0];
  if (opt && opt.dataset.bounds) {
    try { map.fitBounds(JSON.parse(opt.dataset.bounds), { padding: [25, 25], maxZoom: maxZoom || 16 }); } catch { /* yoksa */ }
  }
}

async function illeriYukle() {
  try {
    const data = await (await fetch('/api/tkgm/iller')).json();
    if (data.ok) doldur(ilSel, data.veri, 'İl seçin');
    else ilSel.innerHTML = '<option value="">İller yüklenemedi</option>';
  } catch { ilSel.innerHTML = '<option value="">İller yüklenemedi</option>'; }
}

ilSel.addEventListener('change', async () => {
  ilceSel.disabled = true; mahalleSel.disabled = true;
  ilceSel.innerHTML = '<option value="">Yükleniyor…</option>';
  mahalleSel.innerHTML = '<option value="">İlçe seçin</option>';
  if (!ilSel.value) { ilceSel.innerHTML = '<option value="">İl seçin</option>'; return; }
  seciliSinirGit(ilSel, 11); // ile zoom
  try {
    const data = await (await fetch('/api/tkgm/ilceler/' + encodeURIComponent(ilSel.value))).json();
    if (data.ok) { doldur(ilceSel, data.veri, 'İlçe seçin'); ilceSel.disabled = false; }
    else ilceSel.innerHTML = '<option value="">İlçeler yüklenemedi</option>';
  } catch { ilceSel.innerHTML = '<option value="">İlçeler yüklenemedi</option>'; }
});

ilceSel.addEventListener('change', async () => {
  mahalleSel.disabled = true;
  mahalleSel.innerHTML = '<option value="">Yükleniyor…</option>';
  if (!ilceSel.value) { mahalleSel.innerHTML = '<option value="">İlçe seçin</option>'; return; }
  seciliSinirGit(ilceSel, 14); // ilçeye zoom
  try {
    const data = await (await fetch('/api/tkgm/mahalleler/' + encodeURIComponent(ilceSel.value))).json();
    if (data.ok) { doldur(mahalleSel, data.veri, 'Mahalle seçin'); mahalleSel.disabled = false; }
    else mahalleSel.innerHTML = '<option value="">Mahalleler yüklenemedi</option>';
  } catch { mahalleSel.innerHTML = '<option value="">Mahalleler yüklenemedi</option>'; }
});

mahalleSel.addEventListener('change', () => {
  seciliSinirGit(mahalleSel, 17); // mahalleye zoom
});

async function araParsel() {
  if (!kullanici) { authModalAc('giris'); toast('Sorgulama için giriş yapın.'); return; }
  const mah = mahalleSel.value, ada = el('ada').value.trim(), parsel = el('parsel').value.trim();
  if (!mah) { toast('Lütfen İl → İlçe → Mahalle seçin.'); return; }
  if (!ada || !parsel) { toast('Lütfen Ada ve Parsel numarasını girin.'); return; }
  loading(true);
  el('sorgulaBtn').disabled = true;
  try {
    const res = await fetch('/api/tkgm/parsel/' + encodeURIComponent(mah) + '/' + encodeURIComponent(ada) + '/' + encodeURIComponent(parsel));
    if (res.status === 401) { authModalAc('giris'); return; }
    const data = await res.json();
    if (data.ok) { parseliCiz(data.veri); bilgiGoster(data.veri, data.kaynak); }
    else toast(res.status === 404 ? 'Parsel bulunamadı.' : (data.hata || 'Sorgu hatası.'));
  } catch {
    toast('Sunucuya ulaşılamadı.');
  } finally {
    loading(false);
    el('sorgulaBtn').disabled = false;
  }
}

el('sorgulaBtn').addEventListener('click', araParsel);
['ada', 'parsel'].forEach((id) => el(id).addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); araParsel(); }
}));

// ---- Arama sekmeleri (Adres / Ada-Parsel) ----
const selText = (sel) => (sel.value && sel.selectedOptions[0]) ? sel.selectedOptions[0].textContent : '';
let aramaModu = 'adres';

el('searchTabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  aramaModu = b.dataset.mode;
  document.querySelectorAll('#searchTabs button').forEach((x) => x.classList.toggle('active', x.dataset.mode === aramaModu));
  el('modeAdres').hidden = aramaModu !== 'adres';
  el('modeAdapar').hidden = aramaModu !== 'adapar';
});

// Adres modu: serbest metin adresi geocode edip o noktadaki parseli sorgular (adres OSM kaynaklı)
async function adresBul() {
  if (!kullanici) { authModalAc('giris'); toast('Sorgulama için giriş yapın.'); return; }
  const cadde = el('cadde').value.trim();
  const binaNo = el('binaNo').value.trim();
  const mah = selText(mahalleSel);
  if (!cadde && !mah) { toast('Mahalle seçin ya da cadde/sokak girin.'); return; }
  const parcalar = [
    (binaNo && cadde) ? (binaNo + ' ' + cadde) : cadde,
    mah, selText(ilceSel), selText(ilSel),
  ].filter(Boolean);
  const q = parcalar.join(', ') + ', Türkiye';

  loading(true);
  el('adresBulBtn').disabled = true;
  try {
    const g = await (await fetch('/api/geocode?q=' + encodeURIComponent(q))).json();
    if (!g.ok || !g.sonuc) { toast('Adres bulunamadı. Daha açık yazmayı deneyin.'); return; }
    const { lat, lng } = g.sonuc;
    map.flyTo([lat, lng], 18, { duration: 0.8 });
    const res = await fetch('/api/tkgm/parsel-konum/' + lat.toFixed(6) + '/' + lng.toFixed(6));
    if (res.status === 401) { authModalAc('giris'); return; }
    const data = await res.json();
    if (data.ok) parseliCiz(data.veri);
    else toast('Adres bulundu; o noktada parsel yok. Yakınına tıklayarak seçebilirsiniz.');
  } catch {
    toast('Adres servisi yanıt vermedi.');
  } finally {
    loading(false);
    el('adresBulBtn').disabled = false;
  }
}
el('adresBulBtn').addEventListener('click', adresBul);
['cadde', 'binaNo'].forEach((id) => el(id).addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); adresBul(); }
}));

// ---- Sidebar görünüm değiştirme (Harita / Ara / Favoriler / Parsel) ----
const VIEWS = { harita: 'viewHarita', ara: 'viewAra', fav: 'viewFav', parsel: 'viewParsel' };
function gorunum(ad) {
  Object.entries(VIEWS).forEach(([k, id]) => { el(id).hidden = (k !== ad); });
  // nav aktifliği (parsel görünümünde nav'da karşılığı yok)
  document.querySelectorAll('#sbNav .nav-item').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === ad));
  if (window.innerWidth <= 820) document.body.classList.remove('menu-open');
}

el('sbNav').addEventListener('click', (e) => {
  const b = e.target.closest('.nav-item');
  if (!b) return;
  const v = b.dataset.view;
  if (v === 'fav') {
    if (!kullanici) { authModalAc('giris'); toast('Favoriler için giriş yapın.'); return; }
    favorileriYukle();
  }
  gorunum(v);
});

// Mobil menü aç/kapat
el('mobileToggle').addEventListener('click', () => {
  document.body.classList.toggle('menu-open');
});

// ---- Hızlı adres araması (üst kutu) ----
async function hizliAra() {
  if (!kullanici) { authModalAc('giris'); toast('Sorgulama için giriş yapın.'); return; }
  const q = el('quickSearch').value.trim();
  if (q.length < 3) { toast('En az 3 karakter girin.'); return; }
  loading(true);
  try {
    const g = await (await fetch('/api/geocode?q=' + encodeURIComponent(q + ', Türkiye'))).json();
    if (!g.ok || !g.sonuc) { toast('Konum bulunamadı.'); return; }
    const { lat, lng } = g.sonuc;
    map.flyTo([lat, lng], 18, { duration: 0.8 });
    const res = await fetch('/api/tkgm/parsel-konum/' + lat.toFixed(6) + '/' + lng.toFixed(6));
    if (res.status === 401) { authModalAc('giris'); return; }
    const data = await res.json();
    if (data.ok) parseliCiz(data.veri);
    else toast('Konuma gidildi; o noktada parsel yok. Haritadan seçebilirsiniz.');
  } catch {
    toast('Adres servisi yanıt vermedi.');
  } finally {
    loading(false);
  }
}
el('quickSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); hizliAra(); }
});

// ---- Konumum (geolocation) ----
el('locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { toast('Tarayıcı konum desteklemiyor.'); return; }
  toast('Konum alınıyor…');
  navigator.geolocation.getCurrentPosition(
    (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 17, { duration: 0.8 }),
    () => toast('Konum alınamadı (izin gerekli).'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// ---- Kimlik doğrulama (giriş / kayıt / çıkış) ----
let authMod = 'giris'; // 'giris' | 'kayit'

function renderAuth() {
  const area = el('authArea');
  if (kullanici) {
    const adGoster = kullanici.ad || kullanici.eposta;
    const bashar = (kullanici.ad || kullanici.eposta || '?').trim().charAt(0).toUpperCase();
    area.innerHTML =
      '<div class="user-chip"><span class="avatar">' + esc(bashar) + '</span>' +
      '<span class="uname">' + esc(adGoster) + '</span>' +
      '<button id="logoutBtn">Çıkış</button></div>';
    el('logoutBtn').addEventListener('click', cikisYap);
  } else {
    area.innerHTML = '<button class="btn-login" id="loginOpenBtn">Giriş Yap</button>';
    el('loginOpenBtn').addEventListener('click', () => authModalAc('giris'));
  }
  if (!kullanici) { favoriler = []; favoriIndex.clear(); renderFavoriler(); }
}

function authModalAc(mod) {
  setAuthMod(mod || 'giris');
  el('authErr').textContent = '';
  el('authModal').hidden = false;
  el('eposta').focus();
}
function authModalKapat() { el('authModal').hidden = true; }

function setAuthMod(mod) {
  authMod = mod;
  document.querySelectorAll('#authTabs button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === mod));
  el('adField').hidden = mod !== 'kayit';
  el('authTitle').textContent = mod === 'kayit' ? 'Kayıt Ol' : 'Giriş Yap';
  el('authSubmit').textContent = mod === 'kayit' ? 'Kayıt Ol' : 'Giriş Yap';
  el('sifre').autocomplete = mod === 'kayit' ? 'new-password' : 'current-password';
}

el('authTabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) { setAuthMod(b.dataset.tab); el('authErr').textContent = ''; }
});
el('authClose').addEventListener('click', authModalKapat);
el('authModal').addEventListener('click', (e) => { if (e.target === el('authModal')) authModalKapat(); });
el('loginOpenBtn').addEventListener('click', () => authModalAc('giris'));

el('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = el('authErr');
  err.textContent = '';
  const govde = {
    eposta: el('eposta').value.trim(),
    sifre: el('sifre').value,
  };
  if (authMod === 'kayit') govde.ad = el('ad').value.trim();
  const url = authMod === 'kayit' ? '/api/auth/kayit' : '/api/auth/giris';
  el('authSubmit').disabled = true;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });
    const data = await res.json();
    if (data.ok) {
      kullanici = data.kullanici;
      renderAuth();
      favorileriYukle();
      paylasilaniYukle();
      authModalKapat();
      el('authForm').reset();
      toast('Hoş geldiniz' + (kullanici.ad ? ', ' + kullanici.ad : '') + '!');
    } else {
      err.textContent = data.hata || 'İşlem başarısız.';
    }
  } catch {
    err.textContent = 'Sunucuya ulaşılamadı.';
  } finally {
    el('authSubmit').disabled = false;
  }
});

async function cikisYap() {
  try { await fetch('/api/auth/cikis', { method: 'POST' }); } catch { /* yoksay */ }
  kullanici = null;
  renderAuth();
  toast('Çıkış yapıldı.');
}

async function oturumKontrol() {
  try {
    const data = await (await fetch('/api/auth/ben')).json();
    kullanici = data.kullanici || null;
  } catch { kullanici = null; }
  renderAuth();
  if (kullanici) { favorileriYukle(); paylasilaniYukle(); }
  else if (paylasParsel) { authModalAc('giris'); toast('Paylaşılan parseli görmek için giriş yapın.'); }
}

// ---- Paylaşılan bağlantı (?mah=&ada=&parsel=) ile gelen parseli otomatik aç ----
const _sp = new URLSearchParams(location.search);
let paylasParsel = (_sp.get('mah') && _sp.get('ada') && _sp.get('parsel'))
  ? { mah: _sp.get('mah'), ada: _sp.get('ada'), parsel: _sp.get('parsel') } : null;

async function paylasilaniYukle() {
  if (!paylasParsel || !kullanici) return;
  const { mah, ada, parsel } = paylasParsel;
  paylasParsel = null;
  loading(true);
  try {
    const res = await fetch('/api/tkgm/parsel/' + encodeURIComponent(mah) + '/' +
      encodeURIComponent(ada) + '/' + encodeURIComponent(parsel));
    const data = await res.json();
    if (data.ok) { parseliCiz(data.veri); bilgiGoster(data.veri, data.kaynak); }
  } catch { /* yoksay */ } finally { loading(false); }
}

// ---- Favoriler ----
function favoriKey(p) {
  const mk = p.mahalleKodu != null ? p.mahalleKodu : p.mahalle_kodu;
  const a = p.adaNo != null ? p.adaNo : p.ada;
  const pr = p.parselNo != null ? p.parselNo : p.parsel;
  return mk + '/' + a + '/' + pr;
}

async function favorileriYukle() {
  if (!kullanici) { favoriler = []; favoriIndex.clear(); renderFavoriler(); return; }
  try {
    const data = await (await fetch('/api/favoriler')).json();
    if (data.ok) {
      favoriler = data.veri;
      favoriIndex.clear();
      favoriler.forEach((f) => favoriIndex.set(favoriKey(f), f));
    }
  } catch { /* yoksay */ }
  renderFavoriler();
  if (aktifParsel && el('favToggle')) {
    el('favToggle').classList.toggle('aktif', favoriIndex.has(favoriKey(aktifParsel)));
  }
}

async function favoriToggle(p) {
  if (!kullanici) { authModalAc('giris'); return; }
  const key = favoriKey(p);
  const mevcut = favoriIndex.get(key);
  try {
    if (mevcut) {
      const r = await fetch('/api/favoriler/' + mevcut.id, { method: 'DELETE' });
      if (r.ok) toast('Favoriden çıkarıldı.');
    } else {
      const r = await fetch('/api/favoriler', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
      });
      if (r.status === 401) { authModalAc('giris'); return; }
      if (r.ok) toast('Favorilere eklendi.');
    }
    await favorileriYukle();
  } catch { toast('İşlem başarısız.'); }
}

async function favoriSilById(id) {
  try {
    const r = await fetch('/api/favoriler/' + id, { method: 'DELETE' });
    if (r.ok) { toast('Favoriden çıkarıldı.'); await favorileriYukle(); }
  } catch { toast('İşlem başarısız.'); }
}

async function favoriAc(f) {
  loading(true);
  try {
    const res = await fetch('/api/tkgm/parsel/' + encodeURIComponent(f.mahalle_kodu) + '/' +
      encodeURIComponent(f.ada) + '/' + encodeURIComponent(f.parsel));
    if (res.status === 401) { authModalAc('giris'); return; }
    const data = await res.json();
    if (data.ok) { parseliCiz(data.veri); bilgiGoster(data.veri, data.kaynak); }
    else toast('Parsel yüklenemedi.');
  } catch { toast('Sunucuya ulaşılamadı.'); }
  finally { loading(false); }
}

function renderFavoriler() {
  const list = el('favList');
  if (!list) return;
  if (!favoriler.length) {
    list.innerHTML = '<div class="fav-empty">Henüz favori yok. Bir parsel sorgulayıp ★ ile ekleyin.</div>';
    return;
  }
  list.innerHTML = favoriler.map((f) =>
    '<div class="fav-item" data-id="' + f.id + '">' +
      '<div class="fav-main">' +
        '<div class="fav-ap">Ada ' + esc(f.ada) + ' · Parsel ' + esc(f.parsel) + '</div>' +
        '<div class="fav-loc">' + esc(f.il || '') + ' / ' + esc(f.ilce || '') + ' / ' + esc(f.mahalle || '') + '</div>' +
      '</div>' +
      '<button class="fav-del" data-id="' + f.id + '" title="Sil" aria-label="Sil">🗑</button>' +
    '</div>'
  ).join('');
}

el('favList').addEventListener('click', (e) => {
  const del = e.target.closest('.fav-del');
  if (del) { e.stopPropagation(); favoriSilById(del.dataset.id); return; }
  const item = e.target.closest('.fav-item');
  if (item) { const f = favoriler.find((x) => String(x.id) === item.dataset.id); if (f) favoriAc(f); }
});

// ---- Ölçüm aracı (mesafe / alan) ----
let olcumNoktalar = [];
let olcumLayer = null;

function olcumModuAyarla(mod) {
  olcumModu = (olcumModu === mod) ? null : mod;
  el('toolMesafe').classList.toggle('active', olcumModu === 'mesafe');
  el('toolAlan').classList.toggle('active', olcumModu === 'alan');
  el('toolTemizle').hidden = !olcumModu;
  olcumTemizle();
  if (olcumModu) toast(olcumModu === 'mesafe' ? 'Mesafe için haritada noktalara tıklayın.' : 'Alan için köşelere tıklayın (en az 3).');
}

function olcumTemizle() {
  olcumNoktalar = [];
  if (olcumLayer) { map.removeLayer(olcumLayer); olcumLayer = null; }
  el('measureReadout').hidden = true;
}

function olcumNoktaEkle(latlng) {
  olcumNoktalar.push(latlng);
  olcumCiz();
}

function olcumCiz() {
  if (olcumLayer) map.removeLayer(olcumLayer);
  olcumLayer = L.layerGroup().addTo(map);
  const pts = olcumNoktalar;
  if (olcumModu === 'alan' && pts.length >= 3) {
    L.polygon(pts, { color: '#ef8b32', weight: 2, fillColor: '#ef8b32', fillOpacity: 0.15 }).addTo(olcumLayer);
  } else if (pts.length >= 2) {
    L.polyline(pts, { color: '#ef8b32', weight: 3 }).addTo(olcumLayer);
  }
  pts.forEach((pt) => L.circleMarker(pt, { radius: 4, color: '#ef8b32', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(olcumLayer));
  olcumReadout();
}

function olcumReadout() {
  const r = el('measureReadout');
  const pts = olcumNoktalar;
  if (!pts.length) { r.hidden = true; return; }
  if (olcumModu === 'mesafe') {
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += pts[i - 1].distanceTo(pts[i]);
    r.innerHTML = 'Mesafe: <b>' + fmtMesafe(d) + '</b>' + (pts.length < 2 ? ' — nokta ekleyin' : '');
  } else {
    const a = pts.length >= 3 ? geodesicArea(pts) : 0;
    r.innerHTML = 'Alan: <b>' + fmtAlanOlcum(a) + '</b>' + (pts.length < 3 ? ' — en az 3 nokta' : '');
  }
  r.hidden = false;
}

function fmtMesafe(m) {
  if (m < 1000) return m.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' m';
  return (m / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
}
function fmtAlanOlcum(m2) {
  if (m2 <= 0) return '—';
  const m2s = m2.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' m²';
  const donum = (m2 / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return m2s + ' (' + donum + ' dönüm)';
}
function geodesicArea(latlngs) {
  let area = 0; const d2r = Math.PI / 180; const n = latlngs.length;
  if (n > 2) {
    for (let i = 0; i < n; i++) {
      const p1 = latlngs[i], p2 = latlngs[(i + 1) % n];
      area += ((p2.lng - p1.lng) * d2r) * (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
    }
    area = area * 6378137 * 6378137 / 2;
  }
  return Math.abs(area);
}

el('toolMesafe').addEventListener('click', () => olcumModuAyarla('mesafe'));
el('toolAlan').addEventListener('click', () => olcumModuAyarla('alan'));
el('toolTemizle').addEventListener('click', () => olcumTemizle());

oturumKontrol();
illeriYukle();
