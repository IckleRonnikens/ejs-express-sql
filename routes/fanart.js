
const express = require('express');
const router = express.Router();
const db = require('../db');
const paginate = require('../middleware/pagination');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'public', 'uploads');
const artDir = path.join(uploadDir, 'art');
if (!fs.existsSync(artDir)) fs.mkdirSync(artDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, artDir),
  filename: (_, file, cb) => cb(null, 'art_' + Date.now() + path.extname(file.originalname).toLowerCase())
});
const allowed = new Set(['.png','.jpg','.jpeg','.webp','.gif']);
const upload = multer({
  storage,
  fileFilter: (_, file, cb) => cb(allowed.has(path.extname(file.originalname).toLowerCase()) ? null : new Error('Invalid file'), allowed.has(path.extname(file.originalname).toLowerCase())),
  limits: { fileSize: 6 * 1024 * 1024 }
});

router.get('/', (req, res) => res.render('fanart/landing', { title: 'Fanart' }));

router.get('/artists', paginate(20,100), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const q = (req.query.q || '').trim();
    let where = '';
    const params = [];
    if (q) { where = 'WHERE name LIKE ? OR bio LIKE ?'; params.push(`%${q}%`,`%${q}%`); }
    const [artists] = await db.query(`SELECT * FROM artists ${where} ORDER BY name ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM artists ${where}`, params);
    res.render('fanart/artists', { title: 'Artists', artists, total: cnt.cnt, page, limit, q });
  } catch (e) { next(e); }
});

router.get('/artists/:id', paginate(12,60), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const [[artist]] = await db.query(`SELECT * FROM artists WHERE id=?`, [req.params.id]);
    if (!artist) return res.status(404).render('partials/404', { title: 'Not Found' });
    const [arts] = await db.query(`SELECT * FROM artworks WHERE artist_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`, [req.params.id, limit, offset]);
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM artworks WHERE artist_id=?`, [req.params.id]);
    res.render('fanart/artist_show', { title: artist.name, artist, arts, total: cnt.cnt, page, limit });
  } catch (e) { next(e); }
});

router.post('/artists/:id/upload', upload.single('image'), async (req, res, next) => {
  try {
    const cleanTitle = sanitizeHtml(req.body.title || 'Untitled', { allowedTags: [], allowedAttributes: {} }).slice(0,200);
    const cleanDesc = sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} }).slice(0,2000);
    const cleanTags = sanitizeHtml(req.body.tags || '', { allowedTags: [], allowedAttributes: {} }).slice(0,200);
    const isNSFW = req.body.nsfw ? 1 : 0;
    const relPath = req.file ? ('/public/uploads/art/' + path.basename(req.file.path)) : null;
    if (!relPath) return res.status(400).send('Image required');
    await db.query(`INSERT INTO artworks(artist_id, title, description, image_path, nsfw, tags) VALUES(?,?,?,?,?,?)`, [req.params.id, cleanTitle, cleanDesc, relPath, isNSFW, cleanTags]);
    res.redirect(`/fanart/artists/${req.params.id}`);
  } catch (e) { next(e); }
});

router.get('/sfw', paginate(24,100), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const q = (req.query.q || '').trim();
    let where = 'WHERE nsfw=0';
    const params = [];
    if (q) { where += ' AND (a.title LIKE ? OR a.description LIKE ? OR IFNULL(a.tags,\\\'\\\') LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    const [rows] = await db.query(`SELECT a.*, ar.name AS artist_name FROM artworks a JOIN artists ar ON a.artist_id=ar.id ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM artworks a ${where}`, params);
    res.render('fanart/sfw', { title: 'SFW Art', arts: rows, total: cnt.cnt, page, limit, q });
  } catch (e) { next(e); }
});

router.get('/nsfw', paginate(24,100), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const q = (req.query.q || '').trim();
    let where = 'WHERE nsfw=1';
    const params = [];
    if (q) { where += ' AND (a.title LIKE ? OR a.description LIKE ? OR IFNULL(a.tags,\\\'\\\') LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    const [rows] = await db.query(`SELECT a.*, ar.name AS artist_name FROM artworks a JOIN artists ar ON a.artist_id=ar.id ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM artworks a ${where}`, params);
    res.render('fanart/nsfw', { title: 'NSFW Art', arts: rows, total: cnt.cnt, page, limit, q });
  } catch (e) { next(e); }
});

module.exports = router;
