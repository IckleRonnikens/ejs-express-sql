
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    multipleStatements: true
  });

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.changeUser({ database: process.env.DB_NAME });
    await conn.query(schema);
    console.log('Schema applied ✅');
  } catch (e) {
    console.error('Schema failed:', e);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
