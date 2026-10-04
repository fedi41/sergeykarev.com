// Static export for GitHub Pages: writes the whole site to dist/.
import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import { ROOT, site, loadContent, resolvePage, urlFor } from './site.js';

const DIST = path.join(ROOT, 'dist');
const content = loadContent();
const render = (view, data) =>
  ejs.renderFile(path.join(ROOT, 'views', `${view}.ejs`), { site, urlFor, ...data }, { views: [path.join(ROOT, 'views')] });

fs.rmSync(DIST, { recursive: true, force: true });
copyDir(path.join(ROOT, 'public'), DIST);

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name), dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest); else fs.copyFileSync(src, dest);
  }
}

for (const p of content.pages) {
  const match = resolvePage(p.slug, content);
  const out = path.join(DIST, p.slug, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await render(match.view, { ...match, path: urlFor(p.slug) }));
}

// Old URLs -> tiny redirect pages (GitHub Pages has no server-side redirects).
for (const [from, to] of Object.entries(content.redirects)) {
  if (from === '/index.html') continue;
  fs.writeFileSync(path.join(DIST, from),
    `<!doctype html><meta charset="utf-8"><title>Redirecting…</title>` +
    `<link rel="canonical" href="${to}"><meta http-equiv="refresh" content="0; url=${to}">` +
    `<a href="${to}">${to}</a>`);
}

fs.writeFileSync(path.join(DIST, '404.html'), await render('404', { lang: 'en', path: '/404', page: { title: 'Not found' } }));
fs.writeFileSync(path.join(DIST, 'CNAME'), fs.readFileSync(path.join(ROOT, 'CNAME')));
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log(`Built ${content.pages.length} pages + ${Object.keys(content.redirects).length - 1} redirects into dist/`);
