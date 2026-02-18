
const express = require('express');
const router = express.Router();
const db = require('../db');
const paginate = require('../middleware/pagination');

router.get('/', paginate(20,100), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const q = (req.query.q || '').trim();
    if (!q) return res.render('search', { title: 'Search', q: '', results: [], total: 0, page, limit });

    // FULLTEXT boolean mode search
    const match = `MATCH(title, body, tags) AGAINST (? IN BOOLEAN MODE)`;
    const sql = `SELECT id, type, ref_id, title, LEFT(body, 200) AS body, tags FROM site_index WHERE ${match} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const [rows] = await db.query(sql, [q, limit, offset]);

    // Get total rough count (MySQL cannot easily count with relevance); run a COUNT with same predicate
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM site_index WHERE ${match}`, [q]);

    res.render('search', { title: 'Search', q, results: rows, total: cnt.cnt, page, limit });
  } catch (e) { next(e); }
});

module.exports = router;
