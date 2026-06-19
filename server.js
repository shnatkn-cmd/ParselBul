'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Statik anasayfa ve varlıklar
app.use(express.static(path.join(__dirname, 'public')));

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
