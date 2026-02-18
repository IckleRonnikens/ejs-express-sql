
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const [posts] = await db.query("SELECT id, slug, title, published_at FROM blog_posts WHERE status='published' ORDER BY published_at DESC LIMIT 5");
    const [arts] = await db.query("SELECT a.id, a.title, a.image_path, ar.name AS artist_name FROM artworks a JOIN artists ar ON a.artist_id = ar.id ORDER BY a.created_at DESC LIMIT 6");
    const [stories] = await db.query("SELECT s.id, s.title, w.name AS writer_name, s.published_at FROM stories s JOIN writers w ON s.writer_id = w.id WHERE s.status='published' ORDER BY s.published_at DESC LIMIT 5");
    res.render('home', { title: 'Home', posts, arts, stories });
  } catch (e) { next(e); }
});

module.exports = router;
