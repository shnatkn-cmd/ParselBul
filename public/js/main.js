/* global L */
'use strict';

// ---- Harita kurulumu ----
const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([39.2, 35.0], 6);

const uydu = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 20, attribution: 'Tiles &copy; Esri' }
);
const sokak = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap',
});
// Uydu üstüne yol/etiket katmanı (referans)
const etiket = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 20 }
);

uydu.addTo(map);
etiket.addTo(map);

document.getElementById('layerSwitch').addEventListener('click', function (e) {
  const b = e.target.closest('button');
  if (!b) return;
  document.querySelectorAll('.layer-switch button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  if (b.dataset.layer === 'uydu') {
    map.removeLayer(sokak);
    uydu.addTo(map);
    etiket.addTo(map);
  } else {
    map.removeLayer(uydu);
    map.removeLayer(etiket);
    sokak.addTo(map);
  }
});

// ---- Yardımcılar ----
const el = (id) => document.getElementById(id);
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function fmtAlan(v) {
  if (v == null || v === 0) return '—';
  return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' m²';
}
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
const PARSEL_STIL = { color: '#ffcc00', weight: 3, fillColor: '#ffcc00', fillOpacity: 0.15 };

function parseliCiz(p) {
  if (parselLayer) { map.removeLayer(parselLayer); parselLayer = null; }
  if (p.geometri && p.geometri.coordinates) {
    parselLayer = L.geoJSON({ type: 'Feature', geometry: p.geometri, properties: {} }, { style: PARSEL_STIL }).addTo(map);
    try { map.fitBounds(parselLayer.getBounds(), { padding: [60, 60], maxZoom: 19 }); } catch { /* yoksa */ }
  } else if (p.merkez && p.merkez.lat) {
    map.setView([p.merkez.lat, p.merkez.lng], 18);
  }
  bilgiGoster(p);
}

function bilgiGoster(p, kaynak) {
  const harita = p.merkez && p.merkez.lat ? p.merkez.lat + ',' + p.merkez.lng : '';
  const paylasMetni = encodeURIComponent(
    `${p.il}/${p.ilce}/${p.mahalle} — Ada ${p.adaNo} Parsel ${p.parselNo}` +
    (harita ? ` https://www.google.com/maps?q=${harita}` : '')
  );
  el('infoContent').innerHTML =
    '<div class="info-head">' +
      '<div class="info-loc">' + esc(p.il) + ' / ' + esc(p.ilce) + ' / ' + esc(p.mahalle) + '</div>' +
      '<div class="info-ap">Ada ' + esc(p.adaNo) + ' · Parsel ' + esc(p.parselNo) + '</div>' +
    '</div>' +
    '<div class="info-rows">' +
      '<div class="info-row"><span class="k">Alan</span><span class="v">' + fmtAlan(p.alan) + '</span></div>' +
      '<div class="info-row"><span class="k">Nitelik</span><span class="v">' + esc(p.nitelik || '—') + '</span></div>' +
      (p.pafta ? '<div class="info-row"><span class="k">Pafta</span><span class="v">' + esc(p.pafta) + '</span></div>' : '') +
      '<div class="info-row"><span class="k">Mahalle Kodu</span><span class="v">' + esc(p.mahalleKodu || '—') + '</span></div>' +
    '</div>' +
    '<div class="info-actions">' +
      (harita ? '<a class="primary" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + harita + '">Google Maps</a>' : '') +
      '<a target="_blank" rel="noopener" href="https://wa.me/?text=' + paylasMetni + '">WhatsApp ile paylaş</a>' +
    '</div>' +
    '<div class="info-src">Kaynak: ' + (kaynak === 'onbellek' ? 'Önbellek (kayıtlı)' : 'TKGM') + '</div>';
  el('infoPanel').hidden = false;
}

el('infoClose').addEventListener('click', () => {
  el('infoPanel').hidden = true;
  if (parselLayer) { map.removeLayer(parselLayer); parselLayer = null; }
});

// ---- Haritaya tıkla → koordinatla sorgu ----
map.on('click', async (e) => {
  const { lat, lng } = e.latlng;
  loading(true);
  try {
    const res = await fetch('/api/tkgm/parsel-konum/' + lat.toFixed(6) + '/' + lng.toFixed(6));
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
    sel.appendChild(opt);
  });
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
  try {
    const data = await (await fetch('/api/tkgm/mahalleler/' + encodeURIComponent(ilceSel.value))).json();
    if (data.ok) { doldur(mahalleSel, data.veri, 'Mahalle seçin'); mahalleSel.disabled = false; }
    else mahalleSel.innerHTML = '<option value="">Mahalleler yüklenemedi</option>';
  } catch { mahalleSel.innerHTML = '<option value="">Mahalleler yüklenemedi</option>'; }
});

async function araParsel() {
  const mah = mahalleSel.value, ada = el('ada').value.trim(), parsel = el('parsel').value.trim();
  if (!mah) { toast('Lütfen İl → İlçe → Mahalle seçin.'); return; }
  if (!ada || !parsel) { toast('Lütfen Ada ve Parsel numarasını girin.'); return; }
  loading(true);
  el('sorgulaBtn').disabled = true;
  try {
    const res = await fetch('/api/tkgm/parsel/' + encodeURIComponent(mah) + '/' + encodeURIComponent(ada) + '/' + encodeURIComponent(parsel));
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

// Mobil panel aç/kapat
el('panelToggle').addEventListener('click', () => {
  el('searchPanel').classList.toggle('collapsed');
});

illeriYukle();
