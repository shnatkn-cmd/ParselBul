'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Hostinger/Passenger https proxy arkasında
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Oturum (yalnızca DB yapılandırılmışsa — session store MySQL kullanır)
if (db.isConfigured()) {
  const { createSessionMiddleware } = require('./config/session');
  app.use(createSessionMiddleware());
}

// Statik anasayfa ve varlıklar
app.use(express.static(path.join(__dirname, 'public')));

// API rotaları
app.use('/api/auth', require('./routes/auth'));     // kayıt / giriş / çıkış / ben
app.use('/api/tkgm', require('./routes/tkgm'));     // canlı TKGM sorgusu (iller/ilçeler/mahalleler/parsel)
app.use('/api/parsel', require('./routes/parsel')); // önbellekte (kayıtlı parsellerde) arama

// Sağlık kontrolü (Hostinger / izleme için)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Sunucu + veritabanı durumu (anasayfa bu uçtan beslenir)
app.get('/api/status', async (req, res) => {
  const dbStatus = await db.testConnection();
  res.json({
    app: 'ParselBul',
    server: 'çalışıyor',
    database: dbStatus,
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`ParselBul http://localhost:${PORT} adresinde çalışıyor`);
  console.log(`Veritabanı yapılandırması: ${db.isConfigured() ? 'mevcut' : 'YOK (bilgiler bekleniyor)'}`);
});
