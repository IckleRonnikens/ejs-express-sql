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

// Build WHERE fragments for filters to reuse across subqueries
function buildFilterSql(params, qp) {
  const where = [];
  // Type filter: blog|story|quote|art|project
  if (qp.type) {
    // apply after union, but also allow subquery pre-filter optimization
    // we’ll still keep a top-level HAVING to be safe
  }

  // NSFW: by default hide NSFW unless explicitly allowed
  const showNsfw = (qp.nsfw === '1' || qp.nsfw === 'true');
  if (!showNsfw) {
    // We’ll enforce in the artworks subquery
    where.push('/* nsfw gating applied in artworks subquery */');
  }

  // Tag filter
  if (qp.tag) {
    params.push(`%,${qp.tag},%`);
    where.push(`(',' || '' || '') IS NULL`); // placeholder to keep array align if needed
  }

  // Book filter (quotes)
  if (qp.book) {
    params.push(qp.book);
    where.push(`/* book handled in quotes subquery */`);
  }

  // Date range (published_at / created_at) — we’ll apply in each subquery
  let dateFrom = qp.from ? qp.from.trim() : null;
  let dateTo   = qp.to   ? qp.to.trim()   : null;
  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) dateFrom = null;
  if (dateTo   && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo))   dateTo = null;

  return { where, dateFrom, dateTo, showNsfw };
}

router.get('/', async (req, res, next) => {
  try {
    const qRaw = (req.query.q || '').trim();
    const qSafe = sanitizeHtml(qRaw, { allowedTags: [], allowedAttributes: {} }).slice(0, 200);
    const boolQ = toBooleanPrefixQuery(qSafe, 3); // tokens >= 3 chars

    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const qp = {
      type: (req.query.type || '').trim(),   // blog|story|quote|art|project
      tag:  (req.query.tag  || '').trim(),
      book: (req.query.book || '').trim(),
      nsfw: (req.query.nsfw || '').trim(),
      from: (req.query.from || '').trim(),
      to:   (req.query.to   || '').trim(),
    };

    const params = [];
    const filters = buildFilterSql(params, qp);

    // Build each subquery with MATCH(...) and a common shape:
    //  id, type, ref_id, slug, title, snippet, tags, book, nsfw, published_at, score
    const subqueries = [];

    // BLOG
    {
      const where = ["bp.status='published'"];
      if (filters.dateFrom) { params.push(filters.dateFrom); where.push(`bp.published_at >= ?`); }
      if (filters.dateTo)   { params.push(filters.dateTo);   where.push(`bp.published_at < DATE_ADD(?, INTERVAL 1 DAY)`); }

      const ftsWhere = boolQ ? `MATCH(bp.title, bp.body, bp.tags) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);

      if (qp.tag) { params.push(`%,${qp.tag},%`); where.push(`CONCAT(',', IFNULL(bp.tags,''), ',') LIKE ?`); }

      subqueries.push(`
        SELECT
          bp.id AS id,
          'blog' AS type,
          bp.id AS ref_id,
          bp.slug AS slug,
          bp.title AS title,
          LEFT(bp.body, 200) AS snippet,
          bp.tags AS tags,
          NULL AS book,
          0 AS nsfw,
          bp.published_at AS published_at,
          ${boolQ ? `MATCH(bp.title, bp.body, bp.tags) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM blog_posts bp
        WHERE ${ftsWhere} AND ${where.join(' AND ')}
      `);
      if (boolQ) params.push(boolQ); // for the SELECT score AGAINST (?)
    }

    // STORIES
    {
      const where = ["s.status='published'"];
      if (filters.dateFrom) { params.push(filters.dateFrom); where.push(`s.published_at >= ?`); }
      if (filters.dateTo)   { params.push(filters.dateTo);   where.push(`s.published_at < DATE_ADD(?, INTERVAL 1 DAY)`); }

      const ftsWhere = boolQ ? `MATCH(s.title, s.summary, s.content, s.tags) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);
      if (qp.tag) { params.push(`%,${qp.tag},%`); where.push(`CONCAT(',', IFNULL(s.tags,''), ',') LIKE ?`); }

      subqueries.push(`
        SELECT
          s.id AS id,
          'story' AS type,
          s.id AS ref_id,
          NULL AS slug,
          s.title AS title,
          LEFT(CONCAT(IFNULL(s.summary,''),' ',IFNULL(s.content,'')), 200) AS snippet,
          s.tags AS tags,
          NULL AS book,
          0 AS nsfw,
          s.published_at AS published_at,
          ${boolQ ? `MATCH(s.title, s.summary, s.content, s.tags) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM stories s
        WHERE ${ftsWhere} AND ${where.join(' AND ')}
      `);
      if (boolQ) params.push(boolQ);
    }

    // QUOTES
    {
      const where = ["1=1"];
      const ftsWhere = boolQ ? `MATCH(q.quote) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);
      if (qp.book) { params.push(qp.book); where.push(`q.book = ?`); }

      subqueries.push(`
        SELECT
          q.id AS id,
          'quote' AS type,
          q.id AS ref_id,
          NULL AS slug,
          CONCAT(q.book, IFNULL(CONCAT(' - ', q.character_name), '')) AS title,
          LEFT(q.quote, 200) AS snippet,
          NULL AS tags,
          q.book AS book,
          0 AS nsfw,
          NULL AS published_at,
          ${boolQ ? `MATCH(q.quote) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM quotes q
        WHERE ${ftsWhere} AND ${where.join(' AND ')}
      `);
      if (boolQ) params.push(boolQ);
    }

    // ARTWORKS
    {
      const where = ["1=1"];
      // NSFW gating by default
      const showNsfw = (qp.nsfw === '1' || qp.nsfw === 'true');
      if (!showNsfw) where.push(`a.nsfw = 0`);
      if (filters.dateFrom) { params.push(filters.dateFrom); where.push(`a.created_at >= ?`); }
      if (filters.dateTo)   { params.push(filters.dateTo);   where.push(`a.created_at < DATE_ADD(?, INTERVAL 1 DAY)`); }
      const ftsWhere = boolQ ? `MATCH(a.title, a.description, a.tags) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);
      if (qp.tag) { params.push(`%,${qp.tag},%`); where.push(`CONCAT(',', IFNULL(a.tags,''), ',') LIKE ?`); }

      subqueries.push(`
        SELECT
          a.id AS id,
          'art' AS type,
          a.id AS ref_id,
          NULL AS slug,
          a.title AS title,
          LEFT(IFNULL(a.description,''), 200) AS snippet,
          a.tags AS tags,
          NULL AS book,
          a.nsfw AS nsfw,
          a.created_at AS published_at,
          ${boolQ ? `MATCH(a.title, a.description, a.tags) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM artworks a
        WHERE ${ftsWhere} AND ${where.join(' AND ')}
      `);
      if (boolQ) params.push(boolQ);
    }

    // PROJECTS
    {
      const where = ["1=1"];
      if (filters.dateFrom) { params.push(filters.dateFrom); where.push(`p.created_at >= ?`); }
      if (filters.dateTo)   { params.push(filters.dateTo);   where.push(`p.created_at < DATE_ADD(?, INTERVAL 1 DAY)`); }
      const ftsWhere = boolQ ? `MATCH(p.title, p.description) AGAINST (? IN BOOLEAN MODE)` : '1=1';
      if (boolQ) params.push(boolQ);

      subqueries.push(`
        SELECT
          p.id AS id,
          'project' AS type,
          p.id AS ref_id,
          NULL AS slug,
          p.title AS title,
          LEFT(IFNULL(p.description,''), 200) AS snippet,
          NULL AS tags,
          NULL AS book,
          0 AS nsfw,
          p.created_at AS published_at,
          ${boolQ ? `MATCH(p.title, p.description) AGAINST (? IN BOOLEAN MODE)` : '0'} AS score
        FROM projects p
        WHERE ${ftsWhere} AND ${where.join(' AND ')}
      `);
      if (boolQ) params.push(boolQ);
    }

    let unionSql = subqueries.join('\nUNION ALL\n');

    const topLevelWhere = [];
    const topParams = [];
    if (qp.type) { topLevelWhere.push('type = ?'); topParams.push(qp.type); }

    const countSql = `
      SELECT COUNT(*) AS cnt FROM (
        ${unionSql}
      ) AS allres
      ${topLevelWhere.length ? `WHERE ${topLevelWhere.join(' AND ')}` : ''}
    `;

    const [[countRow]] = await db.query(countSql, [...params, ...topParams]);
    const total = countRow ? countRow.cnt : 0;

    const pageSql = `
      SELECT * FROM (
        ${unionSql}
      ) AS allres
      ${topLevelWhere.length ? `WHERE ${topLevelWhere.join(' AND ')}` : ''}
      ORDER BY score DESC, published_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.query(pageSql, [...params, ...topParams, limit, offset]);

    let results = rows;
    let totalFinal = total;
    if (!results.length && qSafe) {
      const like = `%${qSafe}%`;
      const likeParams = [];
      const likeSubs = [];

      likeSubs.push(`
        SELECT bp.id, 'blog' AS type, bp.id AS ref_id, bp.slug, bp.title,
               LEFT(bp.body,200) AS snippet, bp.tags, NULL AS book, 0 AS nsfw,
               bp.published_at, 0 AS score
        FROM blog_posts bp
        WHERE bp.status='published' AND (bp.title LIKE ? OR bp.body LIKE ? OR IFNULL(bp.tags,'') LIKE ?)
      `); likeParams.push(like, like, like);

      likeSubs.push(`
        SELECT s.id, 'story', s.id, NULL, s.title,
               LEFT(CONCAT(IFNULL(s.summary,''),' ',IFNULL(s.content,'')),200), s.tags, NULL, 0,
               s.published_at, 0
        FROM stories s
        WHERE s.status='published' AND (s.title LIKE ? OR s.summary LIKE ? OR s.content LIKE ? OR IFNULL(s.tags,'') LIKE ?)
      `); likeParams.push(like, like, like, like);

      likeSubs.push(`
        SELECT q.id, 'quote', q.id, NULL,
               CONCAT(q.book, IFNULL(CONCAT(' - ', q.character_name), '')),
               LEFT(q.quote,200), NULL, q.book, 0, NULL, 0
        FROM quotes q
        WHERE (q.quote LIKE ? OR q.book LIKE ? OR IFNULL(q.character_name,'') LIKE ?)
      `); likeParams.push(like, like, like);

      likeSubs.push(`
        SELECT a.id, 'art', a.id, NULL, a.title,
               LEFT(IFNULL(a.description,''),200), a.tags, NULL, a.nsfw, a.created_at, 0
        FROM artworks a
        WHERE (a.title LIKE ? OR IFNULL(a.description,'') LIKE ? OR IFNULL(a.tags,'') LIKE ?)
          ${ (qp.nsfw === '1' || qp.nsfw === 'true') ? '' : 'AND a.nsfw=0' }
      `); likeParams.push(like, like, like);

      likeSubs.push(`
        SELECT p.id, 'project', p.id, NULL, p.title,
               LEFT(IFNULL(p.description,''),200), NULL, NULL, 0, p.created_at, 0
        FROM projects p
        WHERE (p.title LIKE ? OR IFNULL(p.description,'') LIKE ?)
      `); likeParams.push(like, like);

      const fallbackSql = `
        SELECT * FROM (
          ${likeSubs.join('\nUNION ALL\n')}
        ) AS fb
        ${qp.type ? 'WHERE fb.type = ?' : ''}
        ORDER BY published_at DESC
        LIMIT ? OFFSET ?
      `;
      const [fbRows] = await db.query(fallbackSql, qp.type ? [...likeParams, qp.type, limit, offset] : [...likeParams, limit, offset]);

      results = fbRows;
      totalFinal = fbRows.length; 
    }

    res.render('search', {
      title: 'Search',
      q: qSafe,
      results,
      total: totalFinal,
      page, limit,
      filters: { ...qp }
    });

  } catch (e) { next(e); }
});

module.exports = router;