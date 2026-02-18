
const express = require('express');
const router = express.Router();
router.get('/', (req, res) => res.render('credits', { title: 'Credits' }));
module.exports = router;
