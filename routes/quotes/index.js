const express = require('express');
const router = express.Router();
const db = require('../../db'); // adjust relative path to your pool
const sanitizeHtml = require('sanitize-html');


const BOOKS = {
  ps:   "Philosopher's Stone",
  cos:  "Chamber of Secrets",
  poa:  "Prisoner of Azkaban",
  gof:  "Goblet of Fire",
  ootp: "Order of the Phoenix",
  hbp:  "Half-Blood Prince",
  dh:   "Deathly Hallows"
};


// Boolean-prefix "+term*" builder
function toBooleanPrefixQuery(input, minLen = 3) {
  return (input || '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= minLen)
    .map(w => '+' + w.replace(/[-+~"()<>*]/g, ' ') + '*')
    .join(' ');
}

// Simple highlighter for visible query tokens
function highlight(text, query) {
  if (!text || !query) return text;
  const tokens = query.trim().split(/\s+/).filter(t => t.length >= 3);
  if (!tokens.length) return text;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${tokens.map(esc).join('|')})`, 'ig');
  return text.replace(re, '<mark>$1</mark>');
}

module.exports = function makeBookRouter({ code, title }) {
  const router = express.Router();

  
// Landing: show the 7 links (+ counts)
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT book, COUNT(*) AS cnt FROM quotes GROUP BY book`);
    const counts = Object.fromEntries(rows.map(r => [r.book, r.cnt]));
    res.render('quotes/index', {
      title: 'Quotes',
      books: BOOKS,
      counts
    });
  } catch (e) {
    next(e);
  }
});


for (const [code, title] of Object.entries(BOOKS)) {
  router.use(`/${code}`, makeBookRouter({ code, title }));
}



  // GET /quotes/<code>
  // Query params: q, year, sort, page, limit
  router.get('/', async (req, res, next) => {
    try {
      const qRaw = (req.query.q || '').trim().slice(0, 200);
      const q = sanitizeHtml(qRaw, { allowedTags: [], allowedAttributes: {} });

      const year = req.query.year ? parseInt(req.query.year, 10) : null;
      const sort = (req.query.sort || (q ? 'relevance' : 'newest')).toLowerCase();

      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
      const offset = (page - 1) * limit;

      const filters = ['book = ?'];
      const params = [title];
      if (Number.isInteger(year)) { filters.push('year = ?'); params.push(year); }

      // Sorting
      // When q is present and FTS is used, relevance (score) comes first.
      // Otherwise, newest first.
      const orderBy = {
        relevance: 'score DESC, created_at DESC',
        newest: 'created_at DESC',
        oldest: 'created_at ASC',
        year_asc: 'year ASC, created_at DESC',
        year_desc: 'year DESC, created_at DESC'
      }[sort] || (q ? 'score DESC, created_at DESC' : 'created_at DESC');

      // Count
      const whereBase = filters.join(' AND ');
      const boolQ = toBooleanPrefixQuery(q, 3);

      let total = 0;
      if (boolQ) {
        const [[{ cnt }]] = await db.query(
          `SELECT COUNT(*) AS cnt FROM quotes
           WHERE ${whereBase} AND MATCH(quote_text) AGAINST (? IN BOOLEAN MODE)`,
          [...params, boolQ]
        );
        total = cnt;
      } else {
        const [[{ cnt }]] = await db.query(
          `SELECT COUNT(*) AS cnt FROM quotes WHERE ${whereBase}`,
          params
        );
        total = cnt;
      }

      // Results (FTS when q present, else plain)
      let rows = [];
      if (boolQ) {
        const [r] = await db.query(
          `SELECT id, book, year, quote_text, source_note, created_at,
                  MATCH(quote_text) AGAINST (? IN BOOLEAN MODE) AS score
           FROM quotes
           WHERE ${whereBase} AND MATCH(quote_text) AGAINST (? IN BOOLEAN MODE)
           ORDER BY ${orderBy}
           LIMIT ? OFFSET ?`,
          [...params, boolQ, limit, offset]
        );
        rows = r;
      } else {
        const [r] = await db.query(
          `SELECT id, book, year, quote_text, source_note, created_at, 0 AS score
           FROM quotes
           WHERE ${whereBase}
           ORDER BY ${orderBy}
           LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        rows = r;
      }

      // Fallback to LIKE if nothing found with FTS
      if (!rows.length && q) {
        const like = `%${q}%`;
        const [r] = await db.query(
          `SELECT id, book, year, quote_text, source_note, created_at, 0 AS score
           FROM quotes
           WHERE ${whereBase}
             AND (quote_text LIKE ?)
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [...params, like, limit, offset]
        );
        rows.push(...r);
      }

      // Highlight tokens if q present
      const results = rows.map(r => ({
        ...r,
        quote_html: q ? highlight(r.quote_text, q) : r.quote_text
      }));

      res.render('quotes/book', {
        title: `Quotes — ${title}`,
        code, bookTitle: title,
        q, year, sort, page, limit, total,
        results
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
};