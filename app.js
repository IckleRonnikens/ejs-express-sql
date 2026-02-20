
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');

const app = express();

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'devsecret',
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax' }
}));

const writeLimiter = rateLimit({ windowMs: 60_000, max: 20 });
app.use(['/blog/:id/comments', '/feedback', '/fanart/artists/:id/upload'], writeLimiter);

app.use('/public', express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

app.use((req, res, next) => {
  res.locals.path = req.path;
  next();
});

app.use('/', require('./routes/home'));
app.use('/about', require('./routes/about'));
app.use('/blog', require('./routes/blog'));
app.use('/fanart', require('./routes/fanart'));
app.use('/fanfiction', require('./routes/fanfiction'));
app.use('/projects', require('./routes/projects'));
app.use('/feedback', require('./routes/feedback'));
app.use('/credits', require('./routes/credits'));
app.use('/live-search', require('./routes/live-search'));
app.use('/api', require('./routes/api.live-search'));

const quotesLanding = require('./routes/quotes/index');
const quotesView = require('./routes/quotes/view');

app.use('/quotes', quotesLanding);
app.use('/quotes', quotesView); // handles /quotes/:code

const fanfictionLists = require('./routes/fanfiction/publicLists');
app.use('/fanfiction/public-lists', fanfictionLists);





app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

app.use((req, res) => {
  res.status(404).render('partials/404', { title: 'Not Found' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running → http://localhost:${port}`);
});
