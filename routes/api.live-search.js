const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise pool
const sanitizeHtml = require('sanitize-html');

function toBooleanPrefixQuery(input, minLen = 3) {
  return (input || '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= minLen)
    .map(w => '+' + w.replace(/[-+~"()<>*]/g, ' ') + '*')
    .join(' ');
}

/**
 * GET /api/live-search?q=...&limit=8&type=blog|story|quote|art|project&nsfw=0|1
 * Returns up to `limit` suggestions across all tables.
 */
router.get('/live-search', async (req, res, next) => {
  try {
    const qRaw = (req.query.q || '').trim();
    // Safety: visible text only
    const q = sanitizeHtml(qRaw, { allowedTags: [], allowedAttributes: {} }).slice(0, 200);

    const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 50);
    const typeFilter = (req.query.type || '').trim().toLowerCase(); // optional
    const showNsfw = (req.query.nsfw === '1' || req.query.nsfw === 'true');

    // Build boolean prefix query (+term*)
    const boolQ = toBooleanPrefixQuery(q, 3);

    // If user hasn’t typed enough to form tokens, early return empty
    if (!boolQ && q.length < 2) {
      return res.json({ q, results: [] });
    }

    const params = [];
    const subqueries = [];

    // BLOG
    {
      const fts = boolQ ? `MATCH(bp.title, bp.body, bp.tags) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);
      subqueries.push(`
        SELECT bp.id AS id, 'blog' AS type, bp.slug AS slug,
               bp.title AS title, LEFT(bp.body, 160) AS snippet,
               bp.published_at AS published_at,
               ${boolQ ? `MATCH(bp.title, bp.body, bp.tags) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM blog_posts bp
        WHERE bp.status='published' AND ${fts}
        ORDER BY score DESC, published_at DESC
        LIMIT ${limit}
      `);
      if (boolQ) params.push(boolQ); // AGAINST() in SELECT
    }

    // STORIES
    {
      const fts = boolQ ? `MATCH(s.title, s.summary, s.content, s.tags) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);
      subqueries.push(`
        SELECT s.id, 'story', NULL AS slug,
               s.title, LEFT(CONCAT(IFNULL(s.summary,''),' ',IFNULL(s.content,'')), 160) AS snippet,
               s.published_at,
               ${boolQ ? `MATCH(s.title, s.summary, s.content, s.tags) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM stories s
        WHERE s.status='published' AND ${fts}
        ORDER BY score DESC, published_at DESC
        LIMIT ${limit}
      `);
      if (boolQ) params.push(boolQ);
    }

    // ARTISTS
    {
      const fts = boolQ ? `MATCH(ar.name, ar.bio) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);
      subqueries.push(`
        SELECT ar.id, 'artist' AS type, NULL AS slug,
              ar.name AS title,
              LEFT(IFNULL(ar.bio,''), 160) AS snippet,
              NULL AS published_at,
              ${boolQ ? `MATCH(ar.name, ar.bio) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM artists ar
        WHERE ${fts}
        ORDER BY score DESC, ar.id DESC
        LIMIT ${limit}
      `);
      if (boolQ) params.push(boolQ);
    }

    // ARTWORKS (NSFW gate by default)
    {
      const fts = boolQ ? `MATCH(a.title, a.description, a.tags) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      const nsfwWhere = showNsfw ? '1=1' : 'a.nsfw=0';
      if (boolQ) params.push(boolQ);
      subqueries.push(`
        SELECT a.id, 'art', NULL AS slug,
               a.title,
               LEFT(IFNULL(a.description,''), 160) AS snippet,
               a.created_at AS published_at,
               ${boolQ ? `MATCH(a.title, a.description, a.tags) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM artworks a
        WHERE ${nsfwWhere} AND ${fts}
        ORDER BY score DESC, published_at DESC
        LIMIT ${limit}
      `);
      if (boolQ) params.push(boolQ);
    }


// QUOTES (new table schema)
{
  const fts = boolQ ? `MATCH(q.quote_text) AGAINST (? IN BOOLEAN MODE)` : '1=1';
  const whereFilters = [];
  const whereParams = [];

  if (req.query.book) { whereFilters.push('q.book = ?'); whereParams.push(String(req.query.book)); }
  if (req.query.year) { whereFilters.push('q.year = ?'); whereParams.push(parseInt(req.query.year, 10)); }

  if (boolQ) params.push(boolQ);
  subqueries.push(`
    SELECT q.id, 'quote' AS type, NULL AS slug,
           CONCAT(q.book, IFNULL(CONCAT(' (', q.year, ')'), '')) AS title,
           LEFT(q.quote_text, 160) AS snippet,
           q.created_at AS published_at,
           ${boolQ ? `MATCH(q.quote_text) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
    FROM quotes q
    WHERE ${fts}
      ${whereFilters.length ? 'AND ' + whereFilters.join(' AND ') : ''}
    ORDER BY score DESC, published_at DESC
    LIMIT ${limit}
  `);
  if (boolQ) params.push(boolQ);
  params.push(...whereParams);
}



    // PROJECTS
    {
      const fts = boolQ ? `MATCH(p.title, p.description) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);
      subqueries.push(`
        SELECT p.id, 'project', NULL AS slug,
               p.title, LEFT(IFNULL(p.description,''), 160) AS snippet,
               p.created_at AS published_at,
               ${boolQ ? `MATCH(p.title, p.description) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM projects p
        WHERE ${fts}
        ORDER BY score DESC, published_at DESC
        LIMIT ${limit}
      `);
      if (boolQ) params.push(boolQ);
    }

    // WRITERS
    {
      const fts = boolQ ? `MATCH(w.name, w.bio) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);
      subqueries.push(`
        SELECT w.id, 'writer' AS type, NULL AS slug,
              w.name AS title,
              LEFT(IFNULL(w.bio,''), 160) AS snippet,
              NULL AS published_at,
              ${boolQ ? `MATCH(w.name, w.bio) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM writers w
        WHERE ${fts}
        ORDER BY score DESC, w.id DESC
        LIMIT ${limit}
      `);
      if (boolQ) params.push(boolQ);
    }

    // UNION results, optionally restricted by type

const unionSql = `
  SELECT * FROM (
    ${subqueries.map(s => `(${s})`).join('\nUNION ALL\n')}
  ) AS allres
  ${typeFilter ? 'WHERE type = ?' : ''}
  ORDER BY score DESC, published_at DESC
  LIMIT ?
`;


    const finalParams = typeFilter ? [...params, typeFilter, limit] : [...params, limit];
    const [rows] = await db.query(unionSql, finalParams);

// If nothing and q is non-empty, do a LIKE fallback so users see something
let results = rows;
if (!results.length && q) {
  const like = `%${q}%`;
  const likeSubs = [];
  const likeParams = [];

  // BLOG
  likeSubs.push(`
    SELECT
      bp.id AS id,
      'blog' AS type,
      bp.slug AS slug,
      bp.title AS title,
      LEFT(bp.body, 160) AS snippet,
      bp.published_at AS published_at,
      0 AS score
    FROM blog_posts bp
    WHERE bp.status='published'
      AND (bp.title LIKE ? OR bp.body LIKE ? OR IFNULL(bp.tags,'') LIKE ?)
    LIMIT ${limit}
  `);
  likeParams.push(like, like, like);

  // STORIES
  likeSubs.push(`
    SELECT
      s.id AS id,
      'story' AS type,
      NULL AS slug,
      s.title AS title,
      LEFT(CONCAT(COALESCE(s.summary,''), ' ', COALESCE(s.content,'')), 160) AS snippet,
      s.published_at AS published_at,
      0 AS score
    FROM stories s
    WHERE s.status='published'
      AND (s.title LIKE ? OR s.summary LIKE ? OR s.content LIKE ? OR IFNULL(s.tags,'') LIKE ?)
    LIMIT ${limit}
  `);
  likeParams.push(like, like, like, like);

  // QUOTES
  {
    const quoteWhere = [
      '(q.quote_text LIKE ? OR q.book LIKE ?)'
    ];
    likeParams.push(like, like);

    if (req.query.book) {
      quoteWhere.push('q.book = ?');
      likeParams.push(String(req.query.book));
    }
    if (req.query.year) {
      quoteWhere.push('q.year = ?');
      likeParams.push(parseInt(req.query.year, 10));
    }

    likeSubs.push(`
      SELECT
        q.id AS id,
        'quote' AS type,
        NULL AS slug,
        CONCAT(q.book, IFNULL(CONCAT(' (', q.year, ')'), '')) AS title,
        LEFT(q.quote_text, 160) AS snippet,
        q.created_at AS published_at,
        0 AS score
      FROM quotes q
      WHERE ${quoteWhere.join(' AND ')}
      LIMIT ${limit}
    `);
  }

  // ARTISTS
  likeSubs.push(`
    SELECT
      ar.id AS id,
      'artist' AS type,
      NULL AS slug,
      ar.name AS title,
      LEFT(IFNULL(ar.bio,''), 160) AS snippet,
      NULL AS published_at,
      0 AS score
    FROM artists ar
    WHERE (ar.name LIKE ? OR IFNULL(ar.bio,'') LIKE ?)
    LIMIT ${limit}
  `);
  likeParams.push(like, like);

  // ARTWORKS
  likeSubs.push(`
    SELECT
      a.id AS id,
      'art' AS type,
      NULL AS slug,
      a.title AS title,
      LEFT(IFNULL(a.description,''), 160) AS snippet,
      a.created_at AS published_at,
      0 AS score
    FROM artworks a
    WHERE (a.title LIKE ? OR IFNULL(a.description,'') LIKE ? OR IFNULL(a.tags,'') LIKE ?)
      ${showNsfw ? '' : 'AND a.nsfw=0'}
    LIMIT ${limit}
  `);
  likeParams.push(like, like, like);

  // PROJECTS
  likeSubs.push(`
    SELECT
      p.id AS id,
      'project' AS type,
      NULL AS slug,
      p.title AS title,
      LEFT(IFNULL(p.description,''), 160) AS snippet,
      p.created_at AS published_at,
      0 AS score
    FROM projects p
    WHERE (p.title LIKE ? OR IFNULL(p.description,'') LIKE ?)
    LIMIT ${limit}
  `);
  likeParams.push(like, like);

  // WRITERS
  likeSubs.push(`
    SELECT
      w.id AS id,
      'writer' AS type,
      NULL AS slug,
      w.name AS title,
      LEFT(IFNULL(w.bio,''), 160) AS snippet,
      NULL AS published_at,
      0 AS score
    FROM writers w
    WHERE (w.name LIKE ? OR IFNULL(w.bio,'') LIKE ?)
    LIMIT ${limit}
  `);
  likeParams.push(like, like);

  // Join with parentheses per branch to be extra safe
  const fbSql = `
    SELECT
      fb.id,
      fb.type,
      fb.slug,
      fb.title,
      fb.snippet,
      fb.published_at,
      fb.score
    FROM (
      ${likeSubs.map(s => `(${s})`).join('\nUNION ALL\n')}
    ) AS fb
    ${typeFilter ? 'WHERE fb.type = ?' : ''}
    ORDER BY fb.published_at DESC
    LIMIT ?
  `;

  const fbParams = typeFilter
    ? [...likeParams, typeFilter, limit]
    : [...likeParams, limit];

  // Helpful during debugging
  // console.debug('fbSql:\n', fbSql);
  // console.debug('fbParams:', fbParams);

  const [fbRows] = await db.query(fbSql, fbParams);
  results = fbRows;
}

    res.json({ q, results });

  } catch (err) {
    next(err);
  }
});

module.exports = router;