// Yıl
document.getElementById('year').textContent = new Date().getFullYear();

// Sunucu + veritabanı durumunu çek ve alt bilgide göster
(async function checkStatus() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const dbb = data.database || {};
    if (dbb.connected) {
      dot.className = 'dot ok';
      text.textContent = 'Sunucu çalışıyor · Veritabanı bağlı';
    } else if (dbb.configured) {
      dot.className = 'dot err';
      text.textContent = 'Sunucu çalışıyor · Veritabanına bağlanılamadı';
    } else {
      dot.className = 'dot warn';
      text.textContent = 'Sunucu çalışıyor · Veritabanı bilgileri bekleniyor';
    }
  } catch (e) {
    dot.className = 'dot err';
    text.textContent = 'Sunucuya ulaşılamadı';
  }
})();

// Sorgula — veritabanından gerçek parsel araması
const btn = document.getElementById('sorgulaBtn');
const hint = document.getElementById('searchHint');
const resultsEl = document.getElementById('results');

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function fmtAlan(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' m²';
}

function renderSonuclar(data) {
  resultsEl.hidden = false;
  if (!data.ok) {
    resultsEl.innerHTML = '<p class="result-empty">' + esc(data.hata || 'Hata.') + '</p>';
    return;
  }
  if (data.adet === 0) {
    resultsEl.innerHTML = '<p class="result-empty">Eşleşen parsel bulunamadı.</p>';
    return;
  }
  const cards = data.sonuclar.map(function (p) {
    const harita = (p.enlem != null && p.boylam != null)
      ? '<a class="result-map" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + p.enlem + ',' + p.boylam + '">Haritada gör →</a>'
      : '';
    return '' +
      '<div class="result-card">' +
        '<div class="result-head">' +
          '<span class="result-loc">' + esc(p.il) + ' / ' + esc(p.ilce) + (p.mahalle ? ' / ' + esc(p.mahalle) : '') + '</span>' +
          '<span class="result-ap">Ada ' + esc(p.ada) + ' · Parsel ' + esc(p.parsel) + '</span>' +
        '</div>' +
        '<div class="result-meta">' +
          '<span>Alan: <strong>' + fmtAlan(p.alan_m2) + '</strong></span>' +
          '<span>Nitelik: <strong>' + esc(p.nitelik || '—') + '</strong></span>' +
          harita +
        '</div>' +
      '</div>';
  }).join('');
  resultsEl.innerHTML = '<p class="result-count">' + data.adet + ' sonuç</p>' + cards;
}

async function ara() {
  const params = new URLSearchParams();
  ['il', 'ilce', 'ada', 'parsel'].forEach(function (id) {
    const v = document.getElementById(id).value.trim();
    if (v) params.set(id, v);
  });

  if (![...params.keys()].length) {
    hint.textContent = 'Lütfen en az bir kriter girin.';
    hint.style.color = '#e74c3c';
    return;
  }

  hint.textContent = 'Aranıyor…';
  hint.style.color = '#5d6b62';
  btn.disabled = true;
  try {
    const res = await fetch('/api/parsel/ara?' + params.toString());
    const data = await res.json();
    renderSonuclar(data);
    hint.textContent = 'En az bir kriter girin (örn. İl + Ada/Parsel) ve Sorgula\'ya basın.';
  } catch (e) {
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
