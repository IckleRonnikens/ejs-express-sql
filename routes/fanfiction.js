
const express = require('express');
const router = express.Router();
const db = require('../db');
const paginate = require('../middleware/pagination');

router.get('/', (req, res) => res.render('fanfiction/landing', { title: 'Fanfiction' }));

router.get('/writers', paginate(20,100), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const q = (req.query.q || '').trim();
    let where = '';
    const params = [];
    if (q) { where = 'WHERE name LIKE ? OR bio LIKE ?'; params.push(`%${q}%`,`%${q}%`); }
    const [writers] = await db.query(`SELECT * FROM writers ${where} ORDER BY name ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM writers ${where}`, params);
    res.render('fanfiction/writers', { title: 'Writers', writers, total: cnt.cnt, page, limit, q });
  } catch (e) { next(e); }
});

router.get('/writers/:id', paginate(10,50), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const [[writer]] = await db.query(`SELECT * FROM writers WHERE id=?`, [req.params.id]);
    if (!writer) return res.status(404).render('partials/404', { title: 'Not Found' });
    const [stories] = await db.query(`SELECT * FROM stories WHERE writer_id=? AND status='published' ORDER BY published_at DESC LIMIT ? OFFSET ?`, [writer.id, limit, offset]);
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM stories WHERE writer_id=? AND status='published'`, [writer.id]);
    res.render('fanfiction/writer_show', { title: writer.name, writer, stories, total: cnt.cnt, page, limit });
  } catch (e) { next(e); }
});

router.get('/stories', paginate(12,60), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const q = (req.query.q || '').trim();
    const tag = (req.query.tag || '').trim();
    let where = `WHERE s.status='published'`;
    const params = [];
    if (q) { where += ` AND (s.title LIKE ? OR s.summary LIKE ? OR s.content LIKE ?)`; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    if (tag) { where += ` AND CONCAT(',', IFNULL(s.tags,''), ',') LIKE ?`; params.push(`%,${tag},%`); }

    const sql = `SELECT s.id, s.title, s.summary, s.published_at, s.tags, w.name as writer_name
                 FROM stories s JOIN writers w ON s.writer_id=w.id
                 ${where}
                 ORDER BY s.published_at DESC
                 LIMIT ? OFFSET ?`;
    const [stories] = await db.query(sql, [...params, limit, offset]);
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM stories s ${where}`, params);
    res.render('fanfiction/stories', { title: 'Stories', stories, total: cnt.cnt, page, limit, q, tag });
  } catch (e) { next(e); }
});

router.get('/archives', async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT DATE_FORMAT(published_at, '%Y-%m') AS ym, COUNT(*) AS cnt FROM stories WHERE status='published' GROUP BY ym ORDER BY ym DESC`);
    res.render('fanfiction/archives', { title: 'Archives', buckets: rows });
  } catch (e) { next(e); }
});

router.get('/public-lists', paginate(20,100), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const [rows] = await db.query(`SELECT s.id, s.title, w.name as writer_name, s.summary, s.published_at
                                   FROM stories s JOIN writers w ON s.writer_id=w.id
                                   WHERE s.status='published' AND s.is_archived=0
                                   ORDER BY s.published_at DESC
                                   LIMIT ? OFFSET ?`, [limit, offset]);
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM stories WHERE status='published' AND is_archived=0`);
    res.render('fanfiction/stories', { title: 'Public List', stories: rows, total: cnt.cnt, page, limit, q: null, tag: null });
  } catch (e) { next(e); }
});

module.exports = router;
