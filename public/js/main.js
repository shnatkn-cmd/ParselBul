// Yıl
document.getElementById('year').textContent = new Date().getFullYear();

const ilSel = document.getElementById('il');
const ilceSel = document.getElementById('ilce');
const mahalleSel = document.getElementById('mahalle');
const adaInput = document.getElementById('ada');
const parselInput = document.getElementById('parsel');
const btn = document.getElementById('sorgulaBtn');
const hint = document.getElementById('searchHint');
const resultsEl = document.getElementById('results');

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function fmtAlan(v) {
  if (v == null || v === 0) return '—';
  return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' m²';
}
function setHint(msg, color) {
  hint.textContent = msg;
  hint.style.color = color || '#5d6b62';
}
function doldur(sel, list, placeholder) {
  sel.innerHTML = '<option value="">' + placeholder + '</option>';
  list.forEach(function (o) {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.ad;
    sel.appendChild(opt);
  });
}

// --- İl listesi (sayfa açılışında) ---
async function illeriYukle() {
  try {
    const res = await fetch('/api/tkgm/iller');
    const data = await res.json();
    if (data.ok) {
      doldur(ilSel, data.veri, 'İl seçin');
    } else {
      ilSel.innerHTML = '<option value="">İller yüklenemedi</option>';
    }
  } catch {
    ilSel.innerHTML = '<option value="">İller yüklenemedi</option>';
  }
}

// --- İl seçilince ilçeler ---
ilSel.addEventListener('change', async function () {
  ilceSel.disabled = true;
  mahalleSel.disabled = true;
  ilceSel.innerHTML = '<option value="">Yükleniyor…</option>';
  mahalleSel.innerHTML = '<option value="">İlçe seçin</option>';
  if (!ilSel.value) { ilceSel.innerHTML = '<option value="">İl seçin</option>'; return; }
  try {
    const res = await fetch('/api/tkgm/ilceler/' + encodeURIComponent(ilSel.value));
    const data = await res.json();
    if (data.ok) { doldur(ilceSel, data.veri, 'İlçe seçin'); ilceSel.disabled = false; }
    else ilceSel.innerHTML = '<option value="">İlçeler yüklenemedi</option>';
  } catch { ilceSel.innerHTML = '<option value="">İlçeler yüklenemedi</option>'; }
});

// --- İlçe seçilince mahalleler ---
ilceSel.addEventListener('change', async function () {
  mahalleSel.disabled = true;
  mahalleSel.innerHTML = '<option value="">Yükleniyor…</option>';
  if (!ilceSel.value) { mahalleSel.innerHTML = '<option value="">İlçe seçin</option>'; return; }
  try {
    const res = await fetch('/api/tkgm/mahalleler/' + encodeURIComponent(ilceSel.value));
    const data = await res.json();
    if (data.ok) { doldur(mahalleSel, data.veri, 'Mahalle seçin'); mahalleSel.disabled = false; }
    else mahalleSel.innerHTML = '<option value="">Mahalleler yüklenemedi</option>';
  } catch { mahalleSel.innerHTML = '<option value="">Mahalleler yüklenemedi</option>'; }
});

// --- Parsel sorgu ---
function renderParsel(data) {
  resultsEl.hidden = false;
  if (!data.ok) {
    resultsEl.innerHTML = '<p class="result-empty">' + esc(data.hata || 'Parsel bulunamadı.') + '</p>';
    return;
  }
  const p = data.veri;
  const kaynak = data.kaynak === 'onbellek' ? 'Önbellek' : 'TKGM';
  const harita = (p.merkez && p.merkez.lat)
    ? '<a class="result-map" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + p.merkez.lat + ',' + p.merkez.lng + '">Haritada gör →</a>'
    : '';
  resultsEl.innerHTML =
    '<div class="result-card">' +
      '<div class="result-head">' +
        '<span class="result-loc">' + esc(p.il) + ' / ' + esc(p.ilce) + ' / ' + esc(p.mahalle) + '</span>' +
        '<span class="result-ap">Ada ' + esc(p.adaNo) + ' · Parsel ' + esc(p.parselNo) + '</span>' +
      '</div>' +
      '<div class="result-meta">' +
        '<span>Alan: <strong>' + fmtAlan(p.alan) + '</strong></span>' +
        '<span>Nitelik: <strong>' + esc(p.nitelik || '—') + '</strong></span>' +
        (p.pafta ? '<span>Pafta: <strong>' + esc(p.pafta) + '</strong></span>' : '') +
        harita +
      '</div>' +
      '<div class="result-foot">Kaynak: ' + kaynak + '</div>' +
    '</div>';
}

async function ara() {
  const mah = mahalleSel.value;
  const ada = adaInput.value.trim();
  const parsel = parselInput.value.trim();

  if (!mah) { setHint('Lütfen İl → İlçe → Mahalle seçin.', '#e74c3c'); return; }
  if (!ada || !parsel) { setHint('Lütfen Ada ve Parsel numarasını girin.', '#e74c3c'); return; }

  setHint('Sorgulanıyor…');
  btn.disabled = true;
  try {
    const url = '/api/tkgm/parsel/' + encodeURIComponent(mah) + '/' +
                encodeURIComponent(ada) + '/' + encodeURIComponent(parsel);
    const res = await fetch(url);
    const data = await res.json();
    renderParsel(data);
    setHint('İl → İlçe → Mahalle seçin, Ada ve Parsel girip Sorgula\'ya basın.');
  } catch {
    resultsEl.hidden = false;
    resultsEl.innerHTML = '<p class="result-empty">Sunucuya ulaşılamadı.</p>';
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener('click', ara);
document.getElementById('sorgula').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); ara(); }
});

// --- Durum göstergesi (footer) ---
(async function checkStatus() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const dbb = data.database || {};
    if (dbb.connected) { dot.className = 'dot ok'; text.textContent = 'Sunucu çalışıyor · Veritabanı bağlı'; }
    else if (dbb.configured) { dot.className = 'dot err'; text.textContent = 'Sunucu çalışıyor · Veritabanına bağlanılamadı'; }
    else { dot.className = 'dot warn'; text.textContent = 'Sunucu çalışıyor · Veritabanı bilgileri bekleniyor'; }
  } catch {
    dot.className = 'dot err'; text.textContent = 'Sunucuya ulaşılamadı';
  }
})();

illeriYukle();
