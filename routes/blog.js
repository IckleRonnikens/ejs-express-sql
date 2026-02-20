
const express = require('express');
const router = express.Router();
const db = require('../db');
const pool = require('../db'); 
const paginate = require('../middleware/pagination');
const { commentRules } = require('../middleware/validation');
const { validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

router.get('/', paginate(5,10), async (req, res, next) => {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const { tag, q } = req.query;

    let where = "WHERE status='published'";
    const params = [];
    if (tag) { where += " AND CONCAT(',', IFNULL(tags,''), ',') LIKE ?"; params.push(`%,${tag},%`); }
    if (q) { where += " AND (title LIKE ? OR body LIKE ?)"; params.push(`%${q}%`, `%${q}%`); }

    const sql = `SELECT id, slug, title, SUBSTRING(body,1,300) AS excerpt, image, summary, tags, published_at FROM blog_posts ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`;
    const [posts] = await db.query(sql, [...params, limit, offset]);
    const [[cnt]] = await db.query(`SELECT COUNT(*) AS cnt FROM blog_posts ${where}`, params);

    res.render('blog/index', { title: 'Blog', posts, total: cnt.cnt, page, limit, tag: tag || null, q: q || null });
  } catch (e) { next(e); }
});


router.get('/:slug', async (req, res, next) => {
  try {
    const [[post]] = await db.query(`SELECT * FROM blog_posts WHERE slug=?`, [req.params.slug]);
    if (!post) return res.status(404).render('partials/404', { title: 'Not Found' });
    const [comments] = await db.query(`SELECT * FROM blog_comments WHERE post_id=? AND is_approved=1 ORDER BY created_at DESC`, [post.id]);
    res.render('blog/show', { title: post.title, post, comments });
  } catch (e) { next(e); }
});

router.post('/:id/comments', commentRules, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).send('Invalid comment');
    const cleanAuthor = sanitizeHtml(req.body.author, { allowedTags: [], allowedAttributes: {} }).slice(0,100);
    const cleanBody = sanitizeHtml(req.body.body, { allowedTags: [], allowedAttributes: {} }).slice(0,2000);
    await db.query(`INSERT INTO blog_comments(post_id, author, body) VALUES(?,?,?)`, [req.params.id, cleanAuthor, cleanBody]);
    res.redirect('back');
  } catch (e) { next(e); }
});


module.exports = router;

