
# HP Fan Site — MySQL Edition (Node.js + Express + EJS + MySQL)

## Prerequisites
- Node.js 18+
- MySQL 8.x (or MariaDB 10.4+)

Create a database user and set credentials in `.env`.

## Quick Start
```bash
npm i
npm run db:setup   # creates database (if not exists) and applies schema
npm run db:seed    # loads seed content
npm run dev        # start with nodemon
# or
npm start
```
Open http://localhost:3000

## Full-text Search
This build uses MySQL **FULLTEXT** on `site_index(title, body, tags)` and keeps it in sync via triggers for blog posts, stories, and quotes.

## Uploads
Uploaded images are stored under `public/uploads/art`.

## Environment
Edit `.env` to match your MySQL instance:
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hp_fansite
DB_USER=root
DB_PASS=yourpassword
```
