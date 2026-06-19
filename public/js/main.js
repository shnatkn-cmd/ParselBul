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

// Sorgula butonu — veritabanı bağlanınca gerçek sorguya bağlanacak
document.getElementById('sorgulaBtn').addEventListener('click', function () {
  const hint = document.getElementById('searchHint');
  hint.textContent = 'Sorgulama altyapısı veritabanı bağlandıktan sonra etkinleşecek.';
  hint.style.color = '#155c39';
});
