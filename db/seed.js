
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  try {
    await conn.query(seed);
    console.log('Seed data inserted ✅');
  } catch (e) {
    console.error('Seeding failed:', e);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
