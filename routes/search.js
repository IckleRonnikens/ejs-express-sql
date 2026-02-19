const express = require('express');
const router = express.Router();
const db = require('../db');                
const paginate = require('../middleware/pagination'); 
const sanitizeHtml = require('sanitize-html');

router.get('/', paginate(20, 100), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    let q = (req.query.q || '').trim();

    if (!q) {
      return res.render('search', { title: 'Search', q: '', results: [], total: 0, page, limit });
    }

    const visibleQ = sanitizeHtml(q, { allowedTags: [], allowedAttributes: {} }).slice(0, 200);

    const matchClause = `MATCH(title, body, tags) AGAINST (? IN BOOLEAN MODE)`;

    const sql = `
      SELECT id, type, ref_id, title, LEFT(body, 200) AS body, tags
      FROM site_index
      WHERE ${matchClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [q, limit, offset]);

    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM site_index WHERE ${matchClause}`, [q]);

    res.render('search', {
      title: 'Search',
      q: visibleQ,
      results: rows || [],
      total: cnt.cnt || 0,
      page,
      limit
    });
  } catch (e) { next(e); }
});

module.exports = router;