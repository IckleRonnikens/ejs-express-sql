// routes/fanfiction/publicLists/novelLength.js
const express = require('express');
const router = express.Router();
const db = require('../../../db'); // adjust to your pool path (mysql2/promise)

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const toIntOrNull = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim().slice(0, 200);
    const chars = (req.query.chars || '').trim().slice(0, 200);

    const minWords = toIntOrNull(req.query.minWords);
    const maxWords = toIntOrNull(req.query.maxWords);
    const minChapters = toIntOrNull(req.query.minChapters);
    const maxChapters = toIntOrNull(req.query.maxChapters);

    const page = clamp(parseInt(req.query.page || '1', 10) || 1, 1, 100000);
    const limit = clamp(parseInt(req.query.limit || '20', 10) || 20, 1, 200);
    const offset = (page - 1) * limit;

    const sort = (req.query.sort || 'created_desc').toLowerCase();
    const orderMap = {
      'created_desc'  : 'created_at DESC',
      'words_desc'    : 'words DESC',
      'words_asc'     : 'words ASC',
      'chapters_desc' : 'chapters DESC',
      'chapters_asc'  : 'chapters ASC',
    };
    const orderBy = orderMap[sort] || orderMap.created_desc;

    const where = [];
    const params = [];

    if (q) { where.push('(characters LIKE ? OR comments LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    if (chars) { where.push('characters LIKE ?'); params.push(`%${chars}%`); }
    if (minWords !== null) { where.push('words >= ?'); params.push(minWords); }
    if (maxWords !== null) { where.push('words <= ?'); params.push(maxWords); }
    if (minChapters !== null) { where.push('chapters >= ?'); params.push(minChapters); }
    if (maxChapters !== null) { where.push('chapters <= ?'); params.push(maxChapters); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Count
    const [[{ cnt }]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM novel_length ${whereSql}`,
      params
    );

    // Page rows
    const rows = (await db.query(
      `SELECT id, url, characters, chapters, words, comments, created_at
         FROM novel_length
         ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ))[0];

    res.render('fanfiction/public-lists/novel-length/index', {
      title: 'Novel-Length',
      // filters
      q, chars, minWords, maxWords, minChapters, maxChapters, sort,
      // data
      results: rows,
      total: cnt,
      page, limit,
      // breadcrumbs
      crumbs: [
        { label: 'Fanfiction', href: '/fanfiction' },
        { label: 'Public Lists', href: '/fanfiction/public-lists' },
        { label: 'Novel-Length', href: '/fanfiction/public-lists/novel-length', active: true }
      ],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;