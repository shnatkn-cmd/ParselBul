'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const router = express.Router();

const EPOSTA_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Oturum açmış kullanıcıyı zorunlu kılan ara katman. */
function requireAuth(req, res, next) {
  if (req.session && req.session.kullanici) return next();
  return res.status(401).json({ ok: false, hata: 'Bu işlem için giriş yapmalısınız.' });
}

/** Kayıt: ad, eposta, şifre. */
router.post('/kayit', async (req, res) => {
  if (!db.isConfigured()) return res.status(503).json({ ok: false, hata: 'Veritabanı yapılandırılmadı.' });
  const ad = (req.body.ad || '').trim();
  const eposta = (req.body.eposta || '').trim().toLowerCase();
  const sifre = req.body.sifre || '';

  if (!EPOSTA_RE.test(eposta)) return res.status(400).json({ ok: false, hata: 'Geçerli bir e-posta girin.' });
  if (sifre.length < 6) return res.status(400).json({ ok: false, hata: 'Şifre en az 6 karakter olmalı.' });

  try {
    const hash = await bcrypt.hash(sifre, 10);
    const [r] = await db.getPool().query(
      'INSERT INTO kullanicilar (ad, eposta, sifre_hash) VALUES (?, ?, ?)',
      [ad || null, eposta, hash]
    );
    req.session.kullanici = { id: r.insertId, ad: ad || null, eposta, rol: 'uye' };
    res.status(201).json({ ok: true, kullanici: req.session.kullanici });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok: false, hata: 'Bu e-posta zaten kayıtlı.' });
    console.error('Kayıt hatası:', err.message);
    res.status(500).json({ ok: false, hata: 'Kayıt sırasında bir hata oluştu.' });
  }
});

/** Giriş: eposta, şifre. */
router.post('/giris', async (req, res) => {
  if (!db.isConfigured()) return res.status(503).json({ ok: false, hata: 'Veritabanı yapılandırılmadı.' });
  const eposta = (req.body.eposta || '').trim().toLowerCase();
  const sifre = req.body.sifre || '';

  try {
    const [rows] = await db.getPool().query(
      'SELECT id, ad, eposta, sifre_hash, rol FROM kullanicilar WHERE eposta = ? LIMIT 1',
      [eposta]
    );
    const u = rows[0];
    const eslesti = u ? await bcrypt.compare(sifre, u.sifre_hash) : false;
    if (!u || !eslesti) {
      return res.status(401).json({ ok: false, hata: 'E-posta veya şifre hatalı.' });
    }
    db.getPool().query('UPDATE kullanicilar SET son_giris = NOW() WHERE id = ?', [u.id]).catch(() => {});
    req.session.kullanici = { id: u.id, ad: u.ad, eposta: u.eposta, rol: u.rol };
    res.json({ ok: true, kullanici: req.session.kullanici });
  } catch (err) {
    console.error('Giriş hatası:', err.message);
    res.status(500).json({ ok: false, hata: 'Giriş sırasında bir hata oluştu.' });
  }
});

/** Çıkış. */
router.post('/cikis', (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.clearCookie('parselbul.sid');
    res.json({ ok: true });
  });
});

/** Mevcut oturum bilgisi. */
router.get('/ben', (req, res) => {
  res.json({ ok: true, kullanici: (req.session && req.session.kullanici) || null });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
