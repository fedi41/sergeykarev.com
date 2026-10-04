// Minimal lightbox: click any [data-lightbox] link to view the full image.
// Arrow keys / buttons / swipe to navigate, Esc or click outside to close.
(() => {
  const box = document.querySelector('.lightbox');
  const links = [...document.querySelectorAll('a[data-lightbox]')];
  if (!box || !links.length) return;
  const img = box.querySelector('img');
  const count = box.querySelector('.lb-count');
  let i = 0;

  const show = (n) => {
    i = (n + links.length) % links.length;
    img.src = links[i].href;
    count.textContent = `${i + 1} / ${links.length}`;
    box.querySelector('.lb-prev').hidden = box.querySelector('.lb-next').hidden = links.length < 2;
  };
  const open = (n) => { show(n); box.hidden = false; document.body.style.overflow = 'hidden'; };
  const close = () => { box.hidden = true; img.removeAttribute('src'); document.body.style.overflow = ''; };

  links.forEach((a, n) => a.addEventListener('click', (e) => { e.preventDefault(); open(n); }));
  box.querySelector('.lb-close').onclick = close;
  box.querySelector('.lb-prev').onclick = (e) => { e.stopPropagation(); show(i - 1); };
  box.querySelector('.lb-next').onclick = (e) => { e.stopPropagation(); show(i + 1); };
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });
  let x0 = null;
  box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
