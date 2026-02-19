const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('live-search', { title: 'Live Search' });
});

const BOOK_CODE = {
  "Philosopher's Stone": 'ps',
  "Chamber of Secrets": 'cos',
  "Prisoner of Azkaban": 'poa',
  "Goblet of Fire": 'gof',
  "Order of the Phoenix": 'ootp',
  "Half-Blood Prince": 'hbp',
  "Deathly Hallows": 'dh'
};

module.exports = router;