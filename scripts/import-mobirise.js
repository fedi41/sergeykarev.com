// One-off importer: reads the old Mobirise export in legacy/ and writes
// content/pages.json + copies the images that are actually used into public/images.
// Run with: npm run import
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT = path.resolve(import.meta.dirname, '..');
const LEGACY = path.join(ROOT, 'legacy');
const IMG_OUT = path.join(ROOT, 'public', 'images');

const START = ['index.html', 'page33.html', 'CV.html'];
const pages = {};          // old filename -> page data
const usedImages = new Set();
const queue = [...START];

const isInternal = (href) =>
  href && /^[\w.\-]+\.html$/i.test(href) && fs.existsSync(path.join(LEGACY, href));

function img(src) {
  if (!src || src.startsWith('data:')) return null;
  const name = path.basename(src.split('?')[0]);
  if (!fs.existsSync(path.join(LEGACY, 'assets', 'images', name))) return null;
  usedImages.add(name);
  return name;
}

// Keep only simple inline markup: text, <br>, <a>, <b>/<strong>, <i>/<em>.
function cleanHtml($, el) {
  const out = [];
  const walk = (node) => {
    $(node).contents().each((_, c) => {
      if (c.type === 'text') { out.push(escape(c.data)); return; }
      if (c.type !== 'tag') return;
      const tag = c.name.toLowerCase();
      if (tag === 'br') { out.push('<br>'); return; }
      if (tag === 'a') {
        const href = $(c).attr('href') || '';
        const inner = cleanHtml($, c);
        if (!inner.trim()) return;
        if (isInternal(href)) { queue.push(href); out.push(`<a href="@@${href}">${inner}</a>`); }
        else if (/^https?:/.test(href) && !/mobiri/.test(href)) out.push(`<a href="${href}">${inner}</a>`);
        else out.push(inner);
        return;
      }
      if (['b', 'strong'].includes(tag)) { out.push(`<strong>${cleanHtml($, c)}</strong>`); return; }
      if (['i', 'em'].includes(tag)) { out.push(`<em>${cleanHtml($, c)}</em>`); return; }
      if (['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const inner = cleanHtml($, c); if (inner.trim()) out.push('<br>' + inner + '<br>'); return;
      }
      walk(c);
    });
  };
  walk(el);
  return tidy(out.join(''));
}
function escape(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function tidy(h) {
  h = h.replace(/<(em|strong)>\s*<\/\1>/g, ' ').replace(/Previous\s*Next(\s*Close)?/g, '');
  return h.replace(/‌| /g, ' ').replace(/[ \t\r\n]+/g, ' ')
    .replace(/\s*<br>\s*/g, '<br>').replace(/^(<br>)+|(<br>)+$/g, '')
    .replace(/(<br>){3,}/g, '<br><br>').trim();
}
const plain = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function parsePage(file) {
  const $ = cheerio.load(fs.readFileSync(path.join(LEGACY, file), 'utf8'));
  const page = {
    file,
    title: $('title').text().trim(),
    description: $('meta[name="description"]').attr('content')?.trim() || '',
    blocks: [],
  };
  $('body > section').each((_, sec) => {
    const $s = $(sec);
    if ($s.hasClass('menu') || $s.find('a[href*="mobiri"]').length && !$s.find('h1,h2,h3,h4,p').text().trim()) return;
    if ($s.hasClass('engine')) return;
    if ($s.find('a[href*="mobiri.se"]').length) return;

    // Gallery with lightbox: thumbs + full-size images
    if ($s.hasClass('mbr-gallery') || $s.find('.mbr-gallery-item').length) {
      const thumbs = $s.find('.mbr-gallery-item img').map((_, i) => $(i).attr('src')).get();
      const fulls = $s.find('.carousel-item img').map((_, i) => $(i).attr('src')).get();
      const images = [];
      const seen = new Set();
      thumbs.forEach((t, i) => {
        const full = img(fulls[i]) || img(t);
        const thumb = img(t) || full;
        if (full && !seen.has(full)) { seen.add(full); images.push({ thumb, full }); }
      });
      if (images.length) page.blocks.push({ type: 'gallery', images });
      return;
    }
    // Embedded video
    const iframe = $s.find('iframe').attr('src');
    if (iframe) {
      const m = iframe.match(/youtube\.com\/embed\/([\w-]+)/) || iframe.match(/youtu\.be\/([\w-]+)/);
      page.blocks.push({ type: 'video', youtube: m ? m[1] : null, src: iframe });
      return;
    }
    $s.find('video source, video').each((_, v) => {
      const src = $(v).attr('src'); if (src) page.blocks.push({ type: 'video', src });
    });
    // Cards (Mobirise ".card" blocks): image, title, short text, optional link
    const cards = [];
    $s.find('.card').each((_, card) => {
      const $c = $(card);
      const href = $c.find('a[href]').map((_, x) => $(x).attr('href')).get().find(isInternal);
      const heading = $c.find('.card-title, h4').first();
      const textEl = $c.find('.mbr-text, .card-text, p').first();
      let text = textEl.length ? cleanHtml($, textEl) : '';
      text = text.replace(/<a [^>]*>\s*See more[.\s]*<\/a>/gi, '').replace(/(<br>)+$/, '').trim();
      if (href) queue.push(href);
      const image = img($c.find('img').first().attr('src'));
      const title = heading.length ? plain(cleanHtml($, heading)) : '';
      if (image || href) cards.push({ href: href ? `@@${href}` : null, image, title, text });
    });
    if (cards.length) { page.blocks.push({ type: 'cards', items: cards }); return; }

    // Plain text / images
    const heading = $s.find('h1,h2').first();
    if (heading.length && !page.heading) page.heading = plain(cleanHtml($, heading));
    const clone = $s.clone();
    clone.find('h1,h2').first().remove();
    const html = cleanHtml($, clone);
    const imgs = $s.find('img').map((_, i) => img($(i).attr('src'))).get().filter(Boolean);
    if (heading.length && !page.blocks.length && !page.headingDone) page.headingDone = true;
    else if (heading.length) page.blocks.push({ type: 'text', html: `<h2>${escape(plain(cleanHtml($, heading)))}</h2>` });
    if (plain(html).replace(/[-–—\s]/g, '')) page.blocks.push({ type: 'text', html });
    for (const im of imgs) page.blocks.push({ type: 'image', src: im });
  });
  delete page.headingDone;
  return page;
}

while (queue.length) {
  const f = queue.shift();
  if (pages[f]) continue;
  pages[f] = parsePage(f);
}

// ---------- Duplicates ----------
// Mobirise kept several copies of some pages (older Russian-menu versions etc.).
// Pages with the same heading and overlapping images are merged into the fuller one.
const ALIASES = { 'page30.html': 'Series.html', 'page32.html': 'Sculptures.html' };
const norm = (h) => (h || '').toLowerCase().replace(/\s+/g, ' ').trim();
const imagesOf = (p) => p.blocks.flatMap((b) => b.type === 'gallery' ? b.images.map((i) => i.full) : b.type === 'image' ? [b.src] : []);
const weight = (p) => JSON.stringify(p.blocks).length;
const canonical = {};      // old file -> canonical old file
for (const [a, b] of Object.entries(ALIASES)) if (pages[a] && pages[b]) canonical[a] = b;
const list = Object.values(pages);
for (const a of list) {
  if (canonical[a.file] || ['index.html', 'page33.html'].includes(a.file)) continue;
  for (const b of list) {
    if (a === b || canonical[b.file] || norm(a.heading) !== norm(b.heading) || !a.heading) continue;
    const ia = new Set(imagesOf(a).map((x) => x.replace(/-\d+x\d+/g, '')));
    const ib = imagesOf(b).map((x) => x.replace(/-\d+x\d+/g, ''));
    const overlap = ib.filter((x) => ia.has(x)).length;
    const sameText = JSON.stringify(a.blocks.filter((x) => x.type === 'text')) === JSON.stringify(b.blocks.filter((x) => x.type === 'text'));
    if ((overlap && overlap >= Math.min(ia.size, ib.length) / 2) || sameText) {
      const [keep, drop] = weight(a) >= weight(b) ? [a, b] : [b, a];
      canonical[drop.file] = keep.file;
    }
  }
}
// The small Maple Key and the Andebolle Maple Key are different works that share photos.
for (const f of Object.keys(canonical)) if ([f, canonical[f]].includes('MapleKey1.html') && ['Assens.html', 'page23.html'].includes(f === 'MapleKey1.html' ? canonical[f] : f)) delete canonical[f];
if (pages['Assens.html'] && pages['page23.html'] && !canonical['Assens.html'] && !canonical['page23.html']) canonical['Assens.html'] = 'page23.html';
const resolve = (f) => { while (canonical[f]) f = canonical[f]; return f; };

// ---------- Slugs ----------
// Readable URLs, taken from the Latin part of the heading. Overrides where headings repeat.
const SLUG_OVERRIDES = {
  'index.html': '', 'page33.html': 'ru', 'CV.html': 'cv',
  'Sculptures.html': 'sculptures', 'page29.html': 'projects', 'Series.html': 'series',
  'page31.html': 'installations', 'page13.html': 'different',
  'page53.html': 'maple-key-schwetzingen', 'maplekey24.html': 'maple-key-2024',
  'MapleKey1.html': 'maple-key-small', 'page23.html': 'maple-key-andebolle', 'Assens.html': 'maple-key-andebolle',
  'page44.html': 'maple-key-st-petersburg', 'MapleKayLiving.html': 'living-sculpture-seed',
  'EatenGod.html': 'eaten-god-exhibition', 'page22.html': 'eaten-god',
  'PutinTrump.html': 'dont-forget-to-save-your-game', 'WarFight.html': 'fight-series', 'page37.html': 'worms', 'page50.html': 'chickendrones-2022',
};
const slugs = new Set();
const slugify = (t) => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/['’"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function slugFor(p) {
  if (p.file in SLUG_OVERRIDES) return SLUG_OVERRIDES[p.file];
  const latin = (p.heading || '').split('/').map((x) => x.replace(/\(.*?\)/g, '').trim()).find((x) => /[a-z]/i.test(x) && !/[а-яё]/i.test(x));
  let base = slugify(latin || p.title || p.file.replace('.html', '')) || 'page';
  let s = base, n = 2;
  while (slugs.has(s)) s = `${base}-${n++}`;
  return s;
}
for (const p of Object.values(pages)) if (!canonical[p.file]) { p.slug = slugFor(p); slugs.add(p.slug); }

const urlOf = (f) => { const p = pages[resolve(f)]; return p ? '/' + (p.slug ? p.slug + '/' : '') : '/'; };
const titleOf = (f) => pages[resolve(f)]?.heading || '';
const fix = (s) => s.replace(/@@([\w.\-]+\.html)/g, (_, f) => urlOf(f));
for (const p of Object.values(pages)) {
  for (const b of p.blocks) {
    if (b.html) b.html = fix(b.html);
    if (b.items) b.items.forEach((c) => { if (c.href) { if (!c.title) c.title = titleOf(c.href.slice(2)); c.href = fix(c.href); } c.text = fix(c.text); });
  }
}

// ---------- Redirects: every old URL -> new URL ----------
const redirects = {};
const byHeading = {};
for (const p of Object.values(pages)) if (!canonical[p.file] && p.heading) byHeading[norm(p.heading)] ??= p.file;
for (const f of fs.readdirSync(LEGACY).filter((x) => x.endsWith('.html')).sort()) {
  let target = '/';
  if (pages[f]) target = urlOf(f);
  else {
    const $ = cheerio.load(fs.readFileSync(path.join(LEGACY, f), 'utf8'));
    const h = norm(plain($('body h1, body h2').first().text()));
    if (byHeading[h]) target = urlOf(byHeading[h]);
  }
  redirects['/' + f] = target;
}

// ---------- Write ----------
fs.mkdirSync(path.join(ROOT, 'content'), { recursive: true });
const out = Object.values(pages).filter((p) => !canonical[p.file])
  .map(({ file, ...rest }) => ({ slug: rest.slug, title: rest.heading || rest.title, description: rest.description, blocks: rest.blocks }));
fs.writeFileSync(path.join(ROOT, 'content', 'pages.json'), JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'content', 'redirects.json'), JSON.stringify(redirects, null, 2) + '\n');

const keepImages = new Set();
JSON.stringify(out, (k, v) => { if (['thumb', 'full', 'src', 'image'].includes(k) && typeof v === 'string' && !v.startsWith('http')) keepImages.add(v); return v; });
fs.rmSync(IMG_OUT, { recursive: true, force: true });
fs.mkdirSync(IMG_OUT, { recursive: true });
for (const name of keepImages) if (usedImages.has(name)) fs.copyFileSync(path.join(LEGACY, 'assets', 'images', name), path.join(IMG_OUT, name));
console.log(`Imported ${out.length} pages, ${keepImages.size} images.`);
console.log('Merged duplicates:', Object.entries(canonical).map(([a, b]) => `${a}->${b}`).join(', '));
