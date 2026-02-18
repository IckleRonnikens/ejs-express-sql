
// Minimal flipbook: next/prev image viewer based on data-pages
document.querySelectorAll('.flipbook').forEach(el => {
  let pages = [];
  try { pages = JSON.parse(el.dataset.pages || '[]'); } catch (e) { pages = []; }
  if (!pages.length) { el.innerHTML = '<em>No pages</em>'; return; }
  let i = 0;
  const img = document.createElement('img');
  img.src = pages[i];
  const prev = document.createElement('button'); prev.textContent = '◀';
  const next = document.createElement('button'); next.textContent = '▶';
  prev.onclick = () => { i = Math.max(0, i - 1); img.src = pages[i]; };
  next.onclick = () => { i = Math.min(pages.length - 1, i + 1); img.src = pages[i]; };
  el.append(prev, img, next);
});
