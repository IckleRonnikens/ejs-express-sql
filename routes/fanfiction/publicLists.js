// routes/fanfiction/publicLists.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('fanfiction/public-lists/index', { title: 'Public Lists' });
});

// Child page (novel-length)
router.use('/novel-length', require('./publicLists/novelLength'));

module.exports = router;