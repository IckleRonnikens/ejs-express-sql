
const express = require('express');
const router = express.Router();
const db = require('../db');

const BOOKS = ['ps','cos','poa','gof','ootp','hbp','dh'];

router.get('/', (req, res) => {
  res.render('quotes/landing', { title: 'Quotes', books: BOOKS });
});

router.get('/:book', async (req, res, next) => {
  try {
    const book = req.params.book.toLowerCase();
    if (!BOOKS.includes(book)) return res.status(404).render('partials/404', { title: 'Not Found' });
    const q = (req.query.q || '').trim();
    let where = `WHERE book=?`;
    const params = [book];
    if (q) { where += ' AND (quote LIKE ? OR character LIKE ?)'; params.push(`%${q}%`,`%${q}%`); }
    const [rows] = await db.query(`SELECT * FROM quotes ${where} ORDER BY id DESC`, params);
    res.render('quotes/book', { title: `Quotes: ${book.toUpperCase()}`, book, quotes: rows, q });
  } catch (e) { next(e); }
});

module.exports = router;
