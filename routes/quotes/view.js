// routes/quotes/view.js
const express = require('express');
const router = express.Router();
const db = require('../../db');
let sanitizeHtml; try { sanitizeHtml = require('sanitize-html'); } catch { sanitizeHtml = (s) => String(s); }

const BOOKS = {
  ps:   "Philosopher's Stone",
  cos:  "Chamber of Secrets",
  poa:  "Prisoner of Azkaban",
  gof:  "Goblet of Fire",
  ootp: "Order of the Phoenix",
  hbp:  "Half-Blood Prince",
  dh:   "Deathly Hallows"
};

function toBooleanPrefixQuery(input, minLen = 3) {
  return (input || '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= minLen)
    .map(w => '+' + w.replace(/[-+~"()<>*]/g, ' ') + '*')
    .join(' ');
}

function highlight(text, query) {
  if (!text || !query) return text;
  const tokens = query.trim().split(/\s+/).filter(t => t.length >= 3);
  if (!tokens.length) return text;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${tokens.map(esc).join('|')})`, 'ig');
  return text.replace(re, '<mark>$1</mark>');
}

// DEV helper: comment out when done
function logSQL(sql, params) { console.log('\nSQL:\n' + sql + '\nPARAMS:', params, '\n'); }

router.get('/:code', async (req, res, next) => {
  try {
    const code = (req.params.code || '').toLowerCase();
    const bookTitle = BOOKS[code];
    if (!bookTitle) return res.status(404).send('Unknown book');

    const qRaw = (req.query.q || '').trim().slice(0, 200);
    const q = sanitizeHtml(qRaw, { allowedTags: [], allowedAttributes: {} });
    const year = req.query.year ? parseInt(req.query.year, 10) : null;

    const sort = (req.query.sort || (q ? 'relevance' : 'newest')).toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const offset = (page - 1) * limit;

    // Inline ints (avoid placeholders for LIMIT/OFFSET)
    const limitSQL = Number.isFinite(limit) ? String(limit) : '20';
    const offsetSQL = Number.isFinite(offset) ? String(offset) : '0';

    const orderMap = {
      relevance: 'score DESC, created_at DESC',
      newest: 'created_at DESC',
      oldest: 'created_at ASC',
      year_asc: 'year ASC, created_at DESC',
      year_desc: 'year DESC, created_at DESC'
    };
    const orderBy = orderMap[sort] || (q ? orderMap.relevance : orderMap.newest);

    const filters = ['book = ?'];
    const paramsBase = [bookTitle];
    if (Number.isInteger(year)) { filters.push('year = ?'); paramsBase.push(year); }
    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const boolQ = toBooleanPrefixQuery(q, 3);

    // COUNT
    let total = 0;
    if (boolQ) {
      const sqlCount = `
        SELECT COUNT(*) AS cnt
          FROM quotes
         ${whereSql ? `${whereSql} AND` : 'WHERE'} MATCH(quote_text) AGAINST (? IN BOOLEAN MODE)
      `;
      const paramsCount = [...paramsBase, boolQ];
      logSQL(sqlCount, paramsCount);
      const [[{ cnt }]] = await db.query(sqlCount, paramsCount);
      total = cnt;
    } else {
      const sqlCount = `SELECT COUNT(*) AS cnt FROM quotes ${whereSql}`;
      logSQL(sqlCount, paramsBase);
      const [[{ cnt }]] = await db.query(sqlCount, paramsBase);
      total = cnt;
    }

    // PAGE rows
    let rows = [];
    if (boolQ) {
      const sqlPage = `
        SELECT id, book, year, quote_text, source_note, created_at,
               MATCH(quote_text) AGAINST (? IN BOOLEAN MODE) AS score
          FROM quotes
         ${whereSql ? `${whereSql} AND` : 'WHERE'} MATCH(quote_text) AGAINST (? IN BOOLEAN MODE)
         ORDER BY ${orderBy}
         LIMIT ${limitSQL} OFFSET ${offsetSQL}
      `;
      const paramsPage = [boolQ, ...paramsBase, boolQ];
      logSQL(sqlPage, paramsPage);
      const [r] = await db.query(sqlPage, paramsPage);
      rows = r;
    } else {
      const sqlPage = `
        SELECT id, book, year, quote_text, source_note, created_at, 0 AS score
          FROM quotes
         ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ${limitSQL} OFFSET ${offsetSQL}
      `;
      logSQL(sqlPage, paramsBase);
      const [r] = await db.query(sqlPage, paramsBase);
      rows = r;
    }

    // LIKE fallback
    if (!rows.length && q) {
      const like = `%${q}%`;
      const sqlLike = `
        SELECT id, book, year, quote_text, source_note, created_at, 0 AS score
          FROM quotes
         ${whereSql ? `${whereSql} AND` : 'WHERE'} (quote_text LIKE ?)
         ORDER BY created_at DESC
         LIMIT ${limitSQL} OFFSET ${offsetSQL}
      `;
      const paramsLike = [...paramsBase, like];
      logSQL(sqlLike, paramsLike);
      const [r] = await db.query(sqlLike, paramsLike);
      rows = r;
    }

    const results = rows.map(r => ({
      ...r,
      quote_html: q ? highlight(r.quote_text, q) : r.quote_text
    }));

    res.render('quotes/book', {
      title: `Quotes — ${bookTitle}`,
      code, bookTitle,
      q, year, sort, page, limit, total,
      results
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;