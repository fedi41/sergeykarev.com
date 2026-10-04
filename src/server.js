// Local server: http://localhost:3000
import express from 'express';
import path from 'node:path';
import { ROOT, site, loadContent, resolvePage, urlFor } from './site.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));
app.locals.site = site;
app.locals.urlFor = urlFor;

app.use(express.static(path.join(ROOT, 'public'), { redirect: false }));

// Old Mobirise URLs (e.g. /Infantry.html, /page29.html) keep working.
app.use((req, res, next) => {
  const target = loadContent().redirects[req.path];
  if (target) return res.redirect(301, target);
  next();
});

app.get(/^\/([a-z0-9-]*)\/?$/, (req, res, next) => {
  const slug = req.params[0];
  if (slug && !req.path.endsWith('/')) return res.redirect(301, `/${slug}/`);
  const match = resolvePage(slug);
  if (!match) return next();
  res.render(match.view, { ...match, path: req.path });
});

app.use((req, res) => res.status(404).render('404', { lang: 'en', path: req.path, page: { title: 'Not found' } }));

app.listen(PORT, () => console.log(`Sergey Karev site running at http://localhost:${PORT}`));
