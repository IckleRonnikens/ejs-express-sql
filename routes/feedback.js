
const express = require('express');
const router = express.Router();
const db = require('../db');
const { feedbackRules } = require('../middleware/validation');
const { validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM feedback ORDER BY created_at DESC LIMIT 200`);
    res.render('feedback', { title: 'Feedback', entries: rows });
  } catch (e) { next(e); }
});

router.post('/', feedbackRules, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).send('Invalid feedback');
    const author = sanitizeHtml(req.body.author || 'Anonymous', { allowedTags: [], allowedAttributes: {} }).slice(0,100);
    const type = (req.body.type === 'suggestion') ? 'suggestion' : 'comment';
    const message = sanitizeHtml(req.body.message, { allowedTags: [], allowedAttributes: {} }).slice(0,2000);
    await db.query(`INSERT INTO feedback(author, type, message) VALUES(?,?,?)`, [author, type, message]);
    res.redirect('/feedback');
  } catch (e) { next(e); }
});

module.exports = router;
