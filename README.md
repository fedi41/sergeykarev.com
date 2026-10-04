# sergeykarev.com

Portfolio website of sculptor Sergey Karev, built with Node.js (Express + EJS).

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm start        # http://localhost:3000
npm run dev      # same, restarts automatically when code changes
```

## Project layout

```
content/pages.json      All page content (titles, texts, galleries, cards, videos)
content/redirects.json  Old Mobirise URLs (/Infantry.html, /page29.html …) -> new URLs
public/images/          Images used by the site
public/css, public/js   Stylesheet and the small gallery lightbox
views/                  EJS templates (home, page, 404, partials)
src/server.js           Local Express server
src/build.js            Static export to dist/ (for GitHub Pages)
src/site.js             Site settings: name, menu sections, social links
scripts/import-mobirise.js  One-off importer that created content/ from legacy/
legacy/                 The old Mobirise export, kept for reference (safe to delete later)
```

## Editing content

Edit `content/pages.json` and reload the browser — no restart needed.
Each page has a `slug` (its URL), a `title`, and a list of `blocks`:

- `text` — `{ "type": "text", "html": "..." }`
- `image` — `{ "type": "image", "src": "file.jpg" }` (file in `public/images/`)
- `gallery` — `{ "type": "gallery", "images": [{ "thumb": "small.jpg", "full": "large.jpg" }] }`
- `video` — `{ "type": "video", "youtube": "VIDEO_ID" }`
- `cards` — `{ "type": "cards", "items": [{ "href": "/infantry/", "image": "x.jpg", "title": "...", "text": "..." }] }`

The menu sections are set in `src/site.js`.

## Publish (GitHub Pages)

```bash
npm run build    # writes the static site to dist/
```

Upload/deploy the contents of `dist/` (it includes `CNAME`, `404.html` and redirect pages for all old URLs).
