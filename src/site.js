// Loads the site content and shared settings used by both the dev server and the static build.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));

export const site = {
  name: 'Sergey Karev',
  domain: 'www.sergeikarev.com',
  social: {
    instagram: 'https://www.instagram.com/sergei_karev/',
    facebook: 'https://www.facebook.com/sergej.karev.1',
  },
  // Main sections, in menu order. Labels in English and Russian.
  sections: [
    { slug: 'sculptures', en: 'Sculptures', ru: 'Скульптуры' },
    { slug: 'projects', en: 'Projects, exhibitions', ru: 'Проекты, выставки' },
    { slug: 'series', en: 'Series', ru: 'Серии' },
    { slug: 'installations', en: 'Installations', ru: 'Инсталляции' },
    { slug: 'different', en: 'Different', ru: 'Разное' },
  ],
};

// Re-read on every call so edits to content/*.json show up without restarting.
export function loadContent() {
  const pages = read('pages.json');
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  return { pages, bySlug, redirects: read('redirects.json') };
}

export const urlFor = (slug) => (slug ? `/${slug}/` : '/');

// Which template + data a URL path renders. Returns null for "not found".
export function resolvePage(slug, content = loadContent()) {
  const page = content.bySlug.get(slug);
  if (!page) return null;
  if (slug === '') return { view: 'home', page, lang: 'en' };
  if (slug === 'ru') return { view: 'home', page, lang: 'ru' };
  return { view: 'page', page, lang: 'en' };
}
