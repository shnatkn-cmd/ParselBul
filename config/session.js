'use strict';

/**
 * Oturum (session) ara katmanı. Oturumlar MySQL'de `sessions` tablosunda saklanır,
 * böylece sunucu yeniden başlasa da kullanıcı oturumu korunur.
 */

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

function createSessionMiddleware() {
  const store = new MySQLStore({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    createDatabaseTable: true,
    schema: { tableName: 'sessions' },
  });

  return session({
    name: 'parselbul.sid',
    secret: process.env.SESSION_SECRET || 'parselbul-gizli-anahtar-degistir',
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto', // https arkasında otomatik secure (trust proxy ile)
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 gün
    },
  });
}

module.exports = { createSessionMiddleware };
