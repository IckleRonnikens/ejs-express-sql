// routes/quotes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise pool
const sanitizeHtml = require('sanitize-html');

// Build a boolean-prefix query: hello world -> +hello* +world*
function toBooleanPrefixQuery(input, minLen = 3) {
  return (input || '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= minLen)
    .map(w => '+' + w.replace(/[-+~"()<>*]/g, ' ') + '*')
    .join(' ');
}

// Simple highlighter for short tokens; keeps HTML safe
function highlight(text, query) {
  if (!text || !query) return text;
  const tokens = query.trim().split(/\s+/).filter(t => t.length >= 3);
  if (!tokens.length) return text;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${tokens.map(esc).join('|')})`, 'ig');
  return text.replace(re, '<mark>$1</mark>');
}

// GET /quotes
//  /quotes?q=...&book=...&year=1999&page=1&limit=20
router.get('/', async (req, res, next) => {
  try {
    const qRaw = (req.query.q || '').trim().slice(0, 200);
    const q = sanitizeHtml(qRaw, { allowedTags: [], allowedAttributes: {} });
    const book = (req.query.book || '').trim().slice(0, 100);
    const year = parseInt(req.query.year, 10) || null;

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const filters = [];
    const params = [];

    if (book) { filters.push('book = ?'); params.push(book); }
    if (year) { filters.push('year = ?'); params.push(year); }

    // FTS vs fallback
    const boolQ = toBooleanPrefixQuery(q, 3);

    // 1) Count (FTS if searching; else count with filters only)
    let countSql, countParams;
    if (boolQ) {
      countSql = `
        SELECT COUNT(*) AS cnt
        FROM quotes
        MATCH(quote_text, book) AGAINST (? IN BOOLEAN MODE)
        ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
      `;
      countParams = [boolQ, ...params];
    } else {
      countSql = `
        SELECT COUNT(*) AS cnt
        FROM quotes
        ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''}
      `;
      countParams = params;
    }
    const [[{ cnt }]] = await db.query(countSql, countParams);

    // 2) Page results (FTS primary)
    let rows = [];
    if (boolQ) {
      const sql = `
SELECT id, book, year, quote_text, source_note, created_at,
       MATCH(quote_text) AGAINST (? IN BOOLEAN MODE) AS score
FROM quotes
WHERE MATCH(quote_text) AGAINST (? IN BOOLEAN MODE)
          ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
        ORDER BY score DESC, created_at DESC
        LIMIT ? OFFSET ?
      `;
      rows = (await db.query(sql, [boolQ, boolQ, ...params, limit, offset]))[0];
    } else {
      const sql = `
        SELECT id, book, year, quote_text, source_note, created_at, 0 AS score
        FROM quotes
        ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      rows = (await db.query(sql, [...params, limit, offset]))[0];
    }

    // 3) If no results but q present, fallback to LIKE
    if (!rows.length && q) {
      const like = `%${q}%`;
      const likeFilters = [];
      const likeParams = [];
      if (book) { likeFilters.push('book = ?'); likeParams.push(book); }
      if (year) { likeFilters.push('year = ?'); likeParams.push(year); }

      const sql = `
        SELECT id, book, year, quote_text, source_note, created_at, 0 AS score
        FROM quotes
        WHERE (quote_text LIKE ? OR book LIKE ?)
          ${likeFilters.length ? 'AND ' + likeFilters.join(' AND ') : ''}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      rows = (await db.query(sql, [like, like, ...likeParams, limit, offset]))[0];
    }

    // Prepare highlights (safe as we only wrap plain words)
    const results = rows.map(r => ({
      ...r,
      quote_html: q ? highlight(r.quote_text, q) : r.quote_text
    }));

    res.render('quotes/index', {
      title: 'Quotes',
      q, book, year,
      results,
      total: cnt,
      page, limit
    });
  } catch (e) {
    next(e);
  }
});

// GET /quotes/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [[row]] = await db.query(
      `SELECT id, book, year, quote_text, source_note, created_at
       FROM quotes WHERE id=?`, [id]
    );
    if (!row) return res.status(404).render('partials/404', { title: 'Not Found' });

    res.render('quotes/show', { title: `Quote #${row.id}`, quote: row });
  } catch (e) {
    next(e);
  }
});

module.exports = router;