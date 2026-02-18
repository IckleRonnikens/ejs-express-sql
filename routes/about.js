
const express = require('express');
const router = express.Router();
router.get('/', (_, res) => res.render('about', { title: 'About' }));
module.exports = router;
