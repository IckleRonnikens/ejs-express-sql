
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => res.render('projects/landing', { title: 'Projects' }));

router.get('/magazine', async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM projects WHERE type='magazine' ORDER BY created_at DESC`);
    res.render('projects/magazine', { title: 'Magazine', items: rows });
  } catch (e) { next(e); }
});

router.get('/artbook', async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM projects WHERE type='artbook' ORDER BY created_at DESC`);
    res.render('projects/artbook', { title: 'Artbook', items: rows });
  } catch (e) { next(e); }
});

module.exports = router;
