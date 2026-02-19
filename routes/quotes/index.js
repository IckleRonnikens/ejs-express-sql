// routes/quotes/index.js
const express = require('express');
const router = express.Router();
const db = require('../../db'); // mysql2/promise pool

// Short codes → canonical book names
const BOOKS = {
  ps:   "Philosopher's Stone",
  cos:  "Chamber of Secrets",
  poa:  "Prisoner of Azkaban",
  gof:  "Goblet of Fire",
  ootp: "Order of the Phoenix",
  hbp:  "Half-Blood Prince",
  dh:   "Deathly Hallows"
};

// Landing: list books + counts (from the `quotes` table)
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT book, COUNT(*) AS cnt
         FROM quotes
        GROUP BY book`
    ); 

    // Merge counts back into code map
    const countsByBook = Object.fromEntries(rows.map(r => [r.book, r.cnt]));
    const items = Object.entries(BOOKS).map(([code, title]) => ({
      code, title, count: countsByBook[title] || 0
    }));

    res.render('quotes/index', {
      title: 'Quotes',
      items
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;